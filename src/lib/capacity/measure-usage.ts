import {
  ListObjectsV2Command,
  S3Client,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import pg from "pg";

import {
  CAPACITY_HEURISTICS,
  CAPACITY_LIMITS,
  type CapacityMeter,
  type CapacityPlatformStatus,
  type CapacitySnapshot,
} from "@/lib/capacity/types";
import {
  env,
  isCloudinaryConfigured,
  isR2Configured,
  isResendConfigured,
  isSupabaseConfigured,
} from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2Bucket } from "@/lib/storage/r2";

export {
  CAPACITY_HEURISTICS,
  CAPACITY_LIMITS,
  type CapacityMeter,
  type CapacitySnapshot,
} from "@/lib/capacity/types";

function pctOf(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(999, (used / limit) * 100);
}

function statusFromPct(pct: number | null): CapacityPlatformStatus {
  if (pct === null || !Number.isFinite(pct)) return "unknown";
  if (pct >= 85) return "critical";
  if (pct >= 60) return "warn";
  return "ok";
}

function meter(
  partial: Omit<CapacityMeter, "pct" | "status"> & { pct?: number | null },
): CapacityMeter {
  const pct =
    partial.pct ??
    (partial.limit > 0 ? pctOf(partial.used, partial.limit) : null);
  return {
    ...partial,
    pct,
    status: statusFromPct(pct),
  };
}

