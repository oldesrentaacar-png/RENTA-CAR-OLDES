"use client";

import { announceError } from "@/lib/ui/announce";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { setContractExtraLineItems } from "@/app/dashboard/contratos/actions";
import {
  BillingExtrasEditor,
  draftsFromExtraItems,
  draftsToExtraItems,
  type BillingCatalogItem,
} from "@/components/shared/billing-extras-editor";
import { Button } from "@/components/ui/button";
import {
  formatExtraLineDetail,
  type ExtraLineDraft,
  type ExtraLineItem,
} from "@/lib/billing/extra-lines";
import { formatMoney } from "@/lib/money";

type ContractExtraLinesEditorProps = {
  contractId: string;
  initialLines?: ExtraLineItem[];
  catalogItems?: BillingCatalogItem[];
  canEdit: boolean;
};

export function ContractExtraLinesEditor({
  contractId,
  initialLines = [],
  catalogItems = [],
  canEdit,
}: ContractExtraLinesEditorProps) {
  const router = useRouter();
  const [lines, setLines] = useState<ExtraLineDraft[]>(
    draftsFromExtraItems(initialLines),
  );
  const [saving, setSaving] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [ok, setOk] = useState<string | null>(null);

  const previewTotal = useMemo(
    () => draftsToExtraItems(lines).reduce((sum, line) => sum + line.amount, 0),
    [lines],
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    setOk(null);
    const payload = draftsToExtraItems(lines);

    const result = await setContractExtraLineItems(contractId, payload);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setOk(
      `Extras guardados. Total contrato: ${formatMoney(result.data.total)}`,
    );
    setLines(draftsFromExtraItems(result.data.extraLineItems));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <BillingExtrasEditor
        catalogItems={catalogItems}
        lines={lines}
        onChange={setLines}
        disabled={!canEdit || saving}
        title="Catálogo (extras / servicios) — sección 1"
        hint={
          canEdit
            ? "Defina cada cobro (silla, motorista, permiso, seguro…). Editable hasta cerrar o anular el contrato."
            : "Solo lectura: el contrato ya está cerrado o cancelado."
        }
      />

      {canEdit && lines.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted">
          {draftsToExtraItems(lines).map((line, index) => (
            <li key={`${line.label}-${index}`}>
              {line.label}: {formatExtraLineDetail(line)} ={" "}
              {formatMoney(line.amount)}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-sm text-muted">
        Vista previa suma: <strong>{formatMoney(previewTotal)}</strong>
      </p>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void handleSave()}
            loading={saving}
          >
            Guardar extras
          </Button>
        </div>
      ) : null}
    </div>
  );
}
