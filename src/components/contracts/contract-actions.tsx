"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  cancelContract,
  setContractApplyIva,
  setContractIncludePagare,
  signContract,
  updateContract,
} from "@/app/dashboard/contratos/actions";
import type { ContractDetail } from "@/app/dashboard/contratos/actions";
import { saveMySignature } from "@/app/dashboard/mi-perfil/actions";
import { SignaturePad } from "@/components/contracts/signature-pad";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  resolveContractClauses,
} from "@/lib/contracts/oldes-terms";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type ContractDetailActionsProps = {
  contract: ContractDetail;
  canEdit: boolean;
  canSign: boolean;
  canCancel: boolean;
  operatorName?: string | null;
  /** Current operator already has signature_url on profile. */
  operatorHasSignature?: boolean;
};

export function ContractDetailActions({
  contract,
  canEdit,
  canSign,
  canCancel,
  operatorName,
  operatorHasSignature = false,
}: ContractDetailActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [signedBy, setSignedBy] = useState(contract.customerName);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [operatorSignatureDataUrl, setOperatorSignatureDataUrl] = useState<
    string | null
  >(null);
  const [signing, setSigning] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [scrolledTerms, setScrolledTerms] = useState(false);
  const [pagareSignatureDataUrl, setPagareSignatureDataUrl] = useState<
    string | null
  >(null);
  const [signingPagare, setSigningPagare] = useState(false);
  const [includePagare, setIncludePagare] = useState(
    Boolean(contract.includePagare),
  );
  const [savingPagareOption, setSavingPagareOption] = useState(false);
  const [applyIva, setApplyIva] = useState(Boolean(contract.applyIva));
  const [savingIvaOption, setSavingIvaOption] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIncludePagare(Boolean(contract.includePagare));
  }, [contract.includePagare]);

  useEffect(() => {
    setApplyIva(Boolean(contract.applyIva));
  }, [contract.applyIva]);

  const clientSigned = contract.signatures.some((s) => s.signer_type === "CLIENT");
  const repSigned = contract.signatures.some(
    (s) => s.signer_type === "REPRESENTATIVE",
  );
  const pagareSigned = contract.signatures.some((s) => s.signer_type === "PAGARE");
  const repName =
    contract.signatures.find((s) => s.signer_type === "REPRESENTATIVE")
      ?.signed_by_name ??
    operatorName ??
    "Operador en sesión";

  const termsClauses = useMemo(
    () => resolveContractClauses(contract.clauses),
    [contract.clauses],
  );

  const editable = canEdit && contract.status === "PENDING";

  async function handleOperatorSignatureConfirm(dataUrl: string) {
    setOperatorSignatureDataUrl(dataUrl);
    setError(null);
    setWarning(null);
    try {
      const fd = new FormData();
      fd.set("signatureUrl", dataUrl);
      const result = await saveMySignature(fd);
      if (!result.success) {
        setWarning(
          `Firma capturada para este contrato, pero no se guardó en el perfil: ${result.error}`,
        );
        return;
      }
      setWarning(null);
      router.refresh();
    } catch (err) {
      setWarning(
        err instanceof Error
          ? `Firma capturada, pero no se guardó en el perfil: ${err.message}`
          : "Firma capturada, pero no se guardó en el perfil.",
      );
    }
  }

  async function handleToggleIncludePagare(next: boolean) {
    setSavingPagareOption(true);
    setError(null);
    const result = await setContractIncludePagare(contract.id, next);
    setSavingPagareOption(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setIncludePagare(result.data.includePagare);
    router.refresh();
  }

  async function handleToggleApplyIva(next: boolean) {
    setSavingIvaOption(true);
    setError(null);
    const result = await setContractApplyIva(contract.id, next, 13);
    setSavingIvaOption(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setApplyIva(result.data.applyIva);
    router.refresh();
  }

  function handleTermsScroll() {
    const el = termsRef.current;
    if (!el || scrolledTerms) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= 24) setScrolledTerms(true);
  }

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
    if (!operatorHasSignature && !operatorSignatureDataUrl) {
      setError(
        "Falta su firma de operador. Dibújela abajo (o guárdela en su perfil) antes de firmar al cliente.",
      );
      return;
    }
    if (!scrolledTerms) {
      setError("El cliente debe leer los términos hasta el final (desplazar el texto).");
      return;
    }
    if (!acceptedTerms) {
      setError("Debe marcar que ha leído y acepta los términos y condiciones.");
      return;
    }

    setSigning(true);
    setError(null);
    setWarning(null);

    const fd = new FormData();
    fd.set("signerType", "CLIENT");
    fd.set("signedBy", signedBy);
    fd.set("signatureDataUrl", signatureDataUrl);
    fd.set("acceptedTerms", "true");
    if (operatorSignatureDataUrl) {
      fd.set("operatorSignatureDataUrl", operatorSignatureDataUrl);
    }

    const result = await signContract(contract.id, fd);
    setSigning(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    if (result.data.warning) setWarning(result.data.warning);
    setSignatureDataUrl(null);
    setOperatorSignatureDataUrl(null);
    router.refresh();
  }

  async function handlePagareSign() {
    if (!pagareSignatureDataUrl) {
      setError("Dibuje la firma del pagaré mercantil.");
      return;
    }
    setSigningPagare(true);
    setError(null);
    const fd = new FormData();
    fd.set("signerType", "PAGARE");
    fd.set("signedBy", signedBy.trim() || contract.customerName);
    fd.set("signatureDataUrl", pagareSignatureDataUrl);
    const result = await signContract(contract.id, fd);
    setSigningPagare(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setPagareSignatureDataUrl(null);
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
      ) : canEdit &&
        contract.status !== "COMPLETED" &&
        contract.status !== "CANCELLED" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este contrato ya no está en estado pendiente de firma. Las fechas,
          tarifas y cobros extras de la sección 1 ya no se editan. Use{" "}
          <strong>Anular</strong> o <strong>Cerrar renta</strong> (cargos de
          cierre) según corresponda.
        </div>
      ) : null}

      {canSign && contract.status !== "CANCELLED" && contract.status !== "COMPLETED" ? (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <h3 className="font-semibold">Firma del cliente</h3>
          <p className="text-sm text-muted">
            El cliente debe leer los términos, marcar la aceptación y firmar.
            Su firma de operador se aplica automáticamente desde su perfil.
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
              ) : operatorHasSignature || operatorSignatureDataUrl ? (
                <p className="text-muted">{repName} · Firma lista</p>
              ) : (
                <p className="text-amber-800">
                  {repName} · Falta firma en perfil
                </p>
              )}
            </div>
          </div>

          {!clientSigned ? (
            <>
              {!operatorHasSignature ? (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                  <p className="text-sm font-medium text-amber-950">
                    Su firma de operador (se guardará en su perfil)
                  </p>
                  <p className="text-xs text-amber-900">
                    Dibuje su firma una vez aquí (o en{" "}
                    <a href="/dashboard/mi-perfil" className="underline">
                      Mi perfil
                    </a>
                    ). Se usará automáticamente en los siguientes contratos.
                  </p>
                  <SignaturePad
                    onConfirm={(dataUrl) => void handleOperatorSignatureConfirm(dataUrl)}
                    disabled={signing}
                  />
                  {operatorSignatureDataUrl ? (
                    <p className="text-xs text-success">
                      Firma de operador confirmada y guardada en su perfil.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <p className="mb-1 text-sm font-medium">
                  Términos y condiciones (cláusulas del contrato)
                </p>
                <p className="mb-2 text-xs text-muted">
                  El cliente debe leer hasta el final, marcar aceptación y luego
                  firmar.
                </p>
                <div
                  ref={termsRef}
                  onScroll={handleTermsScroll}
                  className="max-h-72 overflow-y-auto rounded-lg border border-border bg-white p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap"
                >
                  {termsClauses.map((clause) => (
                    <p key={clause.slice(0, 40)} className="mb-3 last:mb-0">
                      {clause}
                    </p>
                  ))}
                </div>
                <p
                  className={cn(
                    "mt-2 text-xs",
                    scrolledTerms ? "text-success" : "text-muted",
                  )}
                >
                  {scrolledTerms
                    ? "Lectura completa registrada. Ya puede marcar la aceptación."
                    : "Desplace hasta el final para habilitar la casilla de aceptación."}
                </p>
              </div>

              <label
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-sm",
                  acceptedTerms
                    ? "border-green-300 bg-green-50"
                    : "border-border bg-white",
                  !scrolledTerms && "opacity-70",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-brand"
                  checked={acceptedTerms}
                  disabled={!scrolledTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span>
                  <strong>He leído y acepto</strong> los términos y condiciones
                  (cláusulas 1 a 10) de este contrato de arrendamiento.
                </span>
              </label>

              <Input
                label="Nombre del cliente (firmante)"
                value={signedBy}
                onChange={(event) => setSignedBy(event.target.value)}
                disabled={!acceptedTerms}
              />
              <div className={!acceptedTerms ? "pointer-events-none opacity-50" : undefined}>
                <p className="mb-2 text-sm font-medium">
                  Firma del contrato (después de aceptar términos)
                </p>
                <SignaturePad
                  onConfirm={setSignatureDataUrl}
                  disabled={signing || !acceptedTerms}
                />
              </div>
              {signatureDataUrl ? (
                <p className="text-sm text-muted">
                  Firma del contrato capturada. Confirme para registrar.
                </p>
              ) : null}
              <Button
                type="button"
                onClick={handleSign}
                loading={signing}
                disabled={
                  !signatureDataUrl ||
                  !acceptedTerms ||
                  !scrolledTerms ||
                  (!operatorHasSignature && !operatorSignatureDataUrl)
                }
              >
                Registrar firma del contrato
              </Button>
            </>
          ) : null}

          {editable || canSign ? (
            <label className="flex items-start gap-3 rounded-lg border border-border bg-white p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand"
                checked={applyIva}
                disabled={savingIvaOption}
                onChange={(event) =>
                  void handleToggleApplyIva(event.target.checked)
                }
              />
              <span>
                <strong>Aplicar IVA (13%) en el contrato / PDF</strong>
                <span className="mt-1 block text-xs text-muted">
                  Opcional. Si está marcado, el total incluye IVA y el PDF
                  muestra Subtotal + IVA + Total.
                  {savingIvaOption ? " Guardando…" : ""}
                  {applyIva
                    ? ` IVA actual: ${formatMoney(contract.taxAmount ?? 0)} · Total: ${formatMoney(contract.total)}`
                    : ""}
                </span>
              </span>
            </label>
          ) : null}

          {editable || canSign ? (
            <label className="flex items-start gap-3 rounded-lg border border-border bg-white p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand"
                checked={includePagare}
                disabled={savingPagareOption}
                onChange={(event) =>
                  void handleToggleIncludePagare(event.target.checked)
                }
              />
              <span>
                <strong>Incluir pagaré mercantil en el PDF del contrato</strong>
                <span className="mt-1 block text-xs text-muted">
                  Márquelo para incluirlo; desmárquelo para no incluirlo. Por
                  defecto se sugiere según documentos del cliente (DUI/local).
                  {savingPagareOption ? " Guardando…" : ""}
                </span>
              </span>
            </label>
          ) : null}

          {clientSigned && includePagare && !pagareSigned ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div>
                <p className="text-sm font-medium text-amber-950">
                  Pagaré mercantil (documento aparte)
                </p>
                <p className="mt-1 text-xs text-amber-900">
                  Incluido en el PDF. Monto sugerido (deducible):{" "}
                  {formatMoney(contract.pagareAmount)}.
                </p>
              </div>
              <SignaturePad
                onConfirm={setPagareSignatureDataUrl}
                disabled={signingPagare}
              />
              {pagareSignatureDataUrl ? (
                <p className="text-xs text-success">Firma del pagaré capturada.</p>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handlePagareSign()}
                loading={signingPagare}
                disabled={!pagareSignatureDataUrl}
              >
                Registrar firma del pagaré
              </Button>
            </div>
          ) : null}

          {clientSigned && includePagare && pagareSigned ? (
            <p className="text-sm text-success">
              Pagaré mercantil firmado (documento independiente).
            </p>
          ) : null}

          {clientSigned && !includePagare ? (
            <p className="text-xs text-muted">
              Pagaré no incluido en este contrato (opción desmarcada).
            </p>
          ) : null}
        </div>
      ) : null}

      {canCancel && contract.status !== "CANCELLED" && contract.status !== "COMPLETED" ? (
        <details className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-amber-950">
            Anular contrato (el registro se conserva)
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-sm text-amber-950">
              <strong>Anular</strong> marca el contrato como{" "}
              <strong>Anulado</strong> y{" "}
              <strong>conserva todo lo llenado</strong> (datos, montos, firmas)
              para historial y auditoría.{" "}
              <strong>No elimina</strong> el contrato.
            </p>
            <p className="text-sm text-amber-900">
              Úselo si el cliente desiste antes de la entrega (sin dinero, no
              acepta condiciones, etc.). Si el vehículo ya salió, use{" "}
              <a
                href={`/dashboard/contratos/${contract.id}/cerrar`}
                className="font-medium underline"
              >
                Cerrar renta
              </a>
              .
            </p>
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                const ok = confirm(
                  "¿Anular este contrato?\n\nQuedará el registro completo marcado como ANULADO (no se borra).\n\nSi el vehículo ya salió, cancele y use «Cerrar renta».",
                );
                if (!ok) return;
                const typed = window.prompt(
                  'Para confirmar, escriba exactamente: ANULAR',
                );
                if (typed?.trim().toUpperCase() !== "ANULAR") {
                  setError("Anulación cancelada. Debe escribir ANULAR para confirmar.");
                  return;
                }
                const result = await cancelContract(contract.id);
                if (!result.success) setError(result.error);
                else router.refresh();
              }}
            >
              Anular contrato (conserva el registro)
            </Button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
