"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  updatePaymentReceiptMeta,
  voidPaymentReceipt,
} from "@/app/dashboard/recibos/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import type { PaymentReceipt } from "@/types/database";

const PAYMENT_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function ReceiptCorrectForm({
  receipt,
  canVoid,
}: {
  receipt: PaymentReceipt;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [pendingVoid, setPendingVoid] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await updatePaymentReceiptMeta(receipt.id, formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/recibos");
    router.refresh();
  }

  async function handleVoid() {
    const ok = window.confirm(
      `¿Anular el recibo ${receipt.code}?\n\nSe revertirá el saldo del contrato y el ingreso ligado. Esta acción no se puede deshacer desde la app.`,
    );
    if (!ok) return;
    setPendingVoid(true);
    setError(null);
    const result = await voidPaymentReceipt(receipt.id);
    setPendingVoid(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/recibos");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm">
        <p>
          <span className="text-muted">Número:</span> {receipt.code}
        </p>
        <p>
          <span className="text-muted">Monto (no editable):</span>{" "}
          {formatMoney(receipt.amount)}
        </p>
        <p className="mt-2 text-xs text-muted">
          El monto no se corrige aquí. Para cambiar el monto: Anular y registrar
          un recibo nuevo desde el contrato.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <Input
          name="concept"
          label="Concepto *"
          defaultValue={receipt.concept}
          required
        />
        <Select
          name="paymentMethod"
          label="Método de pago *"
          defaultValue={receipt.payment_method}
          options={PAYMENT_OPTIONS}
          required
        />
        <Textarea
          name="notes"
          label="Notas"
          rows={3}
          defaultValue={receipt.notes ?? ""}
        />
        <div className="flex flex-wrap gap-3">
          <SubmitButton>Guardar corrección</SubmitButton>
          <Link
            href="/dashboard/recibos"
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
          >
            Cancelar
          </Link>
        </div>
      </form>

      {canVoid ? (
        <div className="border-t border-border pt-4">
          <Button
            type="button"
            variant="danger"
            disabled={pendingVoid}
            onClick={() => void handleVoid()}
          >
            {pendingVoid ? "Anulando…" : "Anular recibo"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
