import { NextResponse } from "next/server";

import { isSupabaseAdminConfigured } from "@/lib/env";
import {
  sanitizeEmail,
  sanitizeOptionalString,
  sanitizePhone,
  sanitizeString,
} from "@/lib/security/sanitize";
import {
  buildCorsHeaders,
  validateRequestOrigin,
} from "@/lib/security/origin";
import {
  buildRateLimitKey,
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isHoneypotTriggered,
  publicRequestSchema,
} from "@/lib/validation/public-request";
import { apiError, apiSuccess } from "@/types/api";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  const ip = getClientIp(request.headers);
  const rateKey = buildRateLimitKey(ip, "public-requests");
  const rate = checkRateLimit(rateKey, { limit: 10, windowMs: 60_000 });

  if (!rate.allowed) {
    return NextResponse.json(
      apiError("Demasiadas solicitudes. Intente más tarde.", {
        code: "RATE_LIMITED",
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  const originCheck = validateRequestOrigin(request.headers);
  if (!originCheck.valid) {
    return NextResponse.json(
      apiError("Origen no autorizado.", { code: "FORBIDDEN" }),
      { status: 403, headers: corsHeaders },
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      apiError(
        "El servicio no está disponible en este momento. Intente más tarde.",
        { code: "SERVICE_UNAVAILABLE" },
      ),
      { status: 503, headers: corsHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      apiError("Cuerpo de solicitud inválido.", { code: "BAD_REQUEST" }),
      { status: 400, headers: corsHeaders },
    );
  }

  const parsed = publicRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError("Datos inválidos.", {
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: corsHeaders },
    );
  }

  if (isHoneypotTriggered(parsed.data)) {
    return NextResponse.json(
      apiSuccess({ requestCode: "OK" }),
      { status: 200, headers: corsHeaders },
    );
  }

  const input = parsed.data;

  try {
    const admin = createAdminClient();
    // Quote REQUEST only — vehicle_category may be a type slug or display name.
    // vehicle_id is optional and must not be required for type-based requests.
    const { data, error } = await admin
      .from("web_requests")
      .insert({
        first_name: sanitizeString(input.firstName, 100),
        last_name: sanitizeString(input.lastName, 100),
        phone: sanitizePhone(input.phone),
        email: input.email ? sanitizeEmail(input.email) : null,
        pickup_date: input.pickupDate,
        pickup_time: input.pickupTime,
        return_date: input.returnDate,
        return_time: input.returnTime,
        vehicle_id: input.vehicleId ?? null,
        vehicle_category: sanitizeOptionalString(input.vehicleCategory, 100),
        pickup_location: sanitizeOptionalString(input.pickupLocation, 255),
        return_location: sanitizeOptionalString(input.returnLocation, 255),
        notes: sanitizeOptionalString(input.notes, 2000),
        source: "WEBSITE",
        status: "PENDING",
      })
      .select("code")
      .single();

    if (error || !data) {
      return NextResponse.json(
        apiError("No se pudo registrar la solicitud.", {
          code: "INTERNAL_ERROR",
        }),
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      apiSuccess({ requestCode: (data as { code: string }).code }),
      { status: 201, headers: corsHeaders },
    );
  } catch {
    return NextResponse.json(
      apiError("Error interno del servidor.", { code: "INTERNAL_ERROR" }),
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}
