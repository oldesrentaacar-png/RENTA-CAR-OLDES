"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  closeContract,
  type ContractCloseContext,
} from "@/app/dashboard/contratos/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { calculateSuggestedExtraDayCharge } from "@/lib/calculations/rental-close";
import { formatAppDateTime, toDatetimeLocalValue } from "@/lib/dates";
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
  const [closing, setClosing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  const [deliveredByName, setDeliveredByName] = useState(
    contract.delivered_by_name ?? "",
  );
  const [receivedByName, setReceivedByName] = useState(
    contract.received_by_name ?? "",
  );
  const [closeNotes, setCloseNotes] = useState("");

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

  const hasCheckIn = Boolean(checkIn);
  const hasFuelAndMileage = Boolean(
    checkIn?.mileage != null && checkIn?.fuel_level != null,
  );
  const hasAccessories = Boolean(checkIn && checkIn.checklist.length > 0);
  const returnReviewed = Boolean(actualReturnAt);

  const canClose =
    hasCheckIn && hasFuelAndMileage && hasAccessories && returnReviewed;

  const steps = [
    {
      id: "checkin",
      title: "1. Inspección de entrada",
      done: hasCheckIn,
      required: true,
    },
    {
      id: "fuel",
      title: "2. Combustible y kilometraje",
      done: hasFuelAndMileage,
      required: true,
    },
    {
      id: "accessories",
      title: "3. Accesorios / checklist",
      done: hasAccessories,
      required: true,
    },
    {
      id: "timing",
      title: "4. Devolución temprano / tarde",
      done: returnReviewed,
      required: true,
    },
    {
      id: "balance",
      title: "5. Saldo y cargos",
      done: true,
      required: true,
    },
    {
      id: "payment",
      title: "6. Pago pendiente",
      done: billing.balance <= 0 || billing.payment > 0,
      required: false,
    },
    {
      id: "signature",
      title: "7. Firmas",
      done: signaturesDone,
      required: false,
    },
  ];

  function missingRequirements(): string[] {
    const missing: string[] = [];
    if (!hasCheckIn) missing.push("crear la inspección de entrada (CHECK_IN)");
    if (hasCheckIn && !hasFuelAndMileage) {
      missing.push("registrar combustible y kilometraje en la inspección");
    }
    if (hasCheckIn && !hasAccessories) {
      missing.push("completar el checklist de accesorios en la inspección");
    }
    if (!returnReviewed) missing.push("indicar la hora real de devolución");
    return missing;
  }

  function openConfirm() {
    setError(null);
    const missing = missingRequirements();
    if (missing.length > 0) {
      setError(`Antes de cerrar debe: ${missing.join("; ")}.`);
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmAndClose() {
    setClosing(true);
    setError(null);

    const formData = new FormData();
    formData.set("extraCharges", extraCharges);
    formData.set("damageCharges", damageCharges);
    formData.set("fuelCharges", fuelCharges);
    formData.set("complementaryAmount", complementaryAmount);
    formData.set("finalPayment", finalPayment);
    formData.set("courtesyHours", courtesyHours);
    formData.set("courtesyDays", courtesyDays);
    formData.set("graceExtraDaysWaived", graceExtraDaysWaived);
    formData.set("actualReturnAt", actualReturnAt);
    formData.set("deliveredByName", deliveredByName);
    formData.set("receivedByName", receivedByName);
    formData.set("closeNotes", closeNotes);
    formData.set("confirmClose", "true");

    const result = await closeContract(contract.id, formData);
    setClosing(false);

    if (!result.success) {
      setConfirmOpen(false);
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
          <CardTitle className="text-base">Orden obligatorio de cierre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Primero se revisa el vehículo (inspección de entrada), luego el
            acuerdo de devolución temprano/tarde, después el dinero pendiente y
            al final se cierra el contrato.
          </p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {steps.map((step) => (
              <li
                key={step.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm",
                  step.done && "border-green-200 bg-green-50/50",
                  !step.done && step.required && "border-amber-200 bg-amber-50/40",
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
                  {step.done ? "✓" : "!"}
                </span>
                <span>
                  {step.title}
                  {step.required && !step.done ? (
                    <span className="text-amber-800"> · requerido</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">1. Inspección de entrada</CardTitle>
            <Badge variant={hasCheckIn ? "success" : "warning"}>
              {hasCheckIn ? "Registrada" : "Obligatoria — pendiente"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {checkIn ? (
            <p>
              Inspección de entrada lista.{" "}
              <Link
                href={`/dashboard/inspecciones/${checkIn.id}`}
                className="font-medium text-brand hover:underline"
              >
                Ver / completar inspección
              </Link>
            </p>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="font-medium text-amber-950">
                Debe crear la inspección de entrada antes de cerrar.
              </p>
              <Link
                href={`/dashboard/inspecciones/nuevo?reservation_id=${contract.reservation_id}&type=CHECK_IN`}
                className="mt-3 inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Crear inspección de entrada
              </Link>
            </div>
          )}
          {checkOut ? (
            <p className="text-muted">
              Referencia de salida:{" "}
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
                : "Sin registrar (requerido)"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-muted">Combustible entrada</p>
            <p className="font-medium">
              {checkIn?.fuel_level
                ? FUEL_LEVEL_LABELS[checkIn.fuel_level] ?? checkIn.fuel_level
                : "Sin registrar (requerido)"}
            </p>
          </div>
          {checkIn && !hasFuelAndMileage ? (
            <Link
              href={`/dashboard/inspecciones/${checkIn.id}`}
              className="font-medium text-brand hover:underline sm:col-span-2"
            >
              Abrir inspección y completar km / combustible
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Comparación de accesorios</CardTitle>
        </CardHeader>
        <CardContent>
          {accessoryComparison.length === 0 ? (
            <p className="text-sm text-amber-800">
              Complete el checklist de accesorios en la inspección de entrada
              (requerido para cerrar).
              {checkIn ? (
                <>
                  {" "}
                  <Link
                    href={`/dashboard/inspecciones/${checkIn.id}#accesorios`}
                    className="font-medium text-brand hover:underline"
                  >
                    Ir a accesorios
                  </Link>
                </>
              ) : null}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            4–6. Devolución, cargos, saldo y pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-950">
            <p className="font-medium">¿Se regresó antes o después?</p>
            <p className="mt-1">
              Fin pactado:{" "}
              <strong>{formatAppDateTime(contract.end_at)}</strong>. Margen de
              cortesía: <strong>{extraDayGraceHours} h</strong>.
            </p>
            {extraDayPreview ? (
              <p className="mt-2">
                Retraso: <strong>{extraDayPreview.delayHours} h</strong> · Días
                extra sugeridos:{" "}
                <strong>{extraDayPreview.billedExtraDays}</strong> · Cargo
                sugerido:{" "}
                <strong>
                  {formatMoney(extraDayPreview.suggestedExtraCharge)}
                </strong>
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Hora real de devolución *"
              type="datetime-local"
              value={actualReturnAt}
              onChange={(e) => setActualReturnAt(e.target.value)}
            />
            <Input
              label="Horas de cortesía"
              type="number"
              min="0"
              value={courtesyHours}
              onChange={(e) => setCourtesyHours(e.target.value)}
            />
            <Input
              label="Días de cortesía"
              type="number"
              min="0"
              value={courtesyDays}
              onChange={(e) => setCourtesyDays(e.target.value)}
            />
            <Input
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
                    setExtraCharges(
                      String(extraDayPreview.suggestedExtraCharge),
                    );
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
              label="Quién entrega el vehículo"
              value={deliveredByName}
              onChange={(e) => setDeliveredByName(e.target.value)}
            />
            <Input
              label="Quién recibe (OLDES)"
              value={receivedByName}
              onChange={(e) => setReceivedByName(e.target.value)}
            />
          </div>

          <Textarea
            label="Notas de cierre"
            rows={3}
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
            placeholder="Acuerdos de devolución, cortesías, etc."
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
              <p className="text-muted">Saldo pendiente</p>
              <p className="text-lg font-semibold">
                {formatMoney(billing.balance)}
              </p>
              {billing.balance > 0 ? (
                <p className="mt-1 text-amber-800">
                  Aún hay saldo. Puede registrar un pago complementario arriba o
                  cerrar dejando el saldo documentado.
                </p>
              ) : (
                <p className="mt-1 text-green-700">Saldo en cero.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">7. Firmas</p>
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
          </div>

          {!canClose ? (
            <p className="text-sm text-amber-900">
              Complete los pasos marcados como <strong>requerido</strong> para
              habilitar el cierre.
            </p>
          ) : null}

          <Button
            type="button"
            onClick={openConfirm}
            disabled={!canClose || closing}
          >
            Revisar y cerrar contrato
          </Button>
        </CardContent>
      </Card>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold">
              ¿Está seguro de cerrar este contrato?
            </h3>
            <p className="mt-2 text-sm text-muted">
              Esta acción marca el contrato como <strong>COMPLETADO</strong>,
              libera el vehículo y no se puede deshacer fácilmente.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                Contrato: <strong>{contract.code}</strong>
              </li>
              <li>
                Devolución:{" "}
                <strong>
                  {actualReturnAt
                    ? formatAppDateTime(
                        new Date(actualReturnAt).toISOString(),
                      )
                    : "—"}
                </strong>
              </li>
              <li>
                Total adeudado: <strong>{formatMoney(billing.owed)}</strong>
              </li>
              <li>
                Abonado: <strong>{formatMoney(billing.paid)}</strong>
              </li>
              <li>
                Saldo: <strong>{formatMoney(billing.balance)}</strong>
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={closing}
              >
                No, volver
              </Button>
              <Button
                type="button"
                onClick={() => void confirmAndClose()}
                loading={closing}
              >
                Sí, cerrar contrato
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
