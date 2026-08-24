"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DAMAGE_SEVERITY_LABELS,
  DAMAGE_TYPE_LABELS,
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
  return (
    <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
      <Select
        label="Tipo de daño"
        value={mark.damageType}
        onChange={(event) =>
          onChange({ damageType: event.target.value as DamageType })
        }
        options={Object.entries(DAMAGE_TYPE_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <Select
        label="Severidad"
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
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <Button type="button" variant="danger" size="sm" onClick={onRemove}>
        Eliminar marca #{mark.markNumber}
      </Button>
    </div>
  );
}
