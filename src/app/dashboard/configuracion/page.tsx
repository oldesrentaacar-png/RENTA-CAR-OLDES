import Link from "next/link";
import { Car, Package } from "lucide-react";

import { getBusinessSettings } from "@/app/dashboard/configuracion/actions";
import { SettingsForm } from "@/components/forms/settings-form";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import type { BusinessSettings } from "@/types/database";

export default async function ConfiguracionPage() {
  const configured = isSupabaseConfigured();
  let settings: BusinessSettings | null = null;
  let error: string | null = null;

  if (configured) {
    try {
      const result = await getBusinessSettings();
      if (result.success) {
        settings = result.data;
      } else {
        error = result.error;
      }
    } catch (err) {
      error = toUserMessage(err);
    }
  }

  return (
    <ModuleListShell
      title="Configuración"
      description="Parámetros generales del negocio y documentos."
      permission="settings.view"
      configured={configured}
      error={error}
      count={settings ? 1 : 0}
      countLabel="registro de configuración"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/configuracion/tipos-vehiculo"
          className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          <Car className="mt-0.5 h-5 w-5 text-zinc-700" />
          <div>
            <p className="font-medium">Tipos de vehículo</p>
            <p className="text-sm text-muted">
              Catálogo y tarifas publicados en la landing.
            </p>
          </div>
        </Link>
        <Link
          href="/dashboard/configuracion/accesorios"
          className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          <Package className="mt-0.5 h-5 w-5 text-zinc-700" />
          <div>
            <p className="font-medium">Accesorios</p>
            <p className="text-sm text-muted">
              Catálogo configurable de accesorios de flota.
            </p>
          </div>
        </Link>
      </div>

      {configured && !error ? (
        <SettingsForm settings={settings} />
      ) : null}
    </ModuleListShell>
  );
}
