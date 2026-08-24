import Link from "next/link";

import { listAccessories } from "@/app/dashboard/configuracion/accesorios/actions";
import { AccessoryCatalogAdmin } from "@/components/forms/accessory-catalog-admin";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { isSupabaseConfigured } from "@/lib/env";

export default async function AccesoriosConfigPage() {
  const configured = isSupabaseConfigured();
  const result = configured ? await listAccessories() : null;
  const items = result?.success ? result.data.items : [];
  const tableReady = result?.success ? result.data.tableReady : false;
  const error = result && !result.success ? result.error : null;

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
