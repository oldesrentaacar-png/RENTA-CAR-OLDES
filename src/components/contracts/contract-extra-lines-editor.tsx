"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { setContractExtraLineItems } from "@/app/dashboard/contratos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, parseMoneyInput } from "@/lib/money";

export type ExtraLineDraft = { label: string; amount: string };

type ContractExtraLinesEditorProps = {
  contractId: string;
  initialLines?: Array<{ label: string; amount: number }>;
  canEdit: boolean;
};

export function ContractExtraLinesEditor({
  contractId,
  initialLines = [],
  canEdit,
}: ContractExtraLinesEditorProps) {
  const router = useRouter();
  const [lines, setLines] = useState<ExtraLineDraft[]>(
    initialLines.length > 0
      ? initialLines.map((line) => ({
          label: line.label,
          amount: String(line.amount),
        }))
      : [{ label: "", amount: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const previewTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const amount = Number(parseMoneyInput(line.amount || "0"));
        return sum + (line.label.trim() && amount > 0 ? amount : 0);
      }, 0),
    [lines],
  );

  function updateLine(index: number, patch: Partial<ExtraLineDraft>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { label: "", amount: "" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ label: "", amount: "" }];
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setOk(null);
    const payload = lines
      .map((line) => ({
        label: line.label.trim(),
        amount: parseMoneyInput(line.amount || "0"),
      }))
      .filter((line) => line.label && line.amount > 0);

    const result = await setContractExtraLineItems(contractId, payload);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setOk(
      `Extras guardados. Total contrato: ${formatMoney(result.data.total)}`,
    );
    setLines(
      result.data.extraLineItems.length > 0
        ? result.data.extraLineItems.map((line) => ({
            label: line.label,
            amount: String(line.amount),
          }))
        : [{ label: "", amount: "" }],
    );
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Extras / cargos sueltos del contrato
        </h3>
        <p className="mt-1 text-xs text-muted">
          Agregue líneas libres (silla bebé, entrega especial, etc.). Se
          incluyen en el PDF y en el total
          {canEdit ? "" : " (solo lectura)"}.
        </p>
      </div>

      <div className="space-y-2">
        {lines.map((line, index) => (
          <div
            key={`extra-${index}`}
            className="grid gap-2 sm:grid-cols-[1fr_140px_auto]"
          >
            <Input
              label={index === 0 ? "Concepto" : undefined}
              value={line.label}
              disabled={!canEdit || saving}
              placeholder="Ej. Silla bebé / Entrega aeropuerto"
              onChange={(e) => updateLine(index, { label: e.target.value })}
            />
            <Input
              label={index === 0 ? "Monto USD" : undefined}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={line.amount}
              disabled={!canEdit || saving}
              placeholder="0.00"
              onChange={(e) => updateLine(index, { amount: e.target.value })}
            />
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                className="sm:mt-6"
                disabled={saving}
                onClick={() => removeLine(index)}
              >
                Quitar
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      <p className="text-sm text-muted">
        Suma extras: <strong>{formatMoney(previewTotal)}</strong>
      </p>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addLine} disabled={saving}>
            Agregar línea
          </Button>
          <Button type="button" onClick={() => void handleSave()} loading={saving}>
            Guardar extras
          </Button>
        </div>
      ) : null}
    </div>
  );
}
