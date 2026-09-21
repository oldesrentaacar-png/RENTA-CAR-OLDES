"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  draftToExtraLineItem,
  extraLineItemToDraft,
  lineAmountFromDraft,
  newExtraLineKey,
  sumExtraLineItems,
  type ExtraLineDraft,
  type ExtraLineItem,
} from "@/lib/billing/extra-lines";
import { formatMoney } from "@/lib/money";

export type BillingCatalogItem = {
  id: string;
  name_es: string;
  name_en?: string;
  description_es?: string | null;
  unit_price: number;
};

type BillingExtrasEditorProps = {
  catalogItems?: BillingCatalogItem[];
  lines: ExtraLineDraft[];
  onChange: (lines: ExtraLineDraft[]) => void;
  /** When set, also writes JSON to a hidden input for form posts. */
  hiddenFieldName?: string;
  disabled?: boolean;
  title?: string;
  hint?: string;
  emptyHint?: string;
};

export function draftsFromExtraItems(
  items: ExtraLineItem[] | null | undefined,
): ExtraLineDraft[] {
  const list = (items ?? []).filter((line) => line.label && line.amount > 0);
  if (list.length === 0) return [];
  return list.map(extraLineItemToDraft);
}

export function draftsToExtraItems(drafts: ExtraLineDraft[]): ExtraLineItem[] {
  return drafts
    .map(draftToExtraLineItem)
    .filter((line): line is ExtraLineItem => line != null);
}

export function BillingExtrasEditor({
  catalogItems = [],
  lines,
  onChange,
  hiddenFieldName,
  disabled = false,
  title = "Catálogo (extras / servicios)",
  hint = "Elija del catálogo o agregue una línea personalizada. Use cantidad (ej. 2 permisos, 3 días de seguro).",
  emptyHint = "Agregue líneas del catálogo o personalizadas para definir cada cobro.",
}: BillingExtrasEditorProps) {
  const [catalogSelect, setCatalogSelect] = useState("");

  const payload = useMemo(() => draftsToExtraItems(lines), [lines]);
  const sum = useMemo(() => sumExtraLineItems(payload), [payload]);

  function updateLine(key: string, patch: Partial<ExtraLineDraft>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    const next = lines.filter((line) => line.key !== key);
    onChange(next);
  }

  function addCustomLine() {
    onChange([
      ...lines,
      {
        key: newExtraLineKey(),
        label: "",
        quantity: "1",
        unitPrice: "",
      },
    ]);
  }

  function addFromCatalog(itemId: string) {
    const item = catalogItems.find((c) => c.id === itemId);
    if (!item) return;
    onChange([
      ...lines,
      {
        key: newExtraLineKey(),
        label: (item.description_es?.trim() || item.name_es).slice(0, 200),
        quantity: "1",
        unitPrice: String(item.unit_price ?? 0),
      },
    ]);
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <p className="mt-1 text-xs text-muted">{hint}</p>
      </div>

      {hiddenFieldName ? (
        <input
          type="hidden"
          name={hiddenFieldName}
          value={JSON.stringify(payload)}
        />
      ) : null}
      <input type="hidden" name="additionalCosts" value={String(sum)} />

      {!disabled ? (
        <div className="flex flex-wrap items-end gap-2">
          <SearchableSelect
            label="Catálogo (extras / servicios)"
            value={catalogSelect}
            onChange={(id) => {
              if (id) addFromCatalog(id);
              setCatalogSelect("");
            }}
            placeholder="Agregar artículo…"
            searchPlaceholder="Buscar ítem del catálogo…"
            className="min-w-[14rem] flex-1"
            options={catalogItems.map((item) => ({
              value: item.id,
              label: `${item.name_es} · ${formatMoney(item.unit_price)}`,
              searchText: `${item.name_es} ${item.name_en ?? ""} ${item.description_es ?? ""}`,
            }))}
          />
          <Button type="button" variant="secondary" onClick={addCustomLine}>
            Línea personalizada
          </Button>
        </div>
      ) : null}

      {lines.length === 0 ? (
        <p className="text-sm text-muted">{emptyHint}</p>
      ) : (
        <div className="space-y-3">
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-5">
                <label className="mb-1 block text-xs text-muted">
                  Descripción
                </label>
                <input
                  value={line.label}
                  disabled={disabled}
                  onChange={(e) => updateLine(line.key, { label: e.target.value })}
                  placeholder="Ej. Permiso de salida del país"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">Cant.</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={line.quantity}
                  disabled={disabled}
                  onChange={(e) =>
                    updateLine(line.key, { quantity: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">Precio</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  disabled={disabled}
                  onChange={(e) =>
                    updateLine(line.key, { unitPrice: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
                />
              </div>
              <div className="flex items-end justify-between gap-2 sm:col-span-3">
                <div>
                  <p className="text-xs text-muted">Importe</p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatMoney(lineAmountFromDraft(line))}
                  </p>
                </div>
                {!disabled ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(line.key)}
                  >
                    Quitar
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-muted">
        Suma extras: <strong>{formatMoney(sum)}</strong>
      </p>
    </div>
  );
}
