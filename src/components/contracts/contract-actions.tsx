"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  cancelContract,
  signContract,
  updateContract,
} from "@/app/dashboard/contratos/actions";
import type { ContractDetail } from "@/app/dashboard/contratos/actions";
import { SignaturePad } from "@/components/contracts/signature-pad";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type ContractDetailActionsProps = {
  contract: ContractDetail;
  canEdit: boolean;
  canSign: boolean;
  canCancel: boolean;
  operatorName?: string | null;
};

export function ContractDetailActions({
  contract,
  canEdit,
  canSign,
  canCancel,
  operatorName,
}: ContractDetailActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [signedBy, setSignedBy] = useState(contract.customerName);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const clientSigned = contract.signatures.some((s) => s.signer_type === "CLIENT");
  const repSigned = contract.signatures.some(
    (s) => s.signer_type === "REPRESENTATIVE",
  );
  const repName =
    contract.signatures.find((s) => s.signer_type === "REPRESENTATIVE")
      ?.signed_by_name ??
    operatorName ??
    "Operador en sesión";

  useEffect(() => {
    if (!clientSigned) {
      setSignedBy(contract.customerName);
    }
  }, [clientSigned, contract.customerName]);

  const editable =
    canEdit &&
    contract.status !== "COMPLETED" &&
    contract.status !== "CANCELLED";

  async function handleUpdate(formData: FormData) {
    setError(null);
    const result = await updateContract(contract.id, formData);
    if (!result.success) setError(result.error);
    else router.refresh();
  }

  async function handleSign() {
    if (!signatureDataUrl || !signedBy.trim()) {
      setError("Complete el nombre y la firma del cliente.");
      return;
    }

    setSigning(true);
    setError(null);
    setWarning(null);

    const fd = new FormData();
    fd.set("signerType", "CLIENT");
    fd.set("signedBy", signedBy);
    fd.set("signatureDataUrl", signatureDataUrl);

    const result = await signContract(contract.id, fd);
    setSigning(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    if (result.data.warning) setWarning(result.data.warning);
    setSignatureDataUrl(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {warning ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </div>
      ) : null}

      {editable ? (
        <form action={handleUpdate} className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <h3 className="font-semibold">Editar términos</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="startAt"
              label="Inicio"
              type="datetime-local"
              defaultValue={contract.start_at.slice(0, 16)}
            />
            <Input
              name="endAt"
              label="Fin"
              type="datetime-local"
              defaultValue={contract.end_at.slice(0, 16)}
            />
            <Input
              name="agreedRate"
              label="Tarifa diaria"
              type="number"
              step="0.01"
              defaultValue={contract.agreed_rate}
            />
            <Input
              name="deposit"
              label="Depósito"
              type="number"
              step="0.01"
              defaultValue={contract.deposit}
            />
            <Input
              name="insurance"
              label="Seguro"
              type="number"
              step="0.01"
              defaultValue={contract.insurance}
            />
            <Input
              name="total"
              label="Total"
              type="number"
              step="0.01"
              defaultValue={contract.total}
            />
          </div>
          <Textarea name="terms" label="Términos" rows={5} defaultValue={contract.terms ?? ""} />
          <Textarea name="clauses" label="Cláusulas" rows={4} defaultValue={contract.clauses ?? ""} />
          <Textarea name="notes" label="Notas" rows={3} defaultValue={contract.notes ?? ""} />
          <SubmitButton>Guardar cambios</SubmitButton>
        </form>
      ) : null}

      {canSign && contract.status !== "CANCELLED" && contract.status !== "COMPLETED" ? (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <h3 className="font-semibold">Firma del cliente</h3>
          <p className="text-sm text-muted">
            Solo se requiere la firma del cliente. El operador ({repName}) se
            registra automáticamente al guardar la firma del cliente.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">Cliente</p>
              {clientSigned ? (
                <p className="text-success">Firmado</p>
              ) : (
                <p className="text-muted">Pendiente — requerido</p>
              )}
            </div>
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">Operador OLDES</p>
              {repSigned ? (
                <p className="text-success">{repName} · Registrado</p>
              ) : (
                <p className="text-muted">{repName} · Se registrará al firmar</p>
              )}
            </div>
          </div>

          {!clientSigned ? (
            <>
              <Input
                label="Nombre del cliente (firmante)"
                value={signedBy}
                onChange={(event) => setSignedBy(event.target.value)}
              />
              <SignaturePad
                onConfirm={setSignatureDataUrl}
                disabled={signing}
              />
              {signatureDataUrl ? (
                <p className="text-sm text-muted">
                  Firma capturada. Confirme para registrar.
                </p>
              ) : null}
              <Button
                type="button"
                onClick={handleSign}
                loading={signing}
                disabled={!signatureDataUrl}
              >
                Registrar firma del cliente
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {canCancel && contract.status !== "CANCELLED" && contract.status !== "COMPLETED" ? (
        <Button
          type="button"
          variant="danger"
          onClick={async () => {
            if (!confirm("¿Cancelar este contrato?")) return;
            const result = await cancelContract(contract.id);
            if (!result.success) setError(result.error);
            else router.refresh();
          }}
        >
          Cancelar contrato
        </Button>
      ) : null}
    </div>
  );
}
