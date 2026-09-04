"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  closeContract,
  type ContractCloseContext,
} from "@/app/dashboard/contratos/actions";
import { SignaturePad } from "@/components/contracts/signature-pad";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { calculateSuggestedExtraDayCharge } from "@/lib/calculations/rental-close";
import { formatAppDateTime, toDatetimeLocalValue } from "@/lib/dates";
import {
  CHECKLIST_STATUS_LABELS,
  FUEL_LEVEL_LABELS,
} from "@/lib/inspections/defaults";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

type CloseContractWizardProps = {
  context: ContractCloseContext;
  canSign: boolean;
};

type StepId =
  | "checkin"
  | "fuel"
  | "accessories"
  | "timing"
  | "charges"
  | "close";

const CLOSE_CONFORMITY_TEXT =
  "Declaro la devolución del vehículo, reconozco el inventario y el estado registrados en el acta de recepción, y manifiesto mi conformidad y satisfacción con el cierre del servicio. Con esta firma confirmo que la unidad fue entregada según el reporte verificado y que el finiquito queda aceptado.";

export function CloseContractWizard({
  context,
  canSign: _canSign,
}: CloseContractWizardProps) {
  const router = useRouter();
  const { contract, checkOut, checkIn, accessoryComparison, extraDayGraceHours } =
    context;

  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

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
  const [chargeConcept, setChargeConcept] = useState("");
  const [depositReturned, setDepositReturned] = useState(
    Number(contract.deposit ?? 0) > 0,
  );
  const [conformitySignedBy, setConformitySignedBy] = useState(
    contract.customerName ?? "",
  );
  const [conformitySignatureDataUrl, setConformitySignatureDataUrl] = useState<
    string | null
  >(null);

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
    return { owed, paid, balance, payment };
  }, [
    amountPaidBase,
    complementaryAmount,
    contract.total,
    damageCharges,
    extraCharges,
    finalPayment,
    fuelCharges,
  ]);

  const closeConformitySigned = contract.signatures.some(
    (s) => s.signer_type === "CLOSE_CONFORMITY",
  );
  const hasConformitySignature =
    closeConformitySigned || Boolean(conformitySignatureDataUrl);

  const hasCheckIn = Boolean(checkIn);
  const hasFuelAndMileage = Boolean(
    checkIn?.mileage != null && checkIn?.fuel_level != null,
  );
  const hasAccessories = Boolean(checkIn && checkIn.checklist.length > 0);
  const returnReviewed = Boolean(actualReturnAt);

  const canClose =
    hasCheckIn &&
    hasFuelAndMileage &&
    hasAccessories &&
    returnReviewed &&
    hasConformitySignature;

  const steps: Array<{
    id: StepId;
    title: string;
    description: string;
    done: boolean;
    required: boolean;
  }> = [
    {
      id: "checkin",
      title: "Inspección de entrada",
      description: hasCheckIn
        ? "Inspección registrada"
        : "Crear CHECK_IN del vehículo",
      done: hasCheckIn,
      required: true,
    },
    {
      id: "fuel",
      title: "Combustible y km",
      description: hasFuelAndMileage
        ? "Datos de entrada listos"
        : "Completar en la inspección",
      done: hasFuelAndMileage,
      required: true,
    },
    {
      id: "accessories",
      title: "Accesorios",
      description: hasAccessories
        ? "Checklist comparado"
        : "Completar checklist de entrada",
      done: hasAccessories,
      required: true,
    },
    {
      id: "timing",
      title: "Antes / después",
      description: "Acuerdo de devolución y días extra",
      done: returnReviewed,
      required: true,
    },
    {
      id: "charges",
      title: "Saldo y pago",
      description:
        billing.balance <= 0
          ? "Saldo en cero"
          : `Saldo ${formatMoney(billing.balance)}`,
      done: true,
      required: true,
    },
    {
      id: "close",
      title: "Conformidad y cierre",
      description: hasConformitySignature
        ? "Firma de conformidad lista"
        : "Declaración + firma del cliente",
      done: hasConformitySignature,
      required: true,
    },
  ];

  const current = steps[stepIndex] ?? steps[0];
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= steps.length - 1;

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
    if (!hasConformitySignature) {
      missing.push("obtener la firma de conformidad del cliente");
    }
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
    formData.set("chargeConcept", chargeConcept);
    formData.set("depositReturned", depositReturned ? "true" : "false");
    formData.set("confirmClose", "true");
    if (conformitySignatureDataUrl) {
      formData.set("conformitySignatureDataUrl", conformitySignatureDataUrl);
      formData.set(
        "conformitySignedBy",
        conformitySignedBy.trim() || contract.customerName || "Cliente",
      );
    }

    const result = await closeContract(contract.id, formData);
    setClosing(false);

    if (!result.success) {
      setConfirmOpen(false);
      setError(result.error);
      return;
    }

    window.open(
      `/dashboard/contratos/${contract.id}/acta-cierre/pdf`,
      "_blank",
      "noopener,noreferrer",
    );
    router.push(`/dashboard/contratos/${contract.id}`);
    router.refresh();
  }

  function goNext() {
    setError(null);
    if (isLast) {
      openConfirm();
      return;
    }
    if (current.required && !current.done) {
      const missing = missingRequirements();
      setError(
        missing.length > 0
          ? `Complete este paso antes de continuar: ${missing[0]}.`
          : "Complete este paso antes de continuar.",
      );
      return;
    }
    setStepIndex((value) => Math.min(value + 1, steps.length - 1));
  }

  function goPrev() {
    setError(null);
    setStepIndex((value) => Math.max(value - 1, 0));
  }

  return (
    <div className="space-y-4">
      {!canClose ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            Aún no se puede cerrar esta renta
          </p>
          <p className="mt-1">
            Esto <strong>no se resuelve anulando</strong> el contrato. Anular
            cancela el documento y ya no podrá completar el cierre ni generar el
            acta. Complete lo pendiente:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {!hasCheckIn ? (
              <li>
                Crear inspección de entrada (CHECK_IN){" "}
                <Link
                  href={`/dashboard/inspecciones/nuevo?reservation_id=${contract.reservation_id}&type=CHECK_IN`}
                  className="font-medium underline"
                >
                  Ir a crear inspección
                </Link>
              </li>
            ) : null}
            {hasCheckIn && !hasFuelAndMileage ? (
              <li>
                Registrar combustible y km en la inspección{" "}
                <Link
                  href={`/dashboard/inspecciones/${checkIn!.id}`}
                  className="font-medium underline"
                >
                  Abrir inspección
                </Link>
              </li>
            ) : null}
            {hasCheckIn && !hasAccessories ? (
              <li>
                Completar checklist de accesorios{" "}
                <Link
                  href={`/dashboard/inspecciones/${checkIn!.id}#accesorios`}
                  className="font-medium underline"
                >
                  Abrir accesorios
                </Link>
              </li>
            ) : null}
            {!returnReviewed ? (
              <li>Indicar fecha/hora real de devolución en el paso “Antes / después”</li>
            ) : null}
            {!hasConformitySignature ? (
              <li>
                Capturar la firma de conformidad del cliente en el último paso
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Flujo de cierre — paso a paso
          </CardTitle>
          <p className="text-sm text-muted">
            Igual que la entrega: avance de izquierda a derecha. Solo se muestra
            el paso actual para no saturar la pantalla.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="flex gap-2 overflow-x-auto pb-1">
            {steps.map((step, index) => (
              <li key={step.id} className="min-w-[9.5rem] flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStepIndex(index);
                  }}
                  className={cn(
                    "h-full w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                    index === stepIndex && "ring-2 ring-brand/30",
                    step.done
                      ? "border-green-200 bg-green-50/50"
                      : "border-border bg-white",
                    !step.done &&
                      step.required &&
                      index !== stepIndex &&
                      "border-amber-200 bg-amber-50/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {index + 1}. {step.title}
                    </span>
                    {step.done ? (
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-green-800">
                        Listo
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">
                    {step.description}
                  </p>
                </button>
              </li>
            ))}
          </ol>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Paso {stepIndex + 1} de {steps.length}
                </p>
                <h3 className="text-base font-semibold">{current.title}</h3>
              </div>
              <Badge
                variant={
                  current.done
                    ? "success"
                    : current.required
                      ? "warning"
                      : "default"
                }
              >
                {current.done
                  ? "Listo"
                  : current.required
                    ? "Requerido"
                    : "Opcional"}
              </Badge>
            </div>

            {current.id === "checkin" ? (
              <div className="space-y-3 text-sm">
                {checkIn ? (
                  <p>
                    Inspección de entrada lista.{" "}
                    <Link
                      href={`/dashboard/inspecciones/${checkIn.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      Ver / editar inspección
                    </Link>
                  </p>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="font-medium text-amber-950">
                      Primero revise el vehículo con una inspección de entrada.
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
              </div>
            ) : null}

            {current.id === "fuel" ? (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
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
                      ? FUEL_LEVEL_LABELS[checkIn.fuel_level] ??
                        checkIn.fuel_level
                      : "Sin registrar"}
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
              </div>
            ) : null}

            {current.id === "accessories" ? (
              <div className="space-y-3 text-sm">
                {accessoryComparison.length === 0 ? (
                  <p className="text-amber-800">
                    Complete el checklist de accesorios en la inspección de
                    entrada.
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
                  <div className="max-h-72 overflow-auto rounded-lg border border-border">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="sticky top-0 bg-surface-muted">
                        <tr className="border-b border-border text-muted">
                          <th className="px-3 py-2 font-medium">Accesorio</th>
                          <th className="px-3 py-2 font-medium">Salida</th>
                          <th className="px-3 py-2 font-medium">Entrada</th>
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
                            <td className="px-3 py-2">{row.itemName}</td>
                            <td className="px-3 py-2">
                              {row.checkOutStatus
                                ? CHECKLIST_STATUS_LABELS[row.checkOutStatus] ??
                                  row.checkOutStatus
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
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
              </div>
            ) : null}

            {current.id === "timing" ? (
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-blue-950">
                  <p className="font-medium">¿Se regresó antes o después?</p>
                  <p className="mt-1">
                    Fin pactado:{" "}
                    <strong>{formatAppDateTime(contract.end_at)}</strong>.
                    Margen de cortesía:{" "}
                    <strong>{extraDayGraceHours} h</strong>.
                  </p>
                  {extraDayPreview ? (
                    <p className="mt-2">
                      Retraso: <strong>{extraDayPreview.delayHours} h</strong> ·
                      Días extra sugeridos:{" "}
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
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setExtraCharges("0")}
                  >
                    No cobrar extra
                  </Button>
                </div>
              </div>
            ) : null}

            {current.id === "charges" ? (
              <div className="space-y-4 text-sm">
                <div className="grid gap-4 sm:grid-cols-2">
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
                  <div className="sm:col-span-2">
                    <Input
                      label="Concepto de cargo (acta)"
                      value={chargeConcept}
                      onChange={(e) => setChargeConcept(e.target.value)}
                      placeholder="Ej. días extra, combustible, daños…"
                    />
                  </div>
                </div>
                {Number(contract.deposit ?? 0) > 0 ? (
                  <label className="flex items-start gap-2 rounded-lg border border-border bg-white p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={depositReturned}
                      onChange={(e) => setDepositReturned(e.target.checked)}
                    />
                    <span>
                      Garantía / depósito de{" "}
                      <strong>{formatMoney(Number(contract.deposit ?? 0))}</strong>{" "}
                      fue <strong>devuelta</strong> al cliente. Desmarque si se
                      retiene parcial o total.
                    </span>
                  </label>
                ) : null}
                <Textarea
                  label="Notas de cierre"
                  rows={3}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                />
                <div className="grid gap-2 rounded-lg border border-border bg-surface-muted/40 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-muted">Total renta</p>
                    <p className="font-medium">{formatMoney(contract.total)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Total adeudado</p>
                    <p className="font-medium">{formatMoney(billing.owed)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Abonado</p>
                    <p className="font-medium">{formatMoney(billing.paid)}</p>
                  </div>
                  <div className="sm:col-span-3">
                    <p className="text-muted">Saldo pendiente</p>
                    <p className="text-lg font-semibold">
                      {formatMoney(billing.balance)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {current.id === "close" ? (
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-blue-950">
                  <p className="font-semibold">Declaración de conformidad</p>
                  <p className="mt-2 leading-relaxed">{CLOSE_CONFORMITY_TEXT}</p>
                  <p className="mt-2 text-xs text-blue-900/80">
                    En el cierre no se vuelven a aceptar términos y condiciones;
                    solo esta declaración y la firma del cliente.
                  </p>
                </div>

                {closeConformitySigned && !conformitySignatureDataUrl ? (
                  <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-900">
                    Ya existe una firma de conformidad registrada para este
                    contrato.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <Input
                      label="Nombre del firmante (cliente)"
                      value={conformitySignedBy}
                      onChange={(e) => setConformitySignedBy(e.target.value)}
                    />
                    {conformitySignatureDataUrl ? (
                      <div className="space-y-2">
                        <p className="font-medium text-green-800">
                          Firma de conformidad capturada.
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={conformitySignatureDataUrl}
                          alt="Firma de conformidad"
                          className="h-20 max-w-full rounded border border-border bg-white object-contain"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setConformitySignatureDataUrl(null)}
                        >
                          Volver a firmar
                        </Button>
                      </div>
                    ) : (
                      <SignaturePad
                        onConfirm={(dataUrl) =>
                          setConformitySignatureDataUrl(dataUrl)
                        }
                        disabled={closing}
                      />
                    )}
                  </div>
                )}

                {!canClose ? (
                  <p className="text-amber-900">
                    Aún faltan pasos requeridos (inspección, cargos o firma).
                  </p>
                ) : (
                  <p className="text-green-800">
                    Conformidad lista. Confirme el cierre cuando esté seguro.
                  </p>
                )}
                <Button
                  type="button"
                  onClick={openConfirm}
                  disabled={!canClose || closing}
                >
                  Revisar y cerrar contrato
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/40 p-3">
            <p className="text-sm text-muted">
              {current.description}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={isFirst}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={goNext}
                disabled={
                  (!isLast && current.required && !current.done) || closing
                }
              >
                {isLast ? "Confirmar cierre" : "Siguiente"}
                {!isLast ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold">
              ¿Está seguro de cerrar este contrato?
            </h3>
            <p className="mt-2 text-sm text-muted">
              Esta acción marca el contrato como <strong>COMPLETADO</strong> y
              libera el vehículo.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                Contrato: <strong>{contract.code}</strong>
              </li>
              <li>
                Devolución:{" "}
                <strong>
                  {actualReturnAt
                    ? formatAppDateTime(new Date(actualReturnAt).toISOString())
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
