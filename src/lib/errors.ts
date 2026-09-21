import { ZodError } from "zod";

import { formatZodIssues } from "@/lib/validation/form-helpers";

export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "SUPABASE_NOT_CONFIGURED"
  | "PROFILE_INACTIVE"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(
    message: string,
    options?: {
      code?: AppErrorCode;
      statusCode?: number;
      details?: unknown;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = options?.code ?? "INTERNAL_ERROR";
    this.statusCode = options?.statusCode ?? 500;
    this.details = options?.details;
  }
}

type PostgresErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const POSTGRES_MESSAGES: Record<string, string> = {
  "23P01":
    "Este vehículo ya tiene una reserva entre estas fechas. Seleccione otro rango o vehículo.",
  "23503":
    "No se puede completar la operación porque faltan referencias relacionadas.",
  "23514": "Los datos enviados no cumplen las reglas del negocio.",
  "42501": "No tiene permiso para realizar esta operación.",
};

/** PostgREST / Postgres when a table or column is not migrated yet. */
export function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = String(
    (error as { message?: string }).message ??
      (error as { details?: string }).details ??
      "",
  ).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("could not find the relationship")
  );
}

function conflictMessageFromUniqueViolation(detail: string): string {
  const d = detail.toLowerCase();

  if (
    d.includes("(code)=") ||
    d.includes("_code_key") ||
    d.includes("code_key")
  ) {
    return "El código generado ya estaba en uso. Se reintentará automáticamente; si vuelve a fallar, recargue e intente de nuevo.";
  }

  if (d.includes("uq_customers_phone_active")) {
    return "El índice de teléfono único aún está activo en la base. Aplique la migración que permite teléfonos duplicados.";
  }
  if (
    d.includes("uq_customers_email_active") ||
    d.includes("(lower(email))=") ||
    d.includes("(email)=")
  ) {
    return "Ya hay un cliente activo con ese correo. Búsquelo en Clientes.";
  }
  if (d.includes("uq_customers_dui_active") || d.includes("(dui)=")) {
    return "Ya hay un cliente activo con ese DUI. Búsquelo en Clientes.";
  }
  if (d.includes("uq_customers_nit_active") || d.includes("(nit)=")) {
    return "Ya hay un cliente activo con ese NIT. Búsquelo en Clientes.";
  }

  if (
    d.includes("uq_vehicles_plate_active") ||
    d.includes("(upper(btrim(plate)))=") ||
    (d.includes("vehicles") && d.includes("plate"))
  ) {
    return "Ya hay un vehículo activo con esa placa.";
  }
  if (
    d.includes("uq_vehicles_slug_active") ||
    d.includes("vehicles_slug") ||
    (d.includes("vehicles") && d.includes("slug"))
  ) {
    return "Ya hay un vehículo con ese identificador. Cambie la placa o el nombre.";
  }
  if (
    d.includes("uq_vehicle_types_slug_active") ||
    d.includes("vehicle_types_slug")
  ) {
    return "Ya hay un tipo de vehículo activo con ese nombre. Reactive el anterior o use otro nombre.";
  }

  if (d.includes("accessory_catalog_code") || d.includes("accessory_catalog")) {
    return "Ya existe un accesorio con ese código.";
  }

  if (
    d.includes("contract_signatures") ||
    d.includes("signer_type")
  ) {
    return "Esa firma del contrato ya estaba registrada. Recargue e intente de nuevo.";
  }

  if (d.includes("roles_slug") || d.includes("permissions_key")) {
    return "Ese rol o permiso ya existe en el sistema.";
  }

  if (d.includes("user_permission_overrides")) {
    return "Ese permiso ya estaba asignado al usuario.";
  }

  if (d.includes("idx_alerts_dedupe")) {
    return "Esa alerta ya estaba activa.";
  }

  // Never show the old generic "Ya existe un registro con estos datos."
  return "Conflicto de datos: un valor único ya está en uso (código, placa, correo u otro identificador). Revise e intente de nuevo.";
}

export function mapPostgresError(error: unknown): AppError {
  const pgError = error as PostgresErrorLike;
  const code = pgError.code ?? "UNKNOWN";

  if (code === "23P01") {
    return new AppError(POSTGRES_MESSAGES["23P01"], {
      code: "CONFLICT",
      statusCode: 409,
      details: pgError.details,
      cause: error,
    });
  }

  if (code === "23505") {
    const detail = `${pgError.details ?? ""} ${pgError.message ?? ""}`;
    return new AppError(conflictMessageFromUniqueViolation(detail), {
      code: "CONFLICT",
      statusCode: 409,
      details: pgError.details,
      cause: error,
    });
  }

  const message = POSTGRES_MESSAGES[code];
  if (message) {
    return new AppError(message, {
      code: code === "42501" ? "FORBIDDEN" : "CONFLICT",
      statusCode: code === "42501" ? 403 : 409,
      details: pgError.details,
      cause: error,
    });
  }

  return new AppError("Ocurrió un error al procesar la solicitud.", {
    code: "INTERNAL_ERROR",
    statusCode: 500,
    cause: error,
  });
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return formatZodIssues(error);
  }

  if (isPostgresError(error)) {
    return mapPostgresError(error).message;
  }

  if (error instanceof Error && error.message) {
    // Zod sometimes serializes as Error with JSON message — keep UI clean.
    if (
      error.message.trim().startsWith("[{") &&
      error.message.includes('"code"')
    ) {
      return "Filtros inválidos. Revise búsqueda y estado e intente de nuevo.";
    }
    return error.message;
  }

  return "Ocurrió un error inesperado. Intente nuevamente.";
}

function isPostgresError(error: unknown): error is PostgresErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as PostgresErrorLike).code === "string"
  );
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getErrorStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  if (isPostgresError(error)) {
    return mapPostgresError(error).statusCode;
  }
  return 500;
}
