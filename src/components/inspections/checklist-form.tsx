"use client";

import { useEffect, useState } from "react";

import { saveChecklistItems } from "@/app/dashboard/inspecciones/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHECKLIST_STATUS_LABELS } from "@/lib/inspections/defaults";
import { cn } from "@/lib/utils";
import type { ChecklistItemStatus, InspectionChecklistItem } from "@/types/database";

export type ChecklistItemDraft = {
  itemKey: string;
  label: string;
  status: ChecklistItemStatus;
  notes?: string;
};

type ChecklistFormProps = {
  inspectionId: string;
  items: InspectionChecklistItem[] | ChecklistItemDraft[];
  readOnly?: boolean;
  /** When true, parent handles persistence (combined save). */
  hideSaveButton?: boolean;
  onDraftsChange?: (drafts: ChecklistItemDraft[]) => void;
};

const QUICK_STATUSES: {
  value: ChecklistItemStatus;
  mark: string;
  label: string;
  activeClass: string;
}[] = [
  {
    value: "OK",
    mark: "✓",
    label: "Está",
    activeClass: "border-green-600 bg-green-50 text-green-800",
  },
  {
    value: "MISSING",
    mark: "✗",
    label: "No está",
    activeClass: "border-red-600 bg-red-50 text-red-800",
  },
  {
    value: "DAMAGED",
    mark: "○",
    label: "Averiado",
    activeClass: "border-amber-600 bg-amber-50 text-amber-900",
  },
  {
    value: "NOT_APPLICABLE",
    mark: "—",
    label: "N/A",
    activeClass: "border-slate-500 bg-slate-100 text-slate-700",
  },
];

function toDraft(item: InspectionChecklistItem | ChecklistItemDraft): ChecklistItemDraft {
  if ("item_name" in item) {
    return {
      itemKey: item.item_name.toLowerCase().replace(/\s+/g, "_"),
      label: item.item_name,
      status: item.status,
      notes: item.notes ?? undefined,
    };
  }
  return item;
}

export function ChecklistForm({
  inspectionId,
  items,
  readOnly,
  hideSaveButton,
  onDraftsChange,
}: ChecklistFormProps) {
  const [drafts, setDrafts] = useState<ChecklistItemDraft[]>(() =>
    items.map(toDraft),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onDraftsChange?.(drafts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateDrafts(
    updater: (current: ChecklistItemDraft[]) => ChecklistItemDraft[],
  ) {
    setDrafts((current) => {
      const next = updater(current);
      onDraftsChange?.(next);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const result = await saveChecklistItems(
      inspectionId,
      JSON.stringify(
        drafts.map((item) => ({
          itemKey: item.itemKey,
          label: item.label,
          status: item.status,
          notes: item.notes,
        })),
      ),
    );

    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      {error && !hideSaveButton ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {saved && !hideSaveButton ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Checklist guardado.
        </div>
      ) : null}

      <p className="text-sm text-muted">
        Toque el chequeo: está / no está / averiado. Pensado para entrega rápida
        en aeropuerto.
      </p>

      <div className="space-y-2">
        {drafts.map((item, index) => (
          <div
            key={item.itemKey}
            className="rounded-xl border border-border bg-white p-3 sm:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 flex-1 font-medium text-foreground">
                {item.label}
              </p>
              {readOnly ? (
                <p className="text-sm font-semibold">
                  {CHECKLIST_STATUS_LABELS[item.status] ?? item.status}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {QUICK_STATUSES.map((opt) => {
                    const active = item.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          updateDrafts((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, status: opt.value }
                                : row,
                            ),
                          )
                        }
                        className={cn(
                          "inline-flex min-h-11 min-w-[4.5rem] flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 text-xs font-bold touch-manipulation",
                          active
                            ? opt.activeClass
                            : "border-border bg-surface-muted text-muted hover:border-brand/40",
                        )}
                      >
                        <span className="text-base leading-none">{opt.mark}</span>
                        <span className="mt-0.5">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {!readOnly ? (
              <div className="mt-2">
                <Textarea
                  label="Notas (opcional)"
                  rows={1}
                  value={item.notes ?? ""}
                  onChange={(event) =>
                    updateDrafts((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, notes: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
              </div>
            ) : item.notes ? (
              <p className="mt-2 text-sm text-muted">{item.notes}</p>
            ) : null}
          </div>
        ))}
      </div>

      {!readOnly && !hideSaveButton ? (
        <Button type="button" onClick={handleSave} loading={saving}>
          Guardar checklist
        </Button>
      ) : null}
    </div>
  );
}
