function trimEnv(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

/**
 * NEXT_PUBLIC_* vars MUST use static `process.env.NEXT_PUBLIC_*` access.
 * Dynamic `process.env[key]` is not inlined in the client bundle by Next.js.
 */
export const env = {
  NEXT_PUBLIC_APP_URL: trimEnv(process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_LANDING_URL: trimEnv(process.env.NEXT_PUBLIC_LANDING_URL),
  NEXT_PUBLIC_SUPABASE_URL: trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  SUPABASE_SERVICE_ROLE_KEY:
    trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    trimEnv(process.env.SUPABASE_SECRET_KEY),
  SUPABASE_DB_PASSWORD: trimEnv(process.env.SUPABASE_DB_PASSWORD),
  DATABASE_URL: trimEnv(process.env.DATABASE_URL),
  RESEND_API_KEY: trimEnv(process.env.RESEND_API_KEY),
  EMAIL_FROM: trimEnv(process.env.EMAIL_FROM),
  CLOUDINARY_CLOUD_NAME: trimEnv(process.env.CLOUDINARY_CLOUD_NAME),
  CLOUDINARY_API_KEY: trimEnv(process.env.CLOUDINARY_API_KEY),
  CLOUDINARY_API_SECRET: trimEnv(process.env.CLOUDINARY_API_SECRET),
  LANDING_ALLOWED_ORIGIN: trimEnv(process.env.LANDING_ALLOWED_ORIGIN),
  /** Cloudflare R2 (S3-compatible) — archivos privados */
  R2_ACCOUNT_ID: trimEnv(process.env.R2_ACCOUNT_ID),
  R2_ACCESS_KEY_ID: trimEnv(process.env.R2_ACCESS_KEY_ID),
  R2_SECRET_ACCESS_KEY: trimEnv(process.env.R2_SECRET_ACCESS_KEY),
  R2_BUCKET:
    trimEnv(process.env.R2_BUCKET) || trimEnv(process.env.R2_BUCKET_NAME),
  R2_ENDPOINT: trimEnv(process.env.R2_ENDPOINT),
  R2_PUBLIC_BASE_URL: trimEnv(process.env.R2_PUBLIC_BASE_URL),
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_SECRET,
  );
}

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET,
  );
}

export function requireSupabasePublicEnv(): {
  url: string;
  anonKey: string;
} {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase no está configurado. Defina NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { url, anonKey };
}

export function requireSupabaseAdminEnv(): {
  url: string;
  serviceRoleKey: string;
} {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin no está configurado. Defina NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return { url, serviceRoleKey };
}
