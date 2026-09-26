"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { voidPaymentReceipt } from "@/app/dashboard/recibos/actions";
import { Button } from "@/components/ui/button";
import { receiptPdfHref } from "@/lib/pdf/pdf-cache";

type ReceiptListActionsProps = {
  receiptId: string;
  receiptCode: string;
  contractId: string | null;
  updatedAt: string;
  canEdit: boolean;
  canVoid: boolean;
};

export function ReceiptListActions({
  receiptId,
  receiptCode,
  contractId,
  updatedAt,
  canEdit,
  canVoid,
}: ReceiptListActionsProps) {
  const router = useRouter();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [pending, setPending] = useState(false);

  async function handleVoid() {
    const ok = window.confirm(
      `¿Anular el recibo ${receiptCode}?\n\nSe revertirá el saldo del contrato y el ingreso ligado. Para corregir el monto, anule y registre un recibo nuevo.`,
    );
    if (!ok) return;
    setPending(true);
    setError(null);
    const result = await voidPaymentReceipt(receiptId);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {contractId ? (
          <Link
            href={`/dashboard/contratos/${contractId}`}
            className="text-sm text-brand hover:underline"
          >
            Contrato
          </Link>
        ) : null}
        <a
          href={receiptPdfHref(receiptId, updatedAt)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-brand hover:underline"
        >
          PDF
        </a>
        {canEdit ? (
          <Link
            href={`/dashboard/recibos/${receiptId}/edit`}
            className="text-sm font-medium text-zinc-700 hover:underline"
          >
            Corregir
          </Link>
        ) : null}
        {canVoid ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => void handleVoid()}
          >
            {pending ? "Anulando…" : "Anular"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="max-w-[16rem] text-right text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
