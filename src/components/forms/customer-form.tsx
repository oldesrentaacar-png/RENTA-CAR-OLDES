"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Customer, CustomerType } from "@/types/database";
import {
  createCustomer,
  updateCustomer,
} from "@/app/dashboard/clientes/actions";
import { cn } from "@/lib/utils";

type CustomerFormProps = {
  customer?: Customer;
  redirectTo?: string;
};

export function CustomerForm({ customer, redirectTo }: CustomerFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [customerType, setCustomerType] = useState<CustomerType>(
    customer?.customer_type ?? "PERSON",
  );
  const isEdit = Boolean(customer);
  const isCompany = customerType === "COMPANY";

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("customerType", customerType);
    const result = isEdit
      ? await updateCustomer(customer!.id, formData)
      : await createCustomer(formData);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(redirectTo ?? `/dashboard/clientes/${result.data.id}`);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <input type="hidden" name="customerType" value={customerType} />

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Tipo de cliente</p>
        <div className="inline-flex rounded-lg border border-zinc-300 p-1">
          <button
            type="button"
            onClick={() => setCustomerType("PERSON")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              !isCompany
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-50",
            )}
          >
            Persona natural
          </button>
          <button
            type="button"
            onClick={() => setCustomerType("COMPANY")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isCompany
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-50",
            )}
          >
            Empresa
          </button>
        </div>
      </div>

      {isCompany ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              name="companyName"
              label="Razón social *"
              defaultValue={customer?.company_name ?? ""}
              required
            />
          </div>
          <Input name="nit" label="NIT" defaultValue={customer?.nit ?? ""} />
          <Input name="nrc" label="NRC" defaultValue={customer?.nrc ?? ""} />
          <div className="sm:col-span-2">
            <Input
              name="contactPerson"
              label="Persona de contacto"
              defaultValue={customer?.contact_person ?? ""}
            />
          </div>
          <Input
            name="phone"
            label="Teléfono *"
            defaultValue={customer?.phone}
            required
          />
          <Input
            name="email"
            label="Correo"
            type="email"
            defaultValue={customer?.email ?? ""}
          />
          <Input
            name="receiverName"
            label="Nombre quien recibe"
            defaultValue={customer?.receiver_name ?? ""}
          />
          <Input
            name="delivererName"
            label="Nombre quien entrega"
            defaultValue={customer?.deliverer_name ?? ""}
          />
          <div className="sm:col-span-2">
            <Input
              name="address"
              label="Dirección"
              defaultValue={customer?.address ?? ""}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="firstName"
              label="Nombre *"
              defaultValue={customer?.first_name}
              required
            />
            <Input
              name="lastName"
              label="Apellido *"
              defaultValue={customer?.last_name}
              required
            />
            <Input
              name="dui"
              label="DUI"
              defaultValue={customer?.dui ?? ""}
            />
            <Input
              name="passport"
              label="Pasaporte"
              defaultValue={customer?.passport ?? ""}
            />
            <Input
              name="licenseNumber"
              label="Licencia"
              defaultValue={customer?.license_number ?? ""}
            />
            <Input
              name="licenseExpiry"
              label="Vencimiento licencia"
              type="date"
              defaultValue={customer?.license_expiry ?? ""}
            />
            <Input
              name="phone"
              label="Teléfono *"
              defaultValue={customer?.phone}
              required
            />
            <Input
              name="country"
              label="País"
              defaultValue={customer?.country ?? "El Salvador"}
            />
            <Input
              name="email"
              label="Correo"
              type="email"
              defaultValue={customer?.email ?? ""}
            />
            <Input
              name="whatsapp"
              label="WhatsApp"
              defaultValue={customer?.whatsapp ?? ""}
            />
            <Input
              name="birthDate"
              label="Fecha de nacimiento"
              type="date"
              defaultValue={customer?.date_of_birth ?? ""}
            />
            <Input
              name="identification"
              label="Identificación (otra)"
              defaultValue={customer?.identification ?? ""}
            />
          </div>

          <Input
            name="address"
            label="Dirección"
            defaultValue={customer?.address ?? ""}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="additionalDriverName"
              label="Conductor adicional"
              defaultValue={customer?.additional_driver_name ?? ""}
            />
            <Input
              name="additionalDriverLicense"
              label="Licencia conductor adicional"
              defaultValue={customer?.additional_driver_license ?? ""}
            />
          </div>

          <Textarea
            name="notes"
            label="Notas"
            defaultValue={customer?.notes ?? ""}
          />
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="documentImageUrl"
          label="URL imagen documento"
          placeholder="https://..."
          defaultValue={customer?.document_image_url ?? ""}
        />
        <Input
          name="licenseImageUrl"
          label="URL imagen licencia"
          placeholder="https://..."
          defaultValue={customer?.license_image_url ?? ""}
        />
      </div>

      {isCompany ? (
        <Textarea
          name="notes"
          label="Notas"
          defaultValue={customer?.notes ?? ""}
        />
      ) : null}

      <Select
        name="status"
        label="Estado"
        defaultValue={customer?.status ?? "ACTIVE"}
        options={[
          { value: "ACTIVE", label: "Activo" },
          { value: "INACTIVE", label: "Inactivo" },
        ]}
      />

      <div className="flex gap-3">
        <SubmitButton>{isEdit ? "Guardar cambios" : "Crear cliente"}</SubmitButton>
        <Link
          href={customer ? `/dashboard/clientes/${customer.id}` : "/dashboard/clientes"}
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
