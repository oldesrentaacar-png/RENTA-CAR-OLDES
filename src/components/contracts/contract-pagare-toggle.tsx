"use client";

import { announceError, announceSuccess } from "@/lib/ui/announce";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { setContractIncludePagare } from "@/app/dashboard/contratos/actions";

type ContractPagareToggleProps = {
  contractId: string;
  includePagare: boolean;
  /** When false, checkbox is read-only. */
  canEdit?: boolean;
  className?: string;
};

/**
 * Include/exclude the mercantil promissory page in the contract PDF.
 * Visible until the contract is completed/cancelled — not only before signing.
 */
export function ContractPagareToggle({
  contractId,
  includePagare: includePagareProp,
  canEdit = true,
  className,
}: ContractPagareToggleProps) {
  const router = useRouter();
  const [includePagare, setIncludePagare] = useState(Boolean(includePagareProp));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIncludePagare(Boolean(includePagareProp));
  }, [includePagareProp]);

  async function handleToggle(next: boolean) {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    const result = await setContractIncludePagare(contractId, next);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      announceError(result.error);
      return;
    }
    setIncludePagare(result.data.includePagare);
    announceSuccess(
      result.data.includePagare
        ? "Pagaré incluido en el PDF."
        : "Pagaré quitado del PDF.",
    );
    router.refresh();
  }

  return (
    <div
      className={
        className ??
        "space-y-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-4"
      }
    >
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-brand"
          checked={includePagare}
          disabled={!canEdit || saving}
          onChange={(event) => void handleToggle(event.target.checked)}
        />
        <span>
          <strong className="text-amber-950">
            Incluir pagaré mercantil en el PDF
          </strong>
          <span className="mt-1 block text-xs text-amber-900">
            Si lo desmarca, el PDF NO lleva página de pagaré. El monto, cuando
            se incluye, sale en blanco (líneas) para completar a mano.
            {saving ? " Guardando…" : ""}
          </span>
        </span>
      </label>
      {error ? (
        <p className="text-xs font-medium text-red-700">{error}</p>
      ) : null}
      <p className="text-xs font-semibold text-amber-950">
        Estado actual:{" "}
        {includePagare ? "CON pagaré" : "SIN pagaré"}
      </p>
    </div>
  );
}
