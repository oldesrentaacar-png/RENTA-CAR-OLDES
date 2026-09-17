"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  createMonthlySettlement,
  lookupContractByCode,
  updateMonthlySettlement,
  type ContractLookupResult,
} from "@/app/dashboard/liquidacion/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";
import type { MonthlySettlement, Vendor } from "@/types/database";

type SettlementFormProps = {
  vendors: Array<Pick<Vendor, "id" | "name">>;
  defaultMonth?: string;
  redirectTo?: string;
  settlement?: MonthlySettlement;
  /** Prefill from closed sublease contract. */
  initialContract?: ContractLookupResult;
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function money(value: string): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthFromPeriod(periodMonth: string | null | undefined): string {
  if (!periodMonth) return currentMonth();
  return periodMonth.slice(0, 7);
}

export function SettlementForm({
  vendors,
  defaultMonth,
  redirectTo,
  settlement,
  initialContract,
}: SettlementFormProps) {
  const router = useRouter();
  const isEdit = Boolean(settlement);
  const [error, setError] = useState<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(
    initialContract
      ? initialContract.isSubleased
        ? "Contrato subarrendado cargado. Indique cuánto es suyo y cuánto del proveedor."
        : "Contrato cargado. Complete el reparto de costos."
      : null,
  );
  const [isLookingUp, startLookup] = useTransition();
  const [contract, setContract] = useState<ContractLookupResult | null>(
    settlement
      ? {
          contractId: settlement.contract_id ?? "",
          contractCode: settlement.contract_code ?? "",
          customerId: settlement.customer_id,
          customerName: settlement.customer_name ?? "",
          vehicleId: settlement.vehicle_id,
          vehicleLabel: settlement.vehicle_label ?? "",
          plate: settlement.plate,
          startAt: settlement.start_at,
          endAt: settlement.end_at,
          rentalDays: settlement.rental_days,
          total: Number(settlement.billed_amount ?? 0),
          amountPaid: Number(settlement.payments_received ?? 0),
        }
      : initialContract ?? null,
  );
  const [contractCode, setContractCode] = useState(
    settlement?.contract_code ?? initialContract?.contractCode ?? "",
  );
  const [customerName, setCustomerName] = useState(
    settlement?.customer_name ?? initialContract?.customerName ?? "",
  );
  const [vehicleLabel, setVehicleLabel] = useState(
    settlement?.vehicle_label ?? initialContract?.vehicleLabel ?? "",
  );
  const [plate, setPlate] = useState(
    settlement?.plate ?? initialContract?.plate ?? "",
  );
  const [periodMonth, setPeriodMonth] = useState(
    monthFromPeriod(settlement?.period_month) ||
      (initialContract?.endAt
        ? String(initialContract.endAt).slice(0, 7)
        : defaultMonth) ||
      currentMonth(),
  );
  const [billedAmount, setBilledAmount] = useState(
    String(settlement?.billed_amount ?? initialContract?.total ?? 0),
  );
  const [paymentsReceived, setPaymentsReceived] = useState(
    String(settlement?.payments_received ?? initialContract?.amountPaid ?? 0),
  );
  const [oldesCost, setOldesCost] = useState(String(settlement?.oldes_cost ?? 0));
  const [providerCost, setProviderCost] = useState(
    String(settlement?.provider_cost ?? 0),
  );
  const [commission, setCommission] = useState(
    String(settlement?.commission ?? 0),
  );
  const [taxAmount, setTaxAmount] = useState(String(settlement?.tax_amount ?? 0));
  const [extraCosts, setExtraCosts] = useState(
    String(settlement?.extra_costs ?? 0),
  );

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
      setLookupMessage(
        result.data.isSubleased
          ? "Contrato subarrendado cargado. Indique cuánto es suyo y cuánto del proveedor."
          : "Contrato cargado para la liquidación.",
      );
    });
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = isEdit
      ? await updateMonthlySettlement(settlement!.id, formData)
      : await createMonthlySettlement(formData);
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
      <input
        type="hidden"
        name="contractId"
        value={contract?.contractId ?? settlement?.contract_id ?? ""}
      />
      <input
        type="hidden"
        name="customerId"
        value={contract?.customerId ?? settlement?.customer_id ?? ""}
      />
      <input
        type="hidden"
        name="vehicleId"
        value={contract?.vehicleId ?? settlement?.vehicle_id ?? ""}
      />
      <input
        type="hidden"
        name="startAt"
        value={contract?.startAt ?? settlement?.start_at ?? ""}
      />
      <input
        type="hidden"
        name="endAt"
        value={contract?.endAt ?? settlement?.end_at ?? ""}
      />
      <input
        type="hidden"
        name="rentalDays"
        value={contract?.rentalDays ?? settlement?.rental_days ?? ""}
      />

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
          defaultValue={settlement?.vendor_id ?? ""}
          options={[
            { value: "", label: "Sin proveedor" },
            ...vendors.map((vendor) => ({
              value: vendor.id,
              label: vendor.name,
            })),
          ]}
        />
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
        {(contract?.isSubleased || initialContract?.isSubleased) &&
        (contract?.subleasePayeeName || initialContract?.subleasePayeeName) ? (
          <p className="sm:col-span-3 text-sm text-amber-950">
            Proveedor del vehículo:{" "}
            <strong>
              {contract?.subleasePayeeName ||
                initialContract?.subleasePayeeName}
            </strong>
            . Del total cobrado, indique cuánto le corresponde a usted y cuánto
            al proveedor.
          </p>
        ) : null}
        <Input
          name="billedAmount"
          label="Total cobrado al cliente (USD) *"
          type="number"
          min="0"
          step="0.01"
          value={billedAmount}
          onChange={(event) => setBilledAmount(event.target.value)}
          required
        />
        <Input
          name="oldesCost"
          label="Parte OLDES / mía (USD)"
          type="number"
          min="0"
          step="0.01"
          value={oldesCost}
          onChange={(event) => setOldesCost(event.target.value)}
        />
        <Input
          name="providerCost"
          label="Parte del proveedor (USD)"
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
          <p className="mt-1 text-xs text-muted">
            Facturado − parte OLDES − parte proveedor − comisión − impuestos −
            extras.
          </p>
        </div>
      </div>

      <Textarea
        name="notes"
        label="Notas"
        rows={3}
        defaultValue={settlement?.notes ?? ""}
      />

      <div className="flex gap-3">
        <SubmitButton>
          {isEdit ? "Guardar cambios" : "Registrar liquidación"}
        </SubmitButton>
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
