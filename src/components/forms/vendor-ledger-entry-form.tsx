"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createVendorLedgerEntry } from "@/app/dashboard/proveedores/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VENDOR_LEDGER_KIND_LABELS } from "@/lib/labels";

type VendorLedgerEntryFormProps = {
  vendorId: string;
};

const KIND_OPTIONS = Object.entries(VENDOR_LEDGER_KIND_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function VendorLedgerEntryForm({ vendorId }: VendorLedgerEntryFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

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
    <form action={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <input type="hidden" name="vendorId" value={vendorId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          name="kind"
          label="Tipo *"
          defaultValue="CHARGE"
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
        <Input name="concept" label="Concepto *" required />
      </div>

      <Textarea name="notes" label="Notas" rows={2} />

      <SubmitButton>Agregar movimiento</SubmitButton>
    </form>
  );
}
