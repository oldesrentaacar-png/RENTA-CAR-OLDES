"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  HardDrive,
  Mail,
  RefreshCw,
  Server,
} from "lucide-react";

import type { CapacitySnapshot } from "@/lib/capacity/types";
import {
  CAPACITY_HEURISTICS,
  CAPACITY_LIMITS,
} from "@/lib/capacity/types";
import { cn } from "@/lib/utils";

const PACE_OPTIONS = [
  { value: 10, label: "10 rentas/mes" },
  { value: 30, label: "30 rentas/mes" },
  { value: 60, label: "60 rentas/mes" },
  { value: 100, label: "100 rentas/mes" },
] as const;

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  if (mb >= 10) return `${mb.toFixed(1)} MB`;
  return `${mb.toFixed(2)} MB`;
}

function formatMonths(months: number | null): string {
  if (months === null || !Number.isFinite(months)) return "—";
  if (months >= 120) return ">10 años";
  if (months >= 24) return `${(months / 12).toFixed(1)} años`;
  if (months >= 1) return `${months.toFixed(1)} meses`;
  return `${Math.max(1, Math.round(months * 30))} días`;
}

function statusStyles(status: string) {
  switch (status) {
    case "critical":
      return "bg-red-50 text-red-800 border-red-200";
    case "warn":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "ok":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "not_configured":
      return "bg-zinc-50 text-zinc-600 border-zinc-200";
    default:
      return "bg-sky-50 text-sky-900 border-sky-200";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "critical":
      return "Crítico";
    case "warn":
      return "Vigilar";
    case "ok":
      return "OK";
    case "not_configured":
      return "Sin config";
    default:
      return "Ver consola";
  }
}

