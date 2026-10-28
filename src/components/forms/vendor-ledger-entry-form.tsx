"use client";

import { announceError } from "@/lib/ui/announce";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createVendorLedgerEntry } from "@/app/dashboard/proveedores/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { appTodayDateString } from "@/lib/dates";
import { VENDOR_LEDGER_KIND_LABELS } from "@/lib/labels";

type VendorChargeOption = {
  settlementId: string;
  contractId: string | null;
  label: string;
  concept: string;
};

type VendorLedgerEntryFormProps = {
  vendorId: string;
  charges: VendorChargeOption[];
};

const KIND_OPTIONS = Object.entries(VENDOR_LEDGER_KIND_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function VendorLedgerEntryForm({
  vendorId,
  charges,
}: VendorLedgerEntryFormProps) {
  const router = useRouter();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [kind, setKind] = useState("CHARGE");
  const [settlementId, setSettlementId] = useState("");
  const [contractId, setContractId] = useState("");
  const [concept, setConcept] = useState("");
  const today = appTodayDateString();

  function conceptForCharge(chargeConcept: string, nextKind: string) {
    const text = nextKind === "PAYMENT" ? `Pago · ${chargeConcept}` : chargeConcept;
    return text.slice(0, 400);
  }

  function selectCharge(nextSettlementId: string, nextKind = kind) {
    setSettlementId(nextSettlementId);
    const charge = charges.find((item) => item.settlementId === nextSettlementId);
    if (!charge) {
      setContractId("");
      return;
    }
    setContractId(charge.contractId ?? "");
    setConcept(conceptForCharge(charge.concept, nextKind));
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createVendorLedgerEntry(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-4 print:hidden">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <p className="text-sm text-muted">
        Cargo: lo que se le debe por una renta. Pago: el dinero que ya se le
        entregó. Si elige una renta, el movimiento queda ligado a ese contrato,
        vehículo y fechas.
      </p>
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="settlementId" value={settlementId} />
      <input type="hidden" name="contractId" value={contractId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          name="kind"
          label="Tipo *"
          value={kind}
          onChange={(event) => {
            const nextKind = event.target.value;
            setKind(nextKind);
            if (settlementId) selectCharge(settlementId, nextKind);
          }}
          options={KIND_OPTIONS}
          required
        />
        <Input
          name="amount"
          label="Monto *"
          type="number"
          min="0"
          step="0.01"
          required
        />
        <Input
          name="entryDate"
          label="Fecha *"
          type="date"
          defaultValue={today}
          required
        />
        <Input
          name="concept"
          label="Concepto *"
          value={concept}
          onChange={(event) => setConcept(event.target.value)}
          required
        />
      </div>

      {charges.length > 0 ? (
        <Select
          label="Renta de este movimiento"
          value={settlementId}
          onChange={(event) => selectCharge(event.target.value)}
          options={[
            { value: "", label: "Sin renta específica" },
            ...charges.map((charge) => ({
              value: charge.settlementId,
              label: charge.label,
            })),
          ]}
        />
      ) : null}

      <Textarea name="notes" label="Notas" rows={2} />

      <SubmitButton>Agregar movimiento</SubmitButton>
    </form>
  );
}
