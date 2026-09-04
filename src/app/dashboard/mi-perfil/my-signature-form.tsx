"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  clearMySignature,
  saveMySignature,
} from "@/app/dashboard/mi-perfil/actions";
import { SignaturePad } from "@/components/contracts/signature-pad";
import { Button } from "@/components/ui/button";

type MySignatureFormProps = {
  currentSignatureUrl?: string | null;
  operatorName: string;
};

export function MySignatureForm({
  currentSignatureUrl,
  operatorName,
}: MySignatureFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const shown = preview || currentSignatureUrl || null;

  async function handleSave(dataUrl: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    setPreview(dataUrl);

    const fd = new FormData();
    fd.set("signatureUrl", dataUrl);
    const result = await saveMySignature(fd);
    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setMessage("Firma guardada. Se usará automáticamente en contratos.");
    router.refresh();
  }

  async function handleClear() {
    if (!confirm("¿Quitar su firma del perfil?")) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await clearMySignature();
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setPreview(null);
    setMessage("Firma eliminada del perfil.");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <div>
        <h2 className="text-base font-semibold">Firma digital</h2>
        <p className="text-sm text-muted">
          Operador: {operatorName}. Esta firma aparece sola en los contratos
          que usted gestiona.
        </p>
      </div>

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

      {shown ? (
        <div className="rounded-lg border border-border bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown}
            alt="Firma del operador"
            className="h-20 max-w-full object-contain"
          />
        </div>
      ) : (
        <p className="text-sm text-amber-800">
          Aún no tiene firma. Dibújela abajo y confirme.
        </p>
      )}

      <SignaturePad onConfirm={(dataUrl) => void handleSave(dataUrl)} disabled={pending} />

      {shown ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleClear()}
          loading={pending}
        >
          Quitar firma
        </Button>
      ) : null}
    </div>
  );
}