function UsageBar({ pct }: { pct: number | null }) {
  const width = pct == null ? 0 : Math.min(100, Math.max(pct, pct > 0 ? 0.8 : 0));
  const color =
    pct == null
      ? "bg-zinc-300"
      : pct >= 85
        ? "bg-red-600"
        : pct >= 60
          ? "bg-amber-500"
          : "bg-brand";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function CapacityDashboard({
  snapshot,
}: {
  snapshot: CapacitySnapshot;
}) {
  const [pace, setPace] = useState(30);
  const h = CAPACITY_HEURISTICS;

  const projection = useMemo(() => {
    const dbGrowth = pace * h.dbMbPerRental;
    const b2Growth = pace * h.b2MbPerRental;
    const emails = pace * h.emailsPerRental;
    const dbUsed = snapshot.supabase.dbMb ?? 0;
    const dbLeft = CAPACITY_LIMITS.supabaseDbMb - dbUsed;
    const b2Left = CAPACITY_LIMITS.b2StorageGb * 1024 - snapshot.b2.mb;
    const monthsDb = dbGrowth > 0 ? dbLeft / dbGrowth : null;
    const monthsB2 = b2Growth > 0 ? b2Left / b2Growth : null;
    const b2SteadyMb =
      b2Growth * (CAPACITY_LIMITS.inspectionRetentionDays / 30);
    const b2SteadyPct =
      (b2SteadyMb / (CAPACITY_LIMITS.b2StorageGb * 1024)) * 100;
    return {
      dbGrowth,
      b2Growth,
      emails,
      monthsDb,
      monthsB2,
      b2SteadyMb,
      b2SteadyPct,
      emailMonthPct: (emails / CAPACITY_LIMITS.resendMonth) * 100,
      emailDayAvg: emails / 30,
    };
  }, [pace, snapshot.b2.mb, snapshot.supabase.dbMb, h]);

  const measuredLabel = new Date(snapshot.measuredAt).toLocaleString("es-SV", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Medición: {measuredLabel}. Recargue la página para actualizar.
        </p>
        <a
          href="/dashboard/capacidad"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-zinc-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ServiceChip
          ok={snapshot.services.supabase}
          label="Supabase"
          icon={<Database className="h-4 w-4" />}
        />
        <ServiceChip
          ok={snapshot.services.b2}
          label="Backblaze B2"
          icon={<HardDrive className="h-4 w-4" />}
        />
        <ServiceChip
          ok={snapshot.services.cloudinary}
          label="Cloudinary"
          icon={<Cloud className="h-4 w-4" />}
        />
        <ServiceChip
          ok={snapshot.services.resend}
          label="Resend"
          icon={<Mail className="h-4 w-4" />}
        />
      </div>

      <section className="rounded-xl border border-border bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-brand">
          Capacidad total (recursos que NO se reinician cada mes)
        </h2>
        <p className="mt-1 text-sm text-muted">
          Estimación con ~{h.dbMbPerRental} MB de datos y ~{h.b2MbPerRental} MB
          de archivos privados por renta (fotos comprimidas + firmas + PDF).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <BigStat
            label="DB Free aguanta en total"
            value={`${snapshot.capacity.totalRentalsDbSupports.toLocaleString("es-SV")} rentas`}
            hint="Desde vacío hasta 500 MB"
          />
          <BigStat
            label="Rentas que aún caben en DB"
            value={
              snapshot.capacity.rentalsLeftInDb != null
                ? snapshot.capacity.rentalsLeftInDb.toLocaleString("es-SV")
                : "—"
            }
            hint={
              snapshot.supabase.dbMb != null
                ? `Quedan ${(CAPACITY_LIMITS.supabaseDbMb - snapshot.supabase.dbMb).toFixed(1)} MB`
                : "Sin tamaño DB"
            }
          />
          <BigStat
            label="B2 Free aguanta (sin purga)"
            value={`${snapshot.capacity.totalRentalsB2SupportsNoPurge.toLocaleString("es-SV")} rentas`}
            hint="10 GB de archivos privados"
          />
          <BigStat
            label="Máx. rentas/mes con purga 90 días"
            value={
              snapshot.capacity.maxRentalsPerMonthB2Steady != null
                ? snapshot.capacity.maxRentalsPerMonthB2Steady.toLocaleString(
                    "es-SV",
                  )
                : "—"
            }
            hint="Ritmo sostenible en B2 Free"
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand">
              Proyección según ritmo
            </h2>
            <p className="mt-1 text-sm text-muted">
              Calcula cuánto tiempo queda antes de llenar cupos acumulativos.
            </p>
          </div>
          <label className="text-sm">
            <span className="mr-2 text-muted">Ritmo</span>
            <select
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
              value={pace}
              onChange={(e) => setPace(Number(e.target.value))}
            >
              {PACE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <BigStat
            label="DB se llena en"
            value={formatMonths(projection.monthsDb)}
            hint={`+${projection.dbGrowth.toFixed(1)} MB/mes`}
          />
          <BigStat
            label="B2 se llena (sin purga) en"
            value={formatMonths(projection.monthsB2)}
            hint={`+${projection.b2Growth.toFixed(0)} MB/mes`}
          />
          <BigStat
            label="B2 estable con purga 90d"
            value={`${projection.b2SteadyPct.toFixed(0)}% del cupo`}
            hint={formatMb(projection.b2SteadyMb)}
          />
          <BigStat
            label="Correos estimados"
            value={`${Math.round(projection.emails)}/mes`}
            hint={`${projection.emailMonthPct.toFixed(0)}% de 3 000 · ~${projection.emailDayAvg.toFixed(1)}/día`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand">
          Uso por plataforma
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {snapshot.meters.map((m) => (
            <article
              key={m.id}
              className="rounded-xl border border-border bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {m.platform}
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold text-zinc-900">
                    {m.label}
                  </h3>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                    statusStyles(m.status),
                  )}
                >
                  {m.pct != null ? `${m.pct.toFixed(1)}%` : statusLabel(m.status)}
                </span>
              </div>
              <div className="mt-3">
                <UsageBar pct={m.pct} />
                <div className="mt-2 flex justify-between text-xs text-muted">
                  <span>
                    {m.source === "live"
                      ? `${m.used.toLocaleString("es-SV", { maximumFractionDigits: 2 })} ${m.unit}`
                      : m.source === "plan"
                        ? "Uso: ver consola del proveedor"
                        : `${m.used} ${m.unit}`}
                  </span>
                  <span>
                    Límite {m.limit.toLocaleString("es-SV")} {m.unit}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">{m.detail}</p>
              <p className="mt-1 text-[11px] text-zinc-400">
                Periodo:{" "}
                {m.period === "cumulative"
                  ? "Acumulativo (no se reinicia)"
                  : m.period === "monthly"
                    ? "Mensual (se reinicia)"
                    : m.period === "daily"
                      ? "Diario"
                      : "Info"}{" "}
                · Fuente:{" "}
                {m.source === "live"
                  ? "medido ahora"
                  : m.source === "plan"
                    ? "límite del plan"
                    : m.source}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-white p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-brand">
            <Server className="h-4 w-4" />
            Volumen en el sistema
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(snapshot.counts).map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2"
              >
                <p className="text-[11px] uppercase tracking-wide text-muted">
                  {key.replaceAll("_", " ")}
                </p>
                <p className="text-lg font-semibold tabular-nums text-zinc-900">
                  {value.toLocaleString("es-SV")}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-brand">
            Tablas más pesadas (Postgres)
          </h2>
          {snapshot.tables.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              {snapshot.supabase.error ??
                "No hay detalle de tablas (configure DATABASE_URL)."}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-2 pr-2 font-medium">Tabla</th>
                    <th className="py-2 text-right font-medium">Tamaño</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.tables.map((t) => (
                    <tr key={t.name} className="border-b border-zinc-100">
                      <td className="py-1.5 pr-2 font-mono text-xs">{t.name}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatMb(t.mb)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-brand">
          Detalle Backblaze B2 (por carpeta)
        </h2>
        {!snapshot.b2.configured ? (
          <p className="mt-2 text-sm text-muted">{snapshot.b2.error}</p>
        ) : snapshot.b2.error ? (
          <p className="mt-2 text-sm text-amber-800">{snapshot.b2.error}</p>
        ) : snapshot.b2.objects === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Bucket vacío o sin objetos visibles ({formatMb(0)} · 0 archivos).
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="py-2 font-medium">Prefijo</th>
                  <th className="py-2 text-right font-medium">Archivos</th>
                  <th className="py-2 text-right font-medium">Tamaño</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.b2.byPrefix.map((row) => (
                  <tr key={row.prefix} className="border-b border-zinc-100">
                    <td className="py-1.5 font-mono text-xs">{row.prefix}/</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {row.objects}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatMb(row.mb)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right tabular-nums">
                    {snapshot.b2.objects}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMb(snapshot.b2.mb)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {snapshot.cloudinary.configured && !snapshot.cloudinary.error ? (
        <section className="rounded-xl border border-border bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-brand">
            Detalle Cloudinary
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <BigStat
              label="Créditos"
              value={
                snapshot.cloudinary.creditsUsed != null
                  ? `${snapshot.cloudinary.creditsUsed} / ${snapshot.cloudinary.creditsLimit}`
                  : "—"
              }
            />
            <BigStat
              label="Storage"
              value={
                snapshot.cloudinary.storageMb != null
                  ? formatMb(snapshot.cloudinary.storageMb)
                  : "—"
              }
            />
            <BigStat
              label="Transformaciones"
              value={
                snapshot.cloudinary.transformations != null
                  ? snapshot.cloudinary.transformations.toLocaleString("es-SV")
                  : "—"
              }
            />
          </div>
        </section>
      ) : null}

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p className="flex items-start gap-2 font-medium">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Cómo interpretar
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sky-900/90">
          <li>
            <strong>Acumulativo</strong> (DB, B2): el uso crece con el tiempo; aquí
            calculamos cuántas rentas caben en total.
          </li>
          <li>
            <strong>Mensual</strong> (Vercel, Resend, Cloudinary créditos): el
            contador se reinicia; el riesgo es el pico del mes, no el histórico.
          </li>
          <li>
            Vercel Usage exacto solo está en la consola de Vercel (no expone API
            con las keys actuales del proyecto).
          </li>
        </ul>
      </div>
    </div>
  );
}

function ServiceChip({
  ok,
  label,
  icon,
}: {
  ok: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-zinc-200 bg-zinc-50 text-zinc-600",
      )}
    >
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      <span className="flex items-center gap-1.5 font-medium">
        {icon}
        {label}
      </span>
      <span className="ml-auto text-xs">{ok ? "Activo" : "No config"}</span>
    </div>
  );
}

function BigStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold leading-tight text-zinc-900">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
