"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  createMonthlySettlement,
  lookupContractByCode,
  type ContractLookupResult,
} from "@/app/dashboard/liquidacion/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";
import type { Vendor } from "@/types/database";

type SettlementFormProps = {
  vendors: Array<Pick<Vendor, "id" | "name">>;
  defaultMonth?: string;
  redirectTo?: string;
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function money(value: string): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function SettlementForm({
  vendors,
  defaultMonth,
  redirectTo,
}: SettlementFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [isLookingUp, startLookup] = useTransition();
  const [contract, setContract] = useState<ContractLookupResult | null>(null);
  const [contractCode, setContractCode] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [plate, setPlate] = useState("");
  const [periodMonth, setPeriodMonth] = useState(defaultMonth ?? currentMonth());
  const [billedAmount, setBilledAmount] = useState("0");
  const [paymentsReceived, setPaymentsReceived] = useState("0");
  const [oldesCost, setOldesCost] = useState("0");
  const [providerCost, setProviderCost] = useState("0");
  const [commission, setCommission] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [extraCosts, setExtraCosts] = useState("0");

  const ownProfit = useMemo(
    () =>
      money(billedAmount) -
      money(oldesCost) -
      money(providerCost) -
      money(commission) -
      money(taxAmount) -
      money(extraCosts),
    [billedAmount, oldesCost, providerCost, commission, taxAmount, extraCosts],
  );

  async function handleLookup() {
    setLookupMessage(null);
    setError(null);
    startLookup(async () => {
      const result = await lookupContractByCode(contractCode);
      if (!result.success) {
        setLookupMessage(result.error);
        return;
      }
      if (!result.data) {
        setContract(null);
        setLookupMessage("No se encontró un contrato con ese código.");
        return;
      }

      setContract(result.data);
      setContractCode(result.data.contractCode);
      setCustomerName(result.data.customerName);
      setVehicleLabel(result.data.vehicleLabel);
      setPlate(result.data.plate ?? "");
      setBilledAmount(String(result.data.total));
      setPaymentsReceived(String(result.data.amountPaid));
      setLookupMessage("Contrato cargado para la liquidación.");
    });
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createMonthlySettlement(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(redirectTo ?? `/dashboard/liquidacion?month=${periodMonth}`);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <input type="hidden" name="periodMonth" value={`${periodMonth}-01`} />
      <input type="hidden" name="contractId" value={contract?.contractId ?? ""} />
      <input type="hidden" name="customerId" value={contract?.customerId ?? ""} />
      <input type="hidden" name="vehicleId" value={contract?.vehicleId ?? ""} />
      <input type="hidden" name="startAt" value={contract?.startAt ?? ""} />
      <input type="hidden" name="endAt" value={contract?.endAt ?? ""} />
      <input type="hidden" name="rentalDays" value={contract?.rentalDays ?? ""} />

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            name="contractCode"
            label="Código de contrato"
            value={contractCode}
            onChange={(event) => setContractCode(event.target.value)}
            placeholder="Ej. CTR-0001"
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={isLookingUp || !contractCode.trim()}
            className="mt-6 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {isLookingUp ? "Buscando…" : "Buscar contrato"}
          </button>
        </div>
        {lookupMessage ? (
          <p className="mt-2 text-sm text-muted">{lookupMessage}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Mes de liquidación *"
          type="month"
          value={periodMonth}
          onChange={(event) => setPeriodMonth(event.target.value)}
          required
        />
        <Input
          name="paymentsReceived"
          label="Pagos recibidos"
          type="number"
          min="0"
          step="0.01"
          value={paymentsReceived}
          onChange={(event) => setPaymentsReceived(event.target.value)}
        />
        <Input
          name="customerName"
          label="Cliente"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
        />
        <Input
          name="vehicleLabel"
          label="Vehículo"
          value={vehicleLabel}
          onChange={(event) => setVehicleLabel(event.target.value)}
        />
        <Input
          name="plate"
          label="Placa"
          value={plate}
          onChange={(event) => setPlate(event.target.value)}
        />
        <Select
          name="vendorId"
          label="Proveedor / tercero"
          options={[
            { value: "", label: "Sin proveedor" },
            ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
          ]}
        />
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
        <Input
          name="billedAmount"
          label="Facturado *"
          type="number"
          min="0"
          step="0.01"
          value={billedAmount}
          onChange={(event) => setBilledAmount(event.target.value)}
          required
        />
        <Input
          name="oldesCost"
          label="Costo OLDES"
          type="number"
          min="0"
          step="0.01"
          value={oldesCost}
          onChange={(event) => setOldesCost(event.target.value)}
        />
        <Input
          name="providerCost"
          label="Costo proveedor"
          type="number"
          min="0"
          step="0.01"
          value={providerCost}
          onChange={(event) => setProviderCost(event.target.value)}
        />
        <Input
          name="commission"
          label="Comisión"
          type="number"
          min="0"
          step="0.01"
          value={commission}
          onChange={(event) => setCommission(event.target.value)}
        />
        <Input
          name="taxAmount"
          label="Impuestos"
          type="number"
          min="0"
          step="0.01"
          value={taxAmount}
          onChange={(event) => setTaxAmount(event.target.value)}
        />
        <Input
          name="extraCosts"
          label="Costos extra"
          type="number"
          min="0"
          step="0.01"
          value={extraCosts}
          onChange={(event) => setExtraCosts(event.target.value)}
        />
        <div className="rounded-lg bg-brand-light p-3 sm:col-span-3">
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            Ganancia propia calculada
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatMoney(ownProfit)}
          </p>
        </div>
      </div>

      <Textarea name="notes" label="Notas" rows={3} />

      <div className="flex gap-3">
        <SubmitButton>Registrar liquidación</SubmitButton>
        <Link
          href="/dashboard/liquidacion"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
