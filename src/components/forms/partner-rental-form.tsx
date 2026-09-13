"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createPartnerRental,
  updatePartnerRental,
} from "@/app/dashboard/socios/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PARTNER_RENTAL_STATUS_LABELS } from "@/lib/labels";
import type { PartnerRental, PartnerRentalStatus } from "@/types/database";

type PartnerRentalFormProps = {
  rental?: PartnerRental;
  redirectTo?: string;
};

const STATUS_OPTIONS = Object.entries(PARTNER_RENTAL_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

function money(value: string): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PartnerRentalForm({
  rental,
  redirectTo,
}: PartnerRentalFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [clientCharged, setClientCharged] = useState(
    String(rental?.client_charged ?? 0),
  );
  const [partnerShare, setPartnerShare] = useState(
    String(rental?.partner_share ?? 0),
  );
  const [ownShare, setOwnShare] = useState(String(rental?.own_share ?? 0));

  function updateClientCharged(value: string) {
    setClientCharged(value);
    if (!rental) setOwnShare(String(Math.max(0, money(value) - money(partnerShare))));
  }

  function updatePartnerShare(value: string) {
    setPartnerShare(value);
    if (!rental) setOwnShare(String(Math.max(0, money(clientCharged) - money(value))));
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = rental
      ? await updatePartnerRental(rental.id, formData)
      : await createPartnerRental(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(redirectTo ?? "/dashboard/socios");
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
          name="customerName"
          label="Cliente *"
          defaultValue={rental?.customer_name}
          required
        />
        <Input
          name="customerPhone"
          label="Teléfono"
          defaultValue={rental?.customer_phone ?? ""}
        />
        <Input
          name="vehicleLabel"
          label="Vehículo"
          defaultValue={rental?.vehicle_label ?? ""}
          placeholder="Marca, modelo, año"
        />
        <Input name="plate" label="Placa" defaultValue={rental?.plate ?? ""} />
        <Input
          name="startDate"
          label="Inicio"
          type="date"
          defaultValue={rental?.start_date ?? ""}
        />
        <Input
          name="endDate"
          label="Fin"
          type="date"
          defaultValue={rental?.end_date ?? ""}
        />
        <Input
          name="clientCharged"
          label="Cobrado al cliente"
          type="number"
          min="0"
          step="0.01"
          value={clientCharged}
          onChange={(event) => updateClientCharged(event.target.value)}
        />
        <Input
          name="partnerShare"
          label="Parte socio"
          type="number"
          min="0"
          step="0.01"
          value={partnerShare}
          onChange={(event) => updatePartnerShare(event.target.value)}
        />
        <Input
          name="ownShare"
          label="Parte OLDES"
          type="number"
          min="0"
          step="0.01"
          value={ownShare}
          onChange={(event) => setOwnShare(event.target.value)}
        />
        <Select
          name="status"
          label="Estado"
          defaultValue={(rental?.status ?? "IN_PROGRESS") as PartnerRentalStatus}
          options={STATUS_OPTIONS}
        />
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <input
            type="checkbox"
            name="paidByClient"
            defaultChecked={rental?.paid_by_client ?? false}
          />
          Pagado por el cliente
        </label>
      </div>

      <Textarea
        name="notes"
        label="Notas"
        rows={3}
        defaultValue={rental?.notes ?? ""}
      />

      <div className="flex gap-3">
        <SubmitButton>{rental ? "Guardar cambios" : "Registrar sub-renta"}</SubmitButton>
        <Link
          href="/dashboard/socios"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
