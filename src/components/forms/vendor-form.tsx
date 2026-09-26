"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createVendor, updateVendor } from "@/app/dashboard/proveedores/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Vendor } from "@/types/database";

type VendorFormProps = {
  vendor?: Vendor;
  redirectTo?: string;
};

export function VendorForm({ vendor, redirectTo }: VendorFormProps) {
  const router = useRouter();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("isActive", formData.get("isActive") ? "true" : "false");
    const result = vendor
      ? await updateVendor(vendor.id, formData)
      : await createVendor(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(redirectTo ?? "/dashboard/proveedores");
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="name"
          label="Nombre *"
          defaultValue={vendor?.name}
          required
          className="sm:col-span-2"
        />
        <Input name="phone" label="Teléfono" defaultValue={vendor?.phone ?? ""} />
        <Input
          name="email"
          label="Correo"
          type="email"
          defaultValue={vendor?.email ?? ""}
        />
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={vendor?.is_active ?? true}
          />
          Proveedor activo
        </label>
      </div>

      <Textarea
        name="notes"
        label="Notas"
        rows={3}
        defaultValue={vendor?.notes ?? ""}
      />

      <div className="flex gap-3">
        <SubmitButton>{vendor ? "Guardar cambios" : "Crear proveedor"}</SubmitButton>
        <Link
          href="/dashboard/proveedores"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
