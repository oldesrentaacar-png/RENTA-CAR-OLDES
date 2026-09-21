import { createClient } from "@/lib/supabase/server";
import type { BillingCatalogItem } from "@/components/shared/billing-extras-editor";

/** Active quote catalog rows for reservation/contract extras pickers. */
export async function loadBillingCatalogItems(): Promise<BillingCatalogItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quote_catalog_items")
      .select("id, name_es, name_en, description_es, unit_price")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order");
    if (error || !data) return [];
    return (
      data as Array<{
        id: string;
        name_es: string;
        name_en: string;
        description_es: string | null;
        unit_price: number;
      }>
    ).map((row) => ({
      id: row.id,
      name_es: row.name_es,
      name_en: row.name_en,
      description_es: row.description_es,
      unit_price: Number(row.unit_price ?? 0),
    }));
  } catch {
    return [];
  }
}
