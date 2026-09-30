"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { lookupContractByCode } from "@/app/dashboard/liquidacion/actions";
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

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function PartnerRentalForm({
  rental,
  redirectTo,
}: PartnerRentalFormProps) {
  const router = useRouter();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [contractId, setContractId] = useState(rental?.contract_id ?? "");
  const [contractCode, setContractCode] = useState(rental?.contract_code ?? "");
  const [customerId, setCustomerId] = useState(rental?.customer_id ?? "");
  const [customerName, setCustomerName] = useState(rental?.customer_name ?? "");
  const [customerPhone, setCustomerPhone] = useState(
    rental?.customer_phone ?? "",
  );
  const [vehicleId, setVehicleId] = useState(rental?.vehicle_id ?? "");
  const [vehicleLabel, setVehicleLabel] = useState(rental?.vehicle_label ?? "");
  const [plate, setPlate] = useState(rental?.plate ?? "");
  const [startDate, setStartDate] = useState(rental?.start_date ?? "");
  const [endDate, setEndDate] = useState(rental?.end_date ?? "");
  const [clientCharged, setClientCharged] = useState(
    String(rental?.client_charged ?? 0),
  );
  const [partnerShare, setPartnerShare] = useState(
    String(rental?.partner_share ?? 0),
  );
  const [ownShare, setOwnShare] = useState(String(rental?.own_share ?? 0));

  function updateClientCharged(value: string) {
    setClientCharged(value);
    if (!rental) {
      setOwnShare(String(Math.max(0, money(value) - money(partnerShare))));
    }
  }

  function updatePartnerShare(value: string) {
    setPartnerShare(value);
    if (!rental) {
      setOwnShare(String(Math.max(0, money(clientCharged) - money(value))));
    }
  }

  async function handleLookup() {
    setLookupMessage(null);
    setError(null);
    setLookingUp(true);
    try {
      const result = await lookupContractByCode(contractCode);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (!result.data) {
        setLookupMessage("No se encontró ese contrato. Revise el código.");
        return;
      }
      const data = result.data;
      setContractId(data.contractId);
      setContractCode(data.contractCode);
      setCustomerId(data.customerId ?? "");
      setCustomerName(data.customerName);
      setVehicleId(data.vehicleId ?? "");
      setVehicleLabel(data.vehicleLabel);
      setPlate(data.plate ?? "");
      setStartDate(toDateInput(data.startAt));
      setEndDate(toDateInput(data.endAt));
      setClientCharged(String(data.total ?? 0));
      setOwnShare(
        String(Math.max(0, Number(data.total ?? 0) - money(partnerShare))),
      );
      setLookupMessage(
        "Datos del contrato cargados. Solo complete parte socio, parte OLDES y estado. Este registro no mezcla el dinero con ingresos del contrato.",
      );
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("contractId", contractId);
    formData.set("contractCode", contractCode);
    formData.set("customerId", customerId);
    formData.set("customerName", customerName);
    formData.set("customerPhone", customerPhone);
    formData.set("vehicleId", vehicleId);
    formData.set("vehicleLabel", vehicleLabel);
    formData.set("plate", plate);
    formData.set("startDate", startDate);
    formData.set("endDate", endDate);
    formData.set("clientCharged", clientCharged);
    formData.set("partnerShare", partnerShare);
    formData.set("ownShare", ownShare);
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

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm text-muted">
          Opcional: escriba el código del contrato o renta (ej. CTR-2026-000015)
          para traer fechas, cliente y vehículo. Luego solo edite parte socio,
          parte OLDES y estado. El dinero queda en Socios, no se mezcla con
          abonos del contrato.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            name="contractCode"
            label="Código de contrato / renta"
            value={contractCode}
            onChange={(event) => setContractCode(event.target.value)}
            placeholder="CTR-2026-000015"
          />
          <button
            type="button"
            onClick={() => void handleLookup()}
            disabled={lookingUp || !contractCode.trim()}
            className="mt-6 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {lookingUp ? "Buscando…" : "Traer datos"}
          </button>
        </div>
        {lookupMessage ? (
          <p className="mt-2 text-sm text-emerald-800">{lookupMessage}</p>
        ) : null}
        <input type="hidden" name="contractId" value={contractId} />
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="vehicleId" value={vehicleId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="customerName"
          label="Cliente *"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          required
        />
        <Input
          name="customerPhone"
          label="Teléfono"
          value={customerPhone}
          onChange={(event) => setCustomerPhone(event.target.value)}
        />
        <Input
          name="vehicleLabel"
          label="Vehículo"
          value={vehicleLabel}
          onChange={(event) => setVehicleLabel(event.target.value)}
          placeholder="Marca, modelo, año"
        />
        <Input
          name="plate"
          label="Placa"
          value={plate}
          onChange={(event) => setPlate(event.target.value)}
        />
        <Input
          name="startDate"
          label="Inicio"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
        <Input
          name="endDate"
          label="Fin"
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
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
          label="Parte socio *"
          type="number"
          min="0"
          step="0.01"
          value={partnerShare}
          onChange={(event) => updatePartnerShare(event.target.value)}
        />
        <Input
          name="ownShare"
          label="Parte OLDES *"
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
        <SubmitButton>
          {rental ? "Guardar cambios" : "Registrar sub-renta"}
        </SubmitButton>
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
