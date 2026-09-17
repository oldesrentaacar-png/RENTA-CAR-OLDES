/**
 * Purge inspection photos older than N days from private storage + DB rows.
 * Keeps PDF annex history for recent rentals; frees B2 space after retention.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { isR2Configured, isSupabaseAdminConfigured } from "@/lib/env";
import { deleteFromR2 } from "@/lib/storage/r2";
import {
  INSPECTION_PHOTOS_BUCKET,
} from "@/lib/storage/private-upload";

export const INSPECTION_PHOTO_RETENTION_DAYS = 90;

export type PurgeInspectionPhotosResult = {
  scanned: number;
  deletedDb: number;
  deletedStorage: number;
  errors: string[];
};

export async function purgeOldInspectionPhotos(
  retentionDays = INSPECTION_PHOTO_RETENTION_DAYS,
): Promise<PurgeInspectionPhotosResult> {
  const result: PurgeInspectionPhotosResult = {
    scanned: 0,
    deletedDb: 0,
    deletedStorage: 0,
    errors: [],
  };

  if (!isSupabaseAdminConfigured()) {
    result.errors.push("Supabase admin no configurado.");
    return result;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(1, retentionDays));
  const cutoffIso = cutoff.toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("inspection_photos")
    .select("id, storage_path, created_at")
    .lt("created_at", cutoffIso)
    .limit(500);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const rows = (data ?? []) as Array<{
    id: string;
    storage_path: string;
    created_at: string;
  }>;
  result.scanned = rows.length;

  for (const row of rows) {
    try {
      const path = row.storage_path;
      if (path.startsWith("r2://") && isR2Configured()) {
        await deleteFromR2(path.slice("r2://".length));
        result.deletedStorage += 1;
      } else if (path && !path.startsWith("data:")) {
        const { error: storageError } = await admin.storage
          .from(INSPECTION_PHOTOS_BUCKET)
          .remove([path]);
        if (!storageError) result.deletedStorage += 1;
      }

      const { error: delError } = await admin
        .from("inspection_photos")
        .delete()
        .eq("id", row.id);
      if (delError) {
        result.errors.push(`${row.id}: ${delError.message}`);
      } else {
        result.deletedDb += 1;
      }
    } catch (err) {
      result.errors.push(
        `${row.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
