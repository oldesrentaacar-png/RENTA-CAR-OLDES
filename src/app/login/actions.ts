"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase no está configurado. Configure NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Ingrese correo y contraseña." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Credenciales incorrectas. Verifique su correo y contraseña."
          : error.message,
    };
  }

  if (!data.user) {
    return { error: "No se pudo iniciar sesión." };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("status, first_name, last_name")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profileData) {
    await supabase.auth.signOut();
    return {
      error: "No se encontró un perfil válido para esta cuenta.",
    };
  }

  const profile = profileData as Pick<Profile, "status" | "first_name" | "last_name">;

  if (profile.status === "SUSPENDED") {
    await supabase.auth.signOut();
    return {
      error: "Su cuenta está suspendida. Contacte al administrador.",
    };
  }

  if (profile.status === "INACTIVE") {
    await supabase.auth.signOut();
    return {
      error: "Su cuenta está inactiva. Contacte al administrador.",
    };
  }

  revalidatePath("/dashboard", "layout");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}

export async function forgotPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase no está configurado. No se puede enviar el enlace de recuperación.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Ingrese su correo electrónico." };
  }

  const supabase = await createClient();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/login`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "Si el correo existe en el sistema, recibirá un enlace para restablecer su contraseña.",
  };
}
