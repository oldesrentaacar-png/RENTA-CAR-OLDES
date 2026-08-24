/**
 * Verifies Supabase login + dashboard access using session cookies.
 * Usage: node --env-file=.env.local scripts/verify-dashboard-login.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

if (!url || !anonKey || !email || !password) {
  console.error("Missing env vars for login verification.");
  process.exit(1);
}

const authClient = createClient(url, anonKey);
const { data: signIn, error: signInError } =
  await authClient.auth.signInWithPassword({ email, password });

if (signInError || !signIn.session) {
  console.error("LOGIN_FAILED", signInError?.message ?? "no session");
  process.exit(1);
}

const cookieJar = new Map();

const supabase = createServerClient(url, anonKey, {
  cookies: {
    getAll() {
      return [...cookieJar.entries()].map(([name, value]) => ({ name, value }));
    },
    setAll(cookiesToSet) {
      for (const { name, value } of cookiesToSet) {
        cookieJar.set(name, value);
      }
    },
  },
});

await supabase.auth.setSession({
  access_token: signIn.session.access_token,
  refresh_token: signIn.session.refresh_token,
});

const cookieHeader = [...cookieJar.entries()]
  .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
  .join("; ");

const dashboardRes = await fetch(`${appUrl}/dashboard`, {
  redirect: "manual",
  headers: { cookie: cookieHeader },
});

const { data: profile } = await supabase
  .from("profiles")
  .select("status, email")
  .eq("id", signIn.user.id)
  .maybeSingle();

console.log(
  JSON.stringify({
    loginOk: true,
    profileStatus: profile?.status ?? null,
    dashboardStatus: dashboardRes.status,
    redirectedTo: dashboardRes.headers.get("location"),
    cookieCount: cookieJar.size,
  }),
);

if (dashboardRes.status >= 300 && dashboardRes.status < 400) {
  process.exit(1);
}
