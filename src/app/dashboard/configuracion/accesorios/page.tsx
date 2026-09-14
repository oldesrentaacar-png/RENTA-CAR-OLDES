import Link from "next/link";

import { listAccessories } from "@/app/dashboard/configuracion/accesorios/queries";
import { AccessoryCatalogAdmin } from "@/components/forms/accessory-catalog-admin";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import type { AccessoryCatalogItem } from "@/types/database";

export default async function AccesoriosConfigPage() {
  const configured = isSupabaseConfigured();
  let items: AccessoryCatalogItem[] = [];
  let tableReady = false;
  let error: string | null = null;

  if (configured) {
    try {
      const result = await listAccessories();
      if (result.success) {
        items = result.data.items;
        tableReady = result.data.tableReady;
      } else {
        error = result.error;
      }
    } catch (err) {
      error = toUserMessage(err);
    }
  }

  return (
    <ModuleListShell
      title="Accesorios"
      description="Catálogo de accesorios para checklists e inspecciones."
      permission="settings.view"
      configured={configured}
      error={error}
      count={items.length}
      countLabel="accesorios"
      actions={
        <Link
          href="/dashboard/configuracion"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Volver a configuración
        </Link>
      }
    >
      {configured && !error ? (
        <AccessoryCatalogAdmin items={items} tableReady={tableReady} />
      ) : null}
    </ModuleListShell>
  );
}
