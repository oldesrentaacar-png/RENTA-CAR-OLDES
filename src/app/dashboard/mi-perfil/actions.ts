"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Any logged-in user can update their own operator signature. */
export async function saveMySignature(
  formData: FormData,
): Promise<ActionResult<{ saved: boolean }>> {
  try {
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const user = await getCurrentUser();
    if (!user) return actionError("No autenticado.");

    const signatureUrl = String(formData.get("signatureUrl") ?? "").trim();
    if (!signatureUrl) {
      return actionError("Dibuje y confirme su firma antes de guardar.");
    }
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(signatureUrl)) {
      return actionError("Formato de firma inválido.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ signature_url: signatureUrl })
      .eq("id", user.id);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "profile.signature_update",
      entityType: "profile",
      entityId: user.id,
    });

    revalidatePath("/dashboard/mi-perfil");
    revalidatePath("/dashboard/contratos");
    return actionSuccess({ saved: true });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function clearMySignature(): Promise<ActionResult<{ cleared: boolean }>> {
  try {
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const user = await getCurrentUser();
    if (!user) return actionError("No autenticado.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ signature_url: null })
      .eq("id", user.id);

    if (error) throw mapPostgresError(error);

    revalidatePath("/dashboard/mi-perfil");
    return actionSuccess({ cleared: true });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
