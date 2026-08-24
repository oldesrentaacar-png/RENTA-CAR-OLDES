import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured, requireSupabasePublicEnv } from "@/lib/env";

export type SessionUpdateResult = {
  response: NextResponse;
  user: User | null;
};

export async function updateSession(
  request: NextRequest,
): Promise<SessionUpdateResult> {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!isSupabaseConfigured()) {
    return { response, user: null };
  }

  const { url, anonKey } = requireSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
