"use client";

import { announceError, announceSuccess } from "@/lib/ui/announce";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateContract } from "@/app/dashboard/contratos/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ContractObservationsBoxProps = {
  contractId: string;
  notes: string;
  canEdit: boolean;
};

export function ContractObservationsBox({
  contractId,
  notes,
  canEdit,
}: ContractObservationsBoxProps) {
  const router = useRouter();
  const [value, setValue] = useState(notes);
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const formData = new FormData();
    formData.set("notes", value);
    const result = await updateContract(contractId, formData);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSaved(true);
    announceSuccess("Observaciones guardadas.");
    router.refresh();
  }

  return (
    <div className="sm:col-span-2 rounded-xl border-2 border-brand/40 bg-brand/5 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
        4. Observaciones (PDF del contrato)
      </p>
      <p className="mt-1 text-xs text-muted">
        Un solo cuadro, igual que en el contrato de papel. Lo que escriba aquí
        sale en el PDF.
      </p>
      {canEdit ? (
        <div className="mt-2 space-y-2">
          <Textarea
            rows={4}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSaved(false);
            }}
            placeholder="Ej.: combustible casi lleno (7/8), rayón en puerta, acuerdo con el cliente…"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" onClick={() => void save()} loading={saving}>
              Guardar observaciones
            </Button>
            {saved ? (
              <span className="text-sm text-green-800">Guardadas en el contrato y en el PDF.</span>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm">
          {value.trim() || "Sin observaciones."}
        </p>
      )}
    </div>
  );
}
