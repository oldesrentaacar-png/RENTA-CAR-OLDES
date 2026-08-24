"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveBusinessSettings } from "@/app/dashboard/configuracion/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BusinessSettings } from "@/types/database";

type SettingsFormProps = {
  settings: BusinessSettings | null;
};

function policiesToText(policies: BusinessSettings["policies"]): string {
  if (!policies) return "";
  if (typeof policies === "string") return policies;
  if (typeof policies === "object" && policies !== null && "text" in policies) {
    return String((policies as { text?: string }).text ?? "");
  }
  return JSON.stringify(policies, null, 2);
}

function policiesExtraDayGraceHours(
  policies: BusinessSettings["policies"],
): number {
  if (!policies || typeof policies !== "object") return 2;
  const value = (policies as { extraDayGraceHours?: unknown }).extraDayGraceHours;
  return typeof value === "number" ? value : 2;
}

function policiesStringValue(
  policies: BusinessSettings["policies"],
  key: "receiptTemplateUrl" | "contractTemplateUrl",
): string {
  if (!policies || typeof policies !== "object") return "";
  const value = (policies as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await saveBusinessSettings(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="businessName"
          label="Nombre comercial *"
          defaultValue={settings?.business_name ?? ""}
          required
        />
        <Input
          name="legalName"
          label="Razón social"
          defaultValue={settings?.legal_name ?? ""}
        />
        <Input name="email" label="Correo" type="email" defaultValue={settings?.email ?? ""} />
        <Input name="phone" label="Teléfono" defaultValue={settings?.phone ?? ""} />
        <Input name="whatsapp" label="WhatsApp" defaultValue={settings?.whatsapp ?? ""} />
        <Input name="logoUrl" label="URL del logo" defaultValue={settings?.logo_url ?? ""} />
        <Input name="currency" label="Moneda" defaultValue={settings?.currency ?? "USD"} />
        <Input
          name="timezone"
          label="Zona horaria"
          defaultValue={settings?.timezone ?? "America/El_Salvador"}
        />
        <Input
          name="defaultDeposit"
          label="Depósito predeterminado"
          type="number"
          step="0.01"
          defaultValue={settings?.default_deposit ?? 0}
        />
        <Input
          name="defaultInsurance"
          label="Seguro predeterminado"
          type="number"
          step="0.01"
          defaultValue={settings?.default_insurance ?? 0}
        />
        <Input
          name="defaultDeliveryFee"
          label="Tarifa de entrega"
          type="number"
          step="0.01"
          defaultValue={settings?.default_delivery_fee ?? 0}
        />
        <Input
          name="extraDayGraceHours"
          label="Horas de cortesía antes de cobrar día extra"
          type="number"
          min="0"
          max="24"
          defaultValue={policiesExtraDayGraceHours(settings?.policies ?? null)}
        />
      </div>

      <Input
        name="address"
        label="Dirección"
        defaultValue={settings?.address ?? ""}
      />
      <Textarea
        name="quoteTerms"
        label="Términos de cotización"
        rows={5}
        defaultValue={settings?.quote_terms ?? ""}
      />
      <Textarea
        name="contractTerms"
        label="Términos de contrato"
        rows={5}
        defaultValue={settings?.contract_terms ?? ""}
      />
      <Input
        name="receiptTemplateUrl"
        label="URL machote recibo (imagen/PDF en Cloudinary)"
        defaultValue={policiesStringValue(settings?.policies ?? null, "receiptTemplateUrl")}
        placeholder="https://..."
      />
      <Input
        name="contractTemplateUrl"
        label="URL machote contrato (imagen/PDF en Cloudinary)"
        defaultValue={policiesStringValue(settings?.policies ?? null, "contractTemplateUrl")}
        placeholder="https://..."
      />
      <Textarea
        name="policies"
        label="Políticas"
        rows={4}
        defaultValue={policiesToText(settings?.policies ?? null)}
      />

      <SubmitButton>Guardar configuración</SubmitButton>
    </form>
  );
}