async function measureDatabase(): Promise<{
  dbBytes: number | null;
  tables: Array<{ name: string; mb: number }>;
  error?: string;
}> {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    return {
      dbBytes: null,
      tables: [],
      error: "DATABASE_URL no configurada (tamaño exacto no disponible).",
    };
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const db = await client.query<{ bytes: string }>(
      "select pg_database_size(current_database())::bigint as bytes",
    );
    const tables = await client.query<{ name: string; bytes: string }>(`
      select relname as name, pg_total_relation_size(c.oid)::bigint as bytes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by 2 desc
      limit 15
    `);
    return {
      dbBytes: Number(db.rows[0]?.bytes ?? 0),
      tables: tables.rows.map((r) => ({
        name: r.name,
        mb: Number(r.bytes) / 1024 / 1024,
      })),
    };
  } catch (e) {
    return {
      dbBytes: null,
      tables: [],
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function measureCounts(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured()) return {};
  try {
    const supabase = createAdminClient();
    const tables = [
      "contracts",
      "customers",
      "reservations",
      "vehicles",
      "quotes",
      "inspections",
      "inspection_photos",
      "contract_signatures",
      "web_requests",
      "profiles",
    ] as const;

    const entries = await Promise.all(
      tables.map(async (table) => {
        let query = supabase
          .from(table)
          .select("id", { count: "exact", head: true });
        if (
          table === "contracts" ||
          table === "customers" ||
          table === "reservations" ||
          table === "vehicles" ||
          table === "quotes"
        ) {
          query = query.is("deleted_at", null);
        }
        const { count, error } = await query;
        if (error) return [table, 0] as const;
        return [table, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

async function measureB2(): Promise<CapacitySnapshot["b2"]> {
  if (!isR2Configured()) {
    return {
      configured: false,
      objects: 0,
      bytes: 0,
      mb: 0,
      byPrefix: [],
      error: "Almacenamiento privado (B2) no configurado.",
    };
  }

  try {
    const endpoint =
      env.R2_ENDPOINT ||
      `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const region =
      env.R2_REGION ||
      endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i)?.[1] ||
      "auto";
    const s3 = new S3Client({
      region,
      endpoint,
      forcePathStyle: /backblazeb2\.com/i.test(endpoint),
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });

    const bucket = getR2Bucket();
    let token: string | undefined;
    let bytes = 0;
    let objects = 0;
    const prefixMap = new Map<string, { objects: number; bytes: number }>();

    do {
      const res: ListObjectsV2CommandOutput = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: token,
        }),
      );
      for (const obj of res.Contents ?? []) {
        const size = obj.Size ?? 0;
        bytes += size;
        objects += 1;
        const key = obj.Key ?? "";
        const prefix = key.includes("/") ? key.split("/")[0]! : "(root)";
        const cur = prefixMap.get(prefix) ?? { objects: 0, bytes: 0 };
        cur.objects += 1;
        cur.bytes += size;
        prefixMap.set(prefix, cur);
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);

    return {
      configured: true,
      objects,
      bytes,
      mb: bytes / 1024 / 1024,
      byPrefix: [...prefixMap.entries()]
        .map(([prefix, v]) => ({
          prefix,
          objects: v.objects,
          mb: v.bytes / 1024 / 1024,
        }))
        .sort((a, b) => b.mb - a.mb),
    };
  } catch (e) {
    return {
      configured: true,
      objects: 0,
      bytes: 0,
      mb: 0,
      byPrefix: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function measureCloudinary(): Promise<CapacitySnapshot["cloudinary"]> {
  const base = {
    configured: isCloudinaryConfigured(),
    creditsUsed: null as number | null,
    creditsLimit: CAPACITY_LIMITS.cloudinaryCredits,
    storageMb: null as number | null,
    bandwidthMb: null as number | null,
    transformations: null as number | null,
  };
  if (!isCloudinaryConfigured()) {
    return { ...base, error: "Cloudinary no configurado." };
  }

  try {
    const cloud = env.CLOUDINARY_CLOUD_NAME!;
    const key = env.CLOUDINARY_API_KEY!;
    const secret = env.CLOUDINARY_API_SECRET!;
    const auth = Buffer.from(`${key}:${secret}`).toString("base64");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/usage`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ...base, error: `Cloudinary usage HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      credits?: { usage?: number; limit?: number };
      storage?: { usage?: number };
      bandwidth?: { usage?: number };
      transformations?: { usage?: number };
    };
    return {
      configured: true,
      creditsUsed: data.credits?.usage ?? null,
      creditsLimit: data.credits?.limit ?? CAPACITY_LIMITS.cloudinaryCredits,
      storageMb:
        data.storage?.usage != null ? data.storage.usage / 1024 / 1024 : null,
      bandwidthMb:
        data.bandwidth?.usage != null
          ? data.bandwidth.usage / 1024 / 1024
          : null,
      transformations: data.transformations?.usage ?? null,
    };
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function collectCapacitySnapshot(): Promise<CapacitySnapshot> {
  const [db, counts, b2, cloudinary] = await Promise.all([
    measureDatabase(),
    measureCounts(),
    measureB2(),
    measureCloudinary(),
  ]);

  const dbMb = db.dbBytes != null ? db.dbBytes / 1024 / 1024 : null;
  const b2Mb = b2.mb;
  const b2LimitMb = CAPACITY_LIMITS.b2StorageGb * 1024;
  const dbLimitMb = CAPACITY_LIMITS.supabaseDbMb;

  const h = CAPACITY_HEURISTICS;
  const rentalsLeftInDb =
    dbMb != null
      ? Math.max(0, Math.floor((dbLimitMb - dbMb) / h.dbMbPerRental))
      : null;
  const rentalsLeftInB2 = Math.max(
    0,
    Math.floor((b2LimitMb - b2Mb) / h.b2MbPerRental),
  );
  const maxRentalsPerMonthB2Steady = Math.floor(
    b2LimitMb /
      (h.b2MbPerRental * (CAPACITY_LIMITS.inspectionRetentionDays / 30)),
  );

  const meters: CapacityMeter[] = [
    meter({
      id: "supabase-db",
      label: "Base de datos (Postgres)",
      platform: "Supabase Free",
      used: dbMb ?? 0,
      limit: dbLimitMb,
      unit: "MB",
      period: "cumulative",
      detail:
        dbMb != null
          ? "Espacio acumulado de datos. No se reinicia cada mes."
          : (db.error ?? "Sin medición"),
      source: dbMb != null ? "live" : "plan",
      pct: dbMb != null ? pctOf(dbMb, dbLimitMb) : null,
    }),
    meter({
      id: "b2-storage",
      label: "Archivos privados (firmas / fotos / PDFs)",
      platform: "Backblaze B2 Free",
      used: b2Mb,
      limit: b2LimitMb,
      unit: "MB",
      period: "cumulative",
      detail: b2.error
        ? b2.error
        : `Bucket ${env.R2_BUCKET ?? "—"}. Purga automática de fotos a ${CAPACITY_LIMITS.inspectionRetentionDays} días.`,
      source: b2.configured && !b2.error ? "live" : "plan",
      pct: b2.configured && !b2.error ? pctOf(b2Mb, b2LimitMb) : null,
    }),
    meter({
      id: "cloudinary-credits",
      label: "Fotos públicas / flota (créditos)",
      platform: "Cloudinary Free",
      used: cloudinary.creditsUsed ?? 0,
      limit: cloudinary.creditsLimit,
      unit: "créditos",
      period: "monthly",
      detail: cloudinary.error
        ? cloudinary.error
        : "Ventana ~30 días. 1 crédito ≈ 1 GB storage o 1 GB bandwidth o 1000 transforms.",
      source: cloudinary.creditsUsed != null ? "live" : "plan",
      pct:
        cloudinary.creditsUsed != null
          ? pctOf(cloudinary.creditsUsed, cloudinary.creditsLimit)
          : null,
    }),
    meter({
      id: "vercel-transfer",
      label: "Tráfico web (Fast Data Transfer)",
      platform: "Vercel Hobby",
      used: 0,
      limit: CAPACITY_LIMITS.vercelTransferGb,
      unit: "GB/mes",
      period: "monthly",
      detail:
        "Se mide en Vercel → Project → Usage. Límite Hobby 100 GB/mes (se reinicia).",
      source: "plan",
      pct: null,
    }),
    meter({
      id: "vercel-requests",
      label: "Peticiones Edge",
      platform: "Vercel Hobby",
      used: 0,
      limit: CAPACITY_LIMITS.vercelEdgeRequests,
      unit: "req/mes",
      period: "monthly",
      detail: "Límite Hobby 1 000 000 requests/mes. Ver consola Vercel Usage.",
      source: "plan",
      pct: null,
    }),
    meter({
      id: "resend-month",
      label: "Correos (cupo mensual)",
      platform: "Resend Free",
      used: 0,
      limit: CAPACITY_LIMITS.resendMonth,
      unit: "emails/mes",
      period: "monthly",
      detail: isResendConfigured()
        ? "Configurado. Uso exacto en dashboard Resend → Usage."
        : "RESEND_API_KEY no configurada.",
      source: "plan",
      pct: null,
    }),
    meter({
      id: "resend-day",
      label: "Correos (tope diario)",
      platform: "Resend Free",
      used: 0,
      limit: CAPACITY_LIMITS.resendDay,
      unit: "emails/día",
      period: "daily",
      detail: "Máximo 100 correos/día en Free.",
      source: "plan",
      pct: null,
    }),
  ];

  return {
    measuredAt: new Date().toISOString(),
    meters,
    counts,
    tables: db.tables,
    b2,
    supabase: {
      dbMb,
      dbBytes: db.dbBytes,
      error: db.error,
    },
    cloudinary,
    services: {
      supabase: isSupabaseConfigured(),
      b2: isR2Configured(),
      cloudinary: isCloudinaryConfigured(),
      resend: isResendConfigured(),
      cron: Boolean(process.env.CRON_SECRET?.trim()),
    },
    capacity: {
      rentalsLeftInDb,
      rentalsLeftInB2,
      maxRentalsPerMonthB2Steady,
      totalRentalsDbSupports: Math.floor(dbLimitMb / h.dbMbPerRental),
      totalRentalsB2SupportsNoPurge: Math.floor(b2LimitMb / h.b2MbPerRental),
    },
  };
}
