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
 * Public catalog of vehicle TYPES + rates only.
 * Landing must not show unit inventory (plates / brand-model units).
 */
export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const rateKey = buildRateLimitKey(ip, "public-vehicle-types");
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
    const { data: types, error } = await admin
      .from("vehicle_types")
      .select(
        `
        id,
        slug,
        name,
        name_en,
        description,
        description_en,
        reference_models,
        reference_models_en,
        daily_rate,
        weekly_rate,
        passengers,
        luggage,
        luggage_label,
        luggage_label_en,
        doors,
        air_conditioning,
        transmission,
        features,
        image_url,
        sort_order
      `,
      )
      .eq("published_on_web", true)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("daily_rate", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        apiError("No se pudieron cargar los tipos de vehículo.", {
          code: "INTERNAL_ERROR",
        }),
        { status: 500 },
      );
    }

    const data: PublicVehicleTypeResponse[] = (types ?? []).map((row) => {
      const featuresRaw = row.features;
      const features = Array.isArray(featuresRaw)
        ? featuresRaw.map(String)
        : [];

      return {
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
        nameEn: (row.name_en as string | null) ?? null,
        description: (row.description as string | null) ?? null,
        descriptionEn: (row.description_en as string | null) ?? null,
        referenceModels: (row.reference_models as string | null) ?? null,
        referenceModelsEn: (row.reference_models_en as string | null) ?? null,
        dailyRate: Number(row.daily_rate),
        weeklyRate:
          row.weekly_rate != null ? Number(row.weekly_rate) : null,
        passengers: Number(row.passengers),
        luggage: Number(row.luggage),
        luggageLabel: (row.luggage_label as string | null) ?? null,
        luggageLabelEn: (row.luggage_label_en as string | null) ?? null,
        doors: Number(row.doors),
        airConditioning: Boolean(row.air_conditioning),
        transmission: (row.transmission as string | null) ?? null,
        features,
        imageUrl: (row.image_url as string | null) ?? null,
        sortOrder: Number(row.sort_order ?? 0),
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
