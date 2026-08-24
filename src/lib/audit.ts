import type { Json } from "@/types/database";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuditLogInput = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AuditLogResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

function sanitizeMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const blockedKeys = [
    "password",
    "token",
    "secret",
    "authorization",
    "service_role",
  ];

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (blockedKeys.some((blocked) => lowerKey.includes(blocked))) {
      continue;
    }
    output[key] = value;
  }

  return Object.keys(output).length > 0 ? output : null;
}

export async function writeAuditLog(
  input: AuditLogInput,
): Promise<AuditLogResult> {
  const payload = {
    user_id: input.userId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: sanitizeMetadata(input.metadata) as Json | null,
  };

  try {
    if (isSupabaseAdminConfigured()) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("audit_logs")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        return { ok: false, message: error.message };
      }

      return { ok: true, id: (data as { id: string }).id };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true, id: (data as { id: string }).id };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo registrar la auditoría.";
    return { ok: false, message };
  }
}
