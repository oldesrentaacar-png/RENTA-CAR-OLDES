import { NextResponse } from "next/server";

import {
  buildRateLimitKey,
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/types/api";
import type { PublicVehicleTypeResponse } from "@/types/api";

/**
 * Fallback public catalog when `vehicle_types` is empty.
 * AGGREGATES published units by category — does NOT expose plate / brand / model
 * unit inventory. Landing must prefer GET /api/public/vehicle-types and must
 * never render individual vehicles from this endpoint as inventory.
 */
function slugifyCategory(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "general"
  );
}

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const rateKey = buildRateLimitKey(ip, "public-vehicles");
  const rate = checkRateLimit(rateKey, { limit: 60, windowMs: 60_000 });

  if (!rate.allowed) {
    return NextResponse.json(
      apiError("Demasiadas solicitudes. Intente más tarde.", {
        code: "RATE_LIMITED",
      }),
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      apiError("Servicio no disponible temporalmente.", {
        code: "SERVICE_UNAVAILABLE",
      }),
      { status: 503 },
    );
  }

  try {
    const admin = createAdminClient();
    const { data: vehicles, error } = await admin
      .from("vehicles")
      .select(
        `
        category,
        transmission,
        passengers,
        luggage,
        air_conditioning,
        daily_rate,
        public_description,
        vehicle_images ( url, is_primary, position )
      `,
      )
      .eq("published_on_web", true)
      .eq("is_active", true)
      .is("archived_at", null)
      .is("deleted_at", null)
      .order("category", { ascending: true });

    if (error) {
      return NextResponse.json(
        apiError("No se pudieron cargar los vehículos.", {
          code: "INTERNAL_ERROR",
        }),
        { status: 500 },
      );
    }

    type UnitRow = {
      category: string | null;
      transmission: string | null;
      passengers: number | null;
      luggage: number | null;
      air_conditioning: boolean;
      daily_rate: number;
      public_description: string | null;
      vehicle_images: Array<{
        url: string;
        is_primary: boolean;
        position: number;
      }> | null;
    };

    const byCategory = new Map<
      string,
      {
        name: string;
        dailyRate: number;
        passengers: number | null;
        luggage: number | null;
        airConditioning: boolean;
        transmission: string | null;
        description: string | null;
        imageUrl: string | null;
        sortOrder: number;
      }
    >();

    for (const row of (vehicles ?? []) as UnitRow[]) {
      const name = (row.category || "General").trim() || "General";
      const images = (row.vehicle_images ?? [])
        .slice()
        .sort((a, b) => {
          if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
          return a.position - b.position;
        });
      const sampleImage = images[0]?.url ?? null;
      const rate = Number(row.daily_rate);
      const existing = byCategory.get(name);

      if (!existing) {
        byCategory.set(name, {
          name,
          dailyRate: rate,
          passengers: row.passengers,
          luggage: row.luggage,
          airConditioning: Boolean(row.air_conditioning),
          transmission: row.transmission,
          description: row.public_description,
          imageUrl: sampleImage,
          sortOrder: byCategory.size * 10,
        });
        continue;
      }

      if (rate < existing.dailyRate) existing.dailyRate = rate;
      if (!existing.imageUrl && sampleImage) existing.imageUrl = sampleImage;
    }

    const data: PublicVehicleTypeResponse[] = [...byCategory.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((entry, index) => {
        const slug = slugifyCategory(entry.name);
        return {
          id: `agg-${slug}`,
          slug,
          name: entry.name,
          nameEn: null,
          description: entry.description,
          dailyRate: entry.dailyRate,
          weeklyRate: entry.dailyRate
            ? Math.round(entry.dailyRate * 6 * 100) / 100
            : null,
          passengers: entry.passengers ?? 5,
          luggage: entry.luggage ?? 2,
          doors: 4,
          airConditioning: entry.airConditioning,
          transmission: entry.transmission,
          features: [],
          imageUrl: entry.imageUrl,
          sortOrder: entry.sortOrder || index * 10,
        };
      });

    return NextResponse.json(apiSuccess(data));
  } catch {
    return NextResponse.json(
      apiError("Error interno del servidor.", { code: "INTERNAL_ERROR" }),
      { status: 500 },
    );
  }
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      : {},
  });
}
