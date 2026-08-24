import Link from "next/link";

import { listVehicleTypesAdmin } from "@/app/dashboard/configuracion/tipos-vehiculo/actions";
import { VehicleTypesAdmin } from "@/components/forms/vehicle-types-admin";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { isSupabaseConfigured } from "@/lib/env";

export default async function TiposVehiculoConfigPage() {
  const configured = isSupabaseConfigured();
  const result = configured ? await listVehicleTypesAdmin() : null;
  const items = result?.success ? result.data.items : [];
  const tableReady = result?.success ? result.data.tableReady : false;
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Tipos de vehículo"
      description="Catálogo público de tipos y tarifas para la landing."
      permission="settings.view"
      configured={configured}
      error={error}
      count={items.length}
      countLabel="tipos"
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
        <VehicleTypesAdmin items={items} tableReady={tableReady} />
      ) : null}
    </ModuleListShell>
  );
}
