"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { changeContractVehicle } from "@/app/dashboard/contratos/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { announceError, announceSuccess } from "@/lib/ui/announce";

type VehicleOption = {
  id: string;
  label: string;
  primary?: string;
  secondary?: string;
  searchText?: string;
};

export function ContractVehicleChanger({
  contractId,
  currentVehicleId,
  currentLabel,
  vehicles,
}: {
  contractId: string;
  currentVehicleId: string;
  currentLabel: string;
  vehicles: VehicleOption[];
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(currentVehicleId);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("vehicleId", vehicleId);
    const result = await changeContractVehicle(contractId, formData);
    if (!result.success) {
      setError(result.error);
      announceError(result.error);
      return;
    }
    announceSuccess(`Vehículo actualizado a ${result.data.plate}.`);
    router.refresh();
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-amber-950">
          Cambiar vehículo del contrato
        </h3>
        <p className="mt-1 text-xs text-amber-950">
          Si se asignó o entregó otro carro, cámbielo aquí. No anule la
          reserva ni el contrato: eso bloquea una renta ya entregada.
          Actual: <strong>{currentLabel}</strong>
        </p>
      </div>
      <SearchableSelect
        name="vehicleId"
        label="Vehículo correcto"
        required
        value={vehicleId}
        onChange={setVehicleId}
        placeholder="Seleccionar…"
        searchPlaceholder="Buscar por placa, marca o modelo…"
        options={vehicles.map((v) => ({
          value: v.id,
          label: v.label,
          primary: v.primary,
          secondary: v.secondary,
          searchText: v.searchText,
        }))}
      />
      {error ? (
        <p className="text-sm text-red-800">{error}</p>
      ) : null}
      <SubmitButton>Guardar vehículo</SubmitButton>
    </form>
  );
}
