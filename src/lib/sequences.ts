import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { DocumentSequenceType } from "@/types/database";

export type NextDocumentCodeResult =
  | { ok: true; code: string }
  | { ok: false; message: string };

export async function nextDocumentCode(
  sequenceType: DocumentSequenceType,
): Promise<NextDocumentCodeResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: "Supabase no está configurado.",
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("next_document_code", {
      p_sequence_type: sequenceType,
    });

    if (!error && typeof data === "string" && data.length > 0) {
      return { ok: true, code: data };
    }

    const admin = createAdminClient();
    const { data: adminData, error: adminError } = await admin.rpc(
      "next_document_code",
      { p_sequence_type: sequenceType },
    );

    if (adminError || typeof adminData !== "string" || adminData.length === 0) {
      return {
        ok: false,
        message:
          adminError?.message ??
          error?.message ??
          "No se pudo generar el código del documento.",
      };
    }

    return { ok: true, code: adminData };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo generar el código del documento.";
    return { ok: false, message };
  }
}
