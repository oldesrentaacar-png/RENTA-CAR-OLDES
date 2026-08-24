"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createPaymentReceipt,
  createPaymentRefund,
  getReceiptWhatsAppLink,
} from "@/app/dashboard/recibos/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatAppDate } from "@/lib/dates";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import type { PaymentReceipt } from "@/types/database";

type ContractReceiptsSectionProps = {
  contractId: string;
  customerId: string;
  canCreate: boolean;
  receipts: PaymentReceipt[];
  amountPaid?: number;
  balanceDue?: number;
  total?: number;
};

const PAYMENT_OPTIONS = [
  { value: "CASH", label: PAYMENT_METHOD_LABELS.CASH },
  { value: "CARD", label: PAYMENT_METHOD_LABELS.CARD },
  { value: "TRANSFER", label: PAYMENT_METHOD_LABELS.TRANSFER },
];

function receiptKindLabel(kind?: PaymentReceipt["receipt_kind"]) {
  return kind === "REFUND" ? "Devolución" : "Abono";
}

export function ContractReceiptsSection({
  contractId,
  customerId,
  canCreate,
  receipts,
  amountPaid,
  balanceDue,
  total,
}: ContractReceiptsSectionProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showRefundForm, setShowRefundForm] = useState(false);

  async function handleCreatePayment(formData: FormData) {
    setError(null);
    setMessage(null);
    formData.set("contractId", contractId);
    formData.set("customerId", customerId);
    formData.set("createIncome", "true");
    formData.set("incomeType", "RENTAL");

    const result = await createPaymentReceipt(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage(`Recibo ${result.data.code} registrado.`);
    router.refresh();
  }

  async function handleCreateRefund(formData: FormData) {
    setError(null);
    setMessage(null);
    formData.set("contractId", contractId);
    formData.set("customerId", customerId);

    const result = await createPaymentRefund(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage(`Devolución ${result.data.code} registrada.`);
    setShowRefundForm(false);
    router.refresh();
  }

  async function handleWhatsApp(receiptId: string) {
    setError(null);
    const result = await getReceiptWhatsAppLink(receiptId);
    if (!result.success) {
      setError(result.error);
      return;
    }
    window.open(result.data.url, "_blank");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Abonos / Devoluciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {(amountPaid !== undefined || balanceDue !== undefined) && (
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            {total !== undefined ? (
              <p>
                <span className="text-muted">Total contrato:</span>{" "}
                {formatMoney(total)}
              </p>
            ) : null}
            {amountPaid !== undefined ? (
              <p>
                <span className="text-muted">Abonado:</span>{" "}
                {formatMoney(amountPaid)}
              </p>
            ) : null}
            {balanceDue !== undefined ? (
              <p>
                <span className="text-muted">Saldo:</span>{" "}
                {formatMoney(balanceDue)}
              </p>
            ) : null}
          </div>
        )}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </div>
        ) : null}

        {receipts.length === 0 ? (
          <p className="text-sm text-muted">
            Aún no hay abonos ni devoluciones registrados para este contrato.
          </p>
        ) : (
          <ul className="space-y-3">
            {receipts.map((receipt) => {
              const isRefund = receipt.receipt_kind === "REFUND";
              return (
                <li
                  key={receipt.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {receipt.code} · {formatMoney(receipt.amount)}
                      </p>
                      <Badge variant={isRefund ? "warning" : "brand"}>
                        {receiptKindLabel(receipt.receipt_kind)}
                      </Badge>
                    </div>
                    <p className="text-muted">
                      {formatAppDate(receipt.issued_at)} · {receipt.concept} ·{" "}
                      {PAYMENT_METHOD_LABELS[receipt.payment_method]}
                    </p>
                    <p className="text-muted">
                      Saldo tras movimiento:{" "}
                      {formatMoney(receipt.balance_remaining)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/receipts/${receipt.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-muted"
                    >
                      Ver PDF
                    </a>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleWhatsApp(receipt.id)}
                    >
                      WhatsApp
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canCreate ? (
          <div className="space-y-4 border-t border-border pt-4">
            <form action={handleCreatePayment} className="space-y-4">
              <h3 className="text-sm font-semibold">Registrar abono</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  name="amount"
                  label="Monto *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                />
                <Select
                  name="paymentMethod"
                  label="Método *"
                  options={PAYMENT_OPTIONS}
                  defaultValue="CASH"
                  required
                />
                <div className="sm:col-span-2">
                  <Input
                    name="concept"
                    label="Concepto *"
                    defaultValue="Abono"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Textarea name="notes" label="Notas" rows={2} />
                </div>
              </div>
              <SubmitButton>Registrar abono</SubmitButton>
            </form>

            {!showRefundForm ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowRefundForm(true)}
                disabled={(amountPaid ?? 0) <= 0}
              >
                Registrar devolución
              </Button>
            ) : (
              <form action={handleCreateRefund} className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-amber-900">
                    Registrar devolución
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowRefundForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
                {amountPaid !== undefined && amountPaid > 0 ? (
                  <p className="text-sm text-amber-800">
                    Máximo devolvable: {formatMoney(amountPaid)} (según abonos
                    del contrato).
                  </p>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    name="amount"
                    label="Monto a devolver *"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={amountPaid ?? undefined}
                    required
                  />
                  <Select
                    name="paymentMethod"
                    label="Método *"
                    options={PAYMENT_OPTIONS}
                    defaultValue="CASH"
                    required
                  />
                  <div className="sm:col-span-2">
                    <Input
                      name="concept"
                      label="Concepto *"
                      defaultValue="Devolución — día menos / cortesía"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Textarea name="notes" label="Notas" rows={2} />
                  </div>
                </div>
                <SubmitButton variant="secondary">
                  Confirmar devolución
                </SubmitButton>
              </form>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
