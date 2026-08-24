"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  closeContract,
  type ContractCloseContext,
} from "@/app/dashboard/contratos/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { calculateSuggestedExtraDayCharge } from "@/lib/calculations/rental-close";
import { toDatetimeLocalValue } from "@/lib/dates";
import { CHECKLIST_STATUS_LABELS, FUEL_LEVEL_LABELS } from "@/lib/inspections/defaults";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

type CloseContractWizardProps = {
  context: ContractCloseContext;
  canSign: boolean;
};

export function CloseContractWizard({
  context,
  canSign,
}: CloseContractWizardProps) {
  const router = useRouter();
  const { contract, checkOut, checkIn, accessoryComparison, extraDayGraceHours } =
    context;

  const [error, setError] = useState<string | null>(null);
  const [actualReturnAt, setActualReturnAt] = useState(
    checkIn
      ? toDatetimeLocalValue(new Date())
      : toDatetimeLocalValue(contract.end_at),
  );
  const [courtesyHours, setCourtesyHours] = useState("0");
  const [courtesyDays, setCourtesyDays] = useState("0");
  const [graceExtraDaysWaived, setGraceExtraDaysWaived] = useState("0");
  const [extraCharges, setExtraCharges] = useState(
    String(contract.extra_charges ?? 0),
  );
  const [damageCharges, setDamageCharges] = useState(
    String(contract.damage_charges ?? 0),
  );
  const [fuelCharges, setFuelCharges] = useState(
    String(contract.fuel_charges ?? 0),
  );
  const [complementaryAmount, setComplementaryAmount] = useState(
    String(contract.complementary_amount ?? 0),
  );
  const [finalPayment, setFinalPayment] = useState("0");

  const amountPaidBase = Number(contract.amount_paid ?? 0);

  const extraDayPreview = useMemo(() => {
    if (!actualReturnAt) return null;
    try {
      return calculateSuggestedExtraDayCharge({
        scheduledEndAt: contract.end_at,
        actualReturnAt,
        dailyRate: contract.agreed_rate,
        graceHours: extraDayGraceHours,
        courtesyHours: Number(courtesyHours) || 0,
        courtesyDays: Number(courtesyDays) || 0,
        manualExtraDaysWaived: Number(graceExtraDaysWaived) || 0,
      });
    } catch {
      return null;
    }
  }, [
    actualReturnAt,
    contract.agreed_rate,
    contract.end_at,
    courtesyDays,
    courtesyHours,
    extraDayGraceHours,
    graceExtraDaysWaived,
  ]);

  const billing = useMemo(() => {
    const extra = parseMoneyInput(extraCharges);
    const damage = parseMoneyInput(damageCharges);
    const fuel = parseMoneyInput(fuelCharges);
    const complementary = parseMoneyInput(complementaryAmount);
    const payment = parseMoneyInput(finalPayment);
    const owed =
      Number(contract.total) + extra + damage + fuel + complementary;
    const paid = amountPaidBase + payment;
    const balance = Math.max(0, owed - paid);
    return { owed, paid, balance, extra, damage, fuel, complementary, payment };
  }, [
    amountPaidBase,
    complementaryAmount,
    contract.total,
    damageCharges,
    extraCharges,
    finalPayment,
    fuelCharges,
  ]);

  const clientSigned = contract.signatures.some(
    (s) => s.signer_type === "CLIENT",
  );
  const repSigned = contract.signatures.some(
    (s) => s.signer_type === "REPRESENTATIVE",
  );
  const signaturesDone = clientSigned && repSigned;

  const steps = [
    {
      id: "checkin",
      title: "Inspección de entrada",
      done: Boolean(checkIn),
    },
    {
      id: "fuel",
      title: "Combustible y kilometraje",
      done: Boolean(
        checkIn?.mileage != null && checkIn?.fuel_level != null,
      ),
    },
    {
      id: "accessories",
      title: "Devolución de accesorios",
      done: Boolean(checkIn && checkIn.checklist.length > 0),
    },
    {
      id: "charges",
      title: "Cargos adicionales",
      done: true,
    },
    {
      id: "balance",
      title: "Saldo recalculado",
      done: true,
    },
    {
      id: "payment",
      title: "Pago complementario",
      done: billing.balance <= 0 || billing.payment > 0,
    },
    {
      id: "signature",
      title: "Firma de cierre",
      done: signaturesDone,
    },
  ];

  async function handleClose(formData: FormData) {
    setError(null);
    formData.set("extraCharges", extraCharges);
    formData.set("damageCharges", damageCharges);
    formData.set("fuelCharges", fuelCharges);
    formData.set("complementaryAmount", complementaryAmount);
    formData.set("finalPayment", finalPayment);
    formData.set("courtesyHours", courtesyHours);
    formData.set("courtesyDays", courtesyDays);
    formData.set("graceExtraDaysWaived", graceExtraDaysWaived);
    formData.set("actualReturnAt", actualReturnAt);

    const result = await closeContract(contract.id, formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/contratos/${contract.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de cierre</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 sm:grid-cols-2">
            {steps.map((step, index) => (
              <li
                key={step.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm",
                  step.done && "border-green-200 bg-green-50/50",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                    step.done
                      ? "bg-green-600 text-white"
                      : "bg-surface-muted text-muted",
                  )}
                >
                  {step.done ? "✓" : index + 1}
                </span>
                {step.title}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* 1. Check-in */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">1. Inspección de entrada</CardTitle>
            <Badge variant={checkIn ? "success" : "warning"}>
              {checkIn ? "Registrada" : "Pendiente"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {checkIn ? (
            <p>
              Inspección de entrada lista.{" "}
              <Link
                href={`/dashboard/inspecciones/${checkIn.id}`}
                className="font-medium text-brand hover:underline"
              >
                Ver inspección
              </Link>
            </p>
          ) : (
            <p>
              Aún no hay inspección CHECK_IN.{" "}
              <Link
                href={`/dashboard/inspecciones/nuevo?reservation_id=${contract.reservation_id}&type=CHECK_IN`}
                className="font-medium text-brand hover:underline"
              >
                Crear inspección de entrada
              </Link>
            </p>
          )}
          {checkOut ? (
            <p className="text-muted">
              Salida:{" "}
              <Link
                href={`/dashboard/inspecciones/${checkOut.id}`}
                className="text-brand hover:underline"
              >
                ver CHECK_OUT
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 2. Fuel / mileage reminder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            2. Combustible, tablero y kilometraje
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-muted">Kilometraje entrada</p>
            <p className="font-medium">
              {checkIn?.mileage != null
                ? `${checkIn.mileage.toLocaleString("es-SV")} km`
                : "Sin registrar"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-muted">Combustible entrada</p>
            <p className="font-medium">
              {checkIn?.fuel_level
                ? FUEL_LEVEL_LABELS[checkIn.fuel_level] ?? checkIn.fuel_level
                : "Sin registrar"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3 sm:col-span-2">
            <p className="text-muted">Foto de tablero / combustible</p>
            <p className="font-medium">
              {checkIn?.hasDashboardPhoto
                ? "Foto de tablero registrada"
                : "Recuerde adjuntar foto del tablero en la inspección de entrada"}
            </p>
            {checkIn && !checkIn.hasDashboardPhoto ? (
              <Link
                href={`/dashboard/inspecciones/${checkIn.id}`}
                className="mt-1 inline-block text-brand hover:underline"
              >
                Abrir inspección para subir foto
              </Link>
            ) : null}
          </div>
          {checkOut ? (
            <p className="text-muted sm:col-span-2">
              Referencia salida: {checkOut.mileage ?? "—"} km ·{" "}
              {checkOut.fuel_level
                ? FUEL_LEVEL_LABELS[checkOut.fuel_level] ?? checkOut.fuel_level
                : "—"}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 3. Accessories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            3. Comparación de accesorios
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accessoryComparison.length === 0 ? (
            <p className="text-sm text-muted">
              No hay checklist en las inspecciones. Complete la inspección de
              entrada con accesorios para comparar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 pr-3 font-medium">Accesorio</th>
                    <th className="py-2 pr-3 font-medium">Salida</th>
                    <th className="py-2 pr-3 font-medium">Entrada</th>
                  </tr>
                </thead>
                <tbody>
                  {accessoryComparison.map((row) => (
                    <tr
                      key={row.itemName}
                      className={cn(
                        "border-b border-border/60",
                        row.changed && "bg-amber-50",
                      )}
                    >
                      <td className="py-2 pr-3">{row.itemName}</td>
                      <td className="py-2 pr-3">
                        {row.checkOutStatus
                          ? CHECKLIST_STATUS_LABELS[row.checkOutStatus] ??
                            row.checkOutStatus
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {row.checkInStatus
                          ? CHECKLIST_STATUS_LABELS[row.checkInStatus] ??
                            row.checkInStatus
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4–6. Charges, balance, payment + 7 signature note + 8 close */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            4–6. Cargos, saldo y pago complementario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleClose} className="space-y-4">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-950">
              <p className="font-medium">Retraso y día extra</p>
              <p className="mt-1">
                Margen de cortesía configurado:{" "}
                <strong>{extraDayGraceHours} h</strong> sin cobrar día extra.
                Puede aplicar horas/días de cortesía o ajustar manualmente el
                cargo extra sin cambiar la hora real de devolución.
              </p>
              {extraDayPreview ? (
                <p className="mt-2">
                  Retraso: <strong>{extraDayPreview.delayHours} h</strong> · Días
                  extra sugeridos:{" "}
                  <strong>{extraDayPreview.billedExtraDays}</strong> · Cargo
                  sugerido:{" "}
                  <strong>{formatMoney(extraDayPreview.suggestedExtraCharge)}</strong>
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                name="actualReturnAt"
                label="Hora real de devolución"
                type="datetime-local"
                value={actualReturnAt}
                onChange={(e) => setActualReturnAt(e.target.value)}
              />
              <Input
                name="courtesyHours"
                label="Horas de cortesía"
                type="number"
                min="0"
                value={courtesyHours}
                onChange={(e) => setCourtesyHours(e.target.value)}
              />
              <Input
                name="courtesyDays"
                label="Días de cortesía"
                type="number"
                min="0"
                value={courtesyDays}
                onChange={(e) => setCourtesyDays(e.target.value)}
              />
              <Input
                name="graceExtraDaysWaived"
                label="Días extra a no cobrar (manual)"
                type="number"
                min="0"
                value={graceExtraDaysWaived}
                onChange={(e) => setGraceExtraDaysWaived(e.target.value)}
              />
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className="rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-brand-light"
                  onClick={() => {
                    if (extraDayPreview) {
                      setExtraCharges(String(extraDayPreview.suggestedExtraCharge));
                    } else {
                      setExtraCharges("0");
                    }
                  }}
                >
                  Aplicar cargo extra sugerido
                </button>
                <button
                  type="button"
                  className="ml-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-muted"
                  onClick={() => setExtraCharges("0")}
                >
                  No cobrar extra
                </button>
              </div>
              <Input
                label="Cargos extra"
                type="number"
                step="0.01"
                min="0"
                value={extraCharges}
                onChange={(e) => setExtraCharges(e.target.value)}
              />
              <Input
                label="Cargos por daño"
                type="number"
                step="0.01"
                min="0"
                value={damageCharges}
                onChange={(e) => setDamageCharges(e.target.value)}
              />
              <Input
                label="Cargos por combustible"
                type="number"
                step="0.01"
                min="0"
                value={fuelCharges}
                onChange={(e) => setFuelCharges(e.target.value)}
              />
              <Input
                label="Monto complementario (cargo)"
                type="number"
                step="0.01"
                min="0"
                value={complementaryAmount}
                onChange={(e) => setComplementaryAmount(e.target.value)}
              />
              <Input
                label="Pago complementario a registrar"
                type="number"
                step="0.01"
                min="0"
                value={finalPayment}
                onChange={(e) => setFinalPayment(e.target.value)}
              />
              <Input
                name="deliveredByName"
                label="Quién entrega el vehículo"
                defaultValue={contract.delivered_by_name ?? ""}
              />
              <Input
                name="receivedByName"
                label="Quién recibe (OLDES)"
                defaultValue={contract.received_by_name ?? ""}
              />
            </div>

            <Textarea
              name="closeNotes"
              label="Notas de cierre"
              rows={3}
              placeholder="Observaciones de devolución, acuerdos, etc."
            />

            <div className="grid gap-2 rounded-lg border border-border bg-surface-muted/40 p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-muted">Total renta</p>
                <p className="font-medium">{formatMoney(contract.total)}</p>
              </div>
              <div>
                <p className="text-muted">Total adeudado</p>
                <p className="font-medium">{formatMoney(billing.owed)}</p>
              </div>
              <div>
                <p className="text-muted">Abonado (actual + pago)</p>
                <p className="font-medium">{formatMoney(billing.paid)}</p>
              </div>
              <div className="sm:col-span-3">
                <p className="text-muted">Saldo recalculado</p>
                <p className="text-lg font-semibold">
                  {formatMoney(billing.balance)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="font-medium">7. Firma de cierre</p>
              <p className="mt-1 text-muted">
                Cliente: {clientSigned ? "Firmado" : "Pendiente"} · Representante:{" "}
                {repSigned ? "Firmado" : "Pendiente"}
              </p>
              {canSign && !signaturesDone ? (
                <Link
                  href={`/dashboard/contratos/${contract.id}/sign`}
                  className="mt-2 inline-block font-medium text-brand hover:underline"
                >
                  Ir a firmar contrato
                </Link>
              ) : null}
              {signaturesDone ? (
                <p className="mt-2 text-green-700">Firmas completas registradas.</p>
              ) : (
                <p className="mt-2 text-amber-800">
                  Puede cerrar sin ambas firmas; se recomienda completarlas.
                </p>
              )}
            </div>

            {!checkIn ? (
              <p className="text-sm text-amber-800">
                Se recomienda crear la inspección de entrada antes de cerrar.
              </p>
            ) : null}

            <SubmitButton variant="primary">Cerrar contrato</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
