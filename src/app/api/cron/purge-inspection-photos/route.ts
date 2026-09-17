import { NextResponse } from "next/server";

import { purgeOldInspectionPhotos } from "@/lib/storage/purge-inspection-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily retention job: delete inspection photos older than 90 days.
 * Secure with CRON_SECRET (Authorization: Bearer …) or Vercel Cron header.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") ?? "";
  const vercelCron = request.headers.get("x-vercel-cron");

  const authorized =
    Boolean(vercelCron) ||
    (secret ? auth === `Bearer ${secret}` : false);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await purgeOldInspectionPhotos(90);
  return NextResponse.json({
    ok: result.errors.length === 0,
    retentionDays: 90,
    ...result,
  });
}
