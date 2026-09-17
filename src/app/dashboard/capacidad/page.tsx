import { Gauge } from "lucide-react";

import { CapacityDashboard } from "@/components/dashboard/capacity-dashboard";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { collectCapacitySnapshot } from "@/lib/capacity/measure-usage";
import { isSupabaseConfigured } from "@/lib/env";
import { toUserMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function CapacidadPage() {
  const configured = isSupabaseConfigured();
  let error: string | null = null;
  let snapshot = null;

  if (configured) {
    try {
      snapshot = await collectCapacitySnapshot();
    } catch (err) {
      error = toUserMessage(err);
    }
  }

  return (
    <ModuleListShell
      title="Capacidad y uso"
      description="Cupos Free/Hobby, % usado, cuántas rentas soporta el sistema y detalle por plataforma."
      permission="settings.view"
      configured={configured}
      error={error}
      count={snapshot?.meters.length ?? 0}
      countLabel="métricas de capacidad"
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted">
          <Gauge className="h-3.5 w-3.5" />
          Planes Free / Hobby
        </span>
      }
    >
      {snapshot ? <CapacityDashboard snapshot={snapshot} /> : null}
    </ModuleListShell>
  );
}
