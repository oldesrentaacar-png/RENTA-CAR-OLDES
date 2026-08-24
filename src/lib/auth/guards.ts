import type { User } from "@supabase/supabase-js";

import {
  type PermissionKey,
  requirePermission,
} from "@/lib/auth/permissions";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/types/database";

export async function assertAuthenticated(): Promise<{
  user: User;
  profile: Profile;
}> {
  if (!isSupabaseConfigured()) {
    throw new AppError(
      "Supabase no está configurado. Contacte al administrador del sistema.",
      {
        code: "SUPABASE_NOT_CONFIGURED",
        statusCode: 503,
      },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("Debe iniciar sesión para continuar.", {
      code: "UNAUTHENTICATED",
      statusCode: 401,
    });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new AppError(
      "Su cuenta no está activa o no tiene un perfil válido.",
      {
        code: "PROFILE_INACTIVE",
        statusCode: 403,
      },
    );
  }

  return { user, profile };
}

export async function assertPermission(
  permission: PermissionKey,
): Promise<{ user: User; profile: Profile }> {
  const { user, profile } = await assertAuthenticated();
  await requirePermission(user.id, permission);
  return { user, profile };
}
