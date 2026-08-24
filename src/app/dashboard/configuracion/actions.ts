"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { businessSettingsSchema } from "@/lib/validation/settings";
import type { BusinessSettings } from "@/types/database";

export async function getBusinessSettings(): Promise<
  ActionResult<BusinessSettings | null>
> {
  try {
    await assertPermission("settings.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("business_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw mapPostgresError(error);

    return actionSuccess((data as BusinessSettings | null) ?? null);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function saveBusinessSettings(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("settings.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = businessSettingsSchema.safeParse({
      businessName: formData.get("businessName"),
      legalName: formData.get("legalName"),
      logoUrl: formData.get("logoUrl"),
      address: formData.get("address"),
      phone: formData.get("phone"),
      whatsapp: formData.get("whatsapp"),
      email: formData.get("email"),
      currency: formData.get("currency") || "USD",
      timezone: formData.get("timezone") || "America/El_Salvador",
      quoteTerms: formData.get("quoteTerms"),
      contractTerms: formData.get("contractTerms"),
      defaultDeposit: formData.get("defaultDeposit") || 0,
      defaultInsurance: formData.get("defaultInsurance") || 0,
      defaultDeliveryFee: formData.get("defaultDeliveryFee") || 0,
      extraDayGraceHours: formData.get("extraDayGraceHours") || 2,
      receiptTemplateUrl: formData.get("receiptTemplateUrl"),
      contractTemplateUrl: formData.get("contractTemplateUrl"),
      policies: formData.get("policies"),
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data: existingSettings } = await supabase
      .from("business_settings")
      .select("id, policies")
      .limit(1)
      .maybeSingle();

    const existingPolicies =
      (existingSettings as { policies?: Record<string, unknown> } | null)
        ?.policies ?? {};

    const row = {
      business_name: parsed.data.businessName,
      legal_name: parsed.data.legalName ?? null,
      logo_url: parsed.data.logoUrl ?? null,
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      email: parsed.data.email ?? null,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
      quote_terms: parsed.data.quoteTerms ?? null,
      contract_terms: parsed.data.contractTerms ?? null,
      default_deposit: parsed.data.defaultDeposit,
      default_insurance: parsed.data.defaultInsurance,
      default_delivery_fee: parsed.data.defaultDeliveryFee,
      policies: {
        ...existingPolicies,
        extraDayGraceHours: parsed.data.extraDayGraceHours,
        receiptTemplateUrl: parsed.data.receiptTemplateUrl ?? null,
        contractTemplateUrl: parsed.data.contractTemplateUrl ?? null,
        ...(parsed.data.policies ? { text: parsed.data.policies } : {}),
      },
    };

    const { data: existing } = existingSettings
      ? { data: existingSettings }
      : await supabase.from("business_settings").select("id").limit(1).maybeSingle();

    if (existing) {
      const id = (existing as { id: string }).id;
      const { error } = await supabase
        .from("business_settings")
        .update(row)
        .eq("id", id);

      if (error) throw mapPostgresError(error);

      await writeAuditLog({
        userId: user.id,
        action: "settings.update",
        entityType: "business_settings",
        entityId: id,
      });

      revalidatePath("/dashboard/configuracion");
      return actionSuccess({ id });
    }

    const { data, error } = await supabase
      .from("business_settings")
      .insert(row)
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;

    await writeAuditLog({
      userId: user.id,
      action: "settings.create",
      entityType: "business_settings",
      entityId: id,
    });

    revalidatePath("/dashboard/configuracion");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listAuditLogs(
  params: Record<string, string | string[] | undefined> = {},
): Promise<
  ActionResult<{
    items: Array<{
      id: string;
      user_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      metadata: unknown;
      created_at: string;
      userName: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>
> {
  try {
    await assertPermission("audit.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const page = Math.max(1, Number(params.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? 25)));

    const supabase = await createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw mapPostgresError(error);

    const logs = (data ?? []) as Array<{
      id: string;
      user_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      metadata: unknown;
      created_at: string;
    }>;

    const userIds = [...new Set(logs.map((log) => log.user_id).filter(Boolean))];
    let profileMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds as string[]);

      profileMap = new Map(
        ((profiles ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>).map(
          (profile) => [
            profile.id,
            `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
          ],
        ),
      );
    }

    return actionSuccess({
      items: logs.map((log) => ({
        ...log,
        userName: log.user_id ? profileMap.get(log.user_id) ?? null : null,
      })),
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
