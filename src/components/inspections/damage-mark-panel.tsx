"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DAMAGE_SEVERITY_LABELS,
  DAMAGE_TYPE_DESCRIPTION_HINTS,
  DAMAGE_TYPE_OPTIONS,
} from "@/lib/inspections/defaults";
import type { DamageSeverity, DamageType } from "@/types/database";

import type { DamageMarkDraft } from "./damage-map-2d";

type DamageMarkPanelProps = {
  mark: DamageMarkDraft;
  onChange: (field: Partial<DamageMarkDraft>) => void;
  onRemove: () => void;
};

export function DamageMarkPanel({
  mark,
  onChange,
  onRemove,
}: DamageMarkPanelProps) {
  const descriptionHint =
    DAMAGE_TYPE_DESCRIPTION_HINTS[mark.damageType] ??
    "Descripción opcional del daño";

  return (
    <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
      <Select
        label="Tipo de daño"
        value={mark.damageType}
        onChange={(event) =>
          onChange({ damageType: event.target.value as DamageType })
        }
        options={DAMAGE_TYPE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />
      <Select
        label="Severidad (Leve / Media / Grave)"
        value={mark.severity}
        onChange={(event) =>
          onChange({ severity: event.target.value as DamageSeverity })
        }
        options={Object.entries(DAMAGE_SEVERITY_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <Input
        label="Descripción"
        className="sm:col-span-2"
        value={mark.description ?? ""}
        placeholder={descriptionHint}
        onChange={(event) => onChange({ description: event.target.value })}
      />
      {mark.damageType === "MISSING" ? (
        <p className="sm:col-span-2 text-xs text-muted">
          Faltante: indique qué pieza no está (tapón de bumper, cubierta de
          parabrisas, embellecedor, etc.).
        </p>
      ) : null}
      {mark.damageType === "OTHER" ? (
        <p className="sm:col-span-2 text-xs text-muted">
          Marcado libre: el trazo ya quedó dibujado en el diagrama. Use la
          descripción solo si quiere anotar un detalle adicional.
        </p>
      ) : null}
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => {
          const ok = window.confirm(
            `¿Eliminar la marca de daño #${mark.markNumber}?\n\nDeberá guardar el mapa de daños para confirmar el cambio.`,
          );
          if (!ok) return;
          onRemove();
        }}
      >
        Eliminar marca #{mark.markNumber}
      </Button>
    </div>
  );
}
