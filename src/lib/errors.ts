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
  "23505": "Ya existe un registro con estos datos.",
  "23503": "No se puede completar la operación porque faltan referencias relacionadas.",
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
    const detail = `${pgError.details ?? ""} ${pgError.message ?? ""}`.toLowerCase();
    const codeCollision =
      detail.includes("(code)=") ||
      detail.includes("_code_key") ||
      detail.includes("code_key");
    return new AppError(
      codeCollision
        ? "El código del documento ya existe (secuencia desfasada). Intente de nuevo; si persiste, contacte soporte."
        : POSTGRES_MESSAGES["23505"],
      {
        code: "CONFLICT",
        statusCode: 409,
        details: pgError.details,
        cause: error,
      },
    );
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
    if (error.message.trim().startsWith("[{") && error.message.includes('"code"')) {
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
