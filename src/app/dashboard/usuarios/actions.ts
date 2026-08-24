"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createUserSchema,
  updateUserSchema,
  userSearchSchema,
} from "@/lib/validation/user";
import type { Profile } from "@/types/database";
import type { PaginatedResult } from "@/types/api";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role_id: string | null;
  status: Profile["status"];
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    email: row.email ?? "",
    phone: row.phone,
    avatar_url: row.avatar_url,
    role_id: row.role_id,
    status: row.status,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listUsers(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<Profile>>> {
  try {
    await assertPermission("users.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = userSearchSchema.parse({
      query: params.q,
      status: params.status,
      roleId: params.roleId,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();
    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("last_name", { ascending: true });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.roleId) query = query.eq("role_id", filters.roleId);
    if (filters.query) {
      const term = `%${filters.query}%`;
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`,
      );
    }

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    return actionSuccess({
      items: ((data ?? []) as ProfileRow[]).map(mapProfileRow),
      total: count ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / filters.pageSize)),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getUser(id: string): Promise<ActionResult<Profile>> {
  try {
    await assertPermission("users.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Usuario no encontrado.");

    return actionSuccess(mapProfileRow(data as ProfileRow));
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listRolesForSelect(): Promise<
  ActionResult<Array<{ id: string; name: string }>>
> {
  try {
    await assertPermission("users.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("roles")
      .select("id, name")
      .order("name");

    if (error) throw mapPostgresError(error);

    return actionSuccess((data ?? []) as Array<{ id: string; name: string }>);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createUser(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("users.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }
    if (!isSupabaseAdminConfigured()) {
      return actionError(
        "Se requiere SUPABASE_SERVICE_ROLE_KEY para crear usuarios.",
      );
    }

    const parsed = createUserSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phone: formData.get("phone"),
      signatureUrl: formData.get("signatureUrl"),
      roleId: formData.get("roleId"),
      status: formData.get("status") || "ACTIVE",
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const admin = createAdminClient();
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
        },
      });

    if (authError) {
      return actionError(authError.message);
    }

    const newUserId = authData.user.id;

    const supabase = await createClient();
    const profilePayload: Record<string, unknown> = {
      id: newUserId,
      email: parsed.data.email,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone ?? null,
      role_id: parsed.data.roleId,
      status: parsed.data.status,
      signature_url: parsed.data.signatureUrl ?? null,
    };
    let { error: profileError } = await supabase
      .from("profiles")
      .upsert(profilePayload);

    if (profileError && /signature_url/i.test(profileError.message)) {
      delete profilePayload.signature_url;
      ({ error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload));
    }

    if (profileError) throw mapPostgresError(profileError);

    await writeAuditLog({
      userId: user.id,
      action: "user.create",
      entityType: "profile",
      entityId: newUserId,
    });

    revalidatePath("/dashboard/usuarios");
    return actionSuccess({ id: newUserId });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateUser(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("users.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = updateUserSchema.safeParse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phone: formData.get("phone"),
      signatureUrl: formData.get("signatureUrl"),
      roleId: formData.get("roleId"),
      status: formData.get("status"),
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const row: Record<string, unknown> = {};
    if (parsed.data.firstName) row.first_name = parsed.data.firstName;
    if (parsed.data.lastName) row.last_name = parsed.data.lastName;
    if (parsed.data.phone !== undefined) row.phone = parsed.data.phone ?? null;
    if (parsed.data.signatureUrl !== undefined) {
      row.signature_url = parsed.data.signatureUrl ?? null;
    }
    if (parsed.data.roleId) row.role_id = parsed.data.roleId;
    if (parsed.data.status) row.status = parsed.data.status;

    const supabase = await createClient();
    let { error } = await supabase.from("profiles").update(row).eq("id", id);
    if (error && /signature_url/i.test(error.message)) {
      delete row.signature_url;
      ({ error } = await supabase.from("profiles").update(row).eq("id", id));
    }

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "user.update",
      entityType: "profile",
      entityId: id,
    });

    revalidatePath("/dashboard/usuarios");
    revalidatePath(`/dashboard/usuarios/${id}/edit`);
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function disableUser(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("users.disable");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ status: "INACTIVE" })
      .eq("id", id);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "user.disable",
      entityType: "profile",
      entityId: id,
    });

    revalidatePath("/dashboard/usuarios");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
