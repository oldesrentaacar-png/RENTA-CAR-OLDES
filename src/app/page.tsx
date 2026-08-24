import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const auth = await getSession();
    if (auth) {
      redirect("/dashboard");
    }
  }

  // Sitio público (Landing OLDES)
  redirect("/landing/");
}
