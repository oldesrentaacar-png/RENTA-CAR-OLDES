import Link from "next/link";

import { listVehicleTypesAdmin } from "@/app/dashboard/configuracion/tipos-vehiculo/queries";
import { VehicleTypesAdmin } from "@/components/forms/vehicle-types-admin";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import type { VehicleType } from "@/types/database";

export default async function TiposVehiculoConfigPage() {
  const configured = isSupabaseConfigured();
  let items: VehicleType[] = [];
  let tableReady = false;
  let error: string | null = null;

  if (configured) {
    try {
      const result = await listVehicleTypesAdmin();
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
