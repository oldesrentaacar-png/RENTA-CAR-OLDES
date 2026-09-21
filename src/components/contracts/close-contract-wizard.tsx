"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  closeContract,
  saveCloseCheckInVitals,
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
  FUEL_LEVEL_ORDER,
} from "@/lib/inspections/defaults";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { closeActPdfHref } from "@/lib/pdf/pdf-cache";
import { cn } from "@/lib/utils";

type CloseContractWizardProps = {
  context: ContractCloseContext;
  canSign: boolean;
  canManageCourtesy?: boolean;
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
  canManageCourtesy = false,
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
  const [courtesyAmount, setCourtesyAmount] = useState(
    String(contract.courtesy_amount ?? 0),
  );
  const [courtesyDetail, setCourtesyDetail] = useState(
    contract.courtesy_detail ?? "",
  );
  const priorCourtesy = Number(contract.courtesy_amount ?? 0);
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
  const [mileageInput, setMileageInput] = useState(
    checkIn?.mileage != null ? String(checkIn.mileage) : "",
  );
  const [fuelLevelInput, setFuelLevelInput] = useState(
    checkIn?.fuel_level ?? "",
  );
  const [savedMileage, setSavedMileage] = useState<number | null>(
    checkIn?.mileage ?? null,
  );
  const [savedFuelLevel, setSavedFuelLevel] = useState<string | null>(
    checkIn?.fuel_level ?? null,
  );
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsOk, setVitalsOk] = useState<string | null>(null);
  const [checklistReady, setChecklistReady] = useState(
    Boolean(checkIn && checkIn.checklist.length > 0),
  );

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
    const courtesy = canManageCourtesy
      ? parseMoneyInput(courtesyAmount || 0)
      : priorCourtesy;
    const additionalCourtesy = Math.max(0, courtesy - priorCourtesy);
    const owed = Math.max(
      0,
      Number(contract.total) +
        extra +
        damage +
        fuel +
        complementary -
        additionalCourtesy,
    );
    const paid = amountPaidBase + payment;
    const balance = Math.max(0, owed - paid);
    return { owed, paid, balance, payment, courtesy, additionalCourtesy };
  }, [
    amountPaidBase,
    canManageCourtesy,
    complementaryAmount,
    contract.total,
    courtesyAmount,
    damageCharges,
    extraCharges,
    finalPayment,
    fuelCharges,
    priorCourtesy,
  ]);

  const closeConformitySigned = contract.signatures.some(
    (s) => s.signer_type === "CLOSE_CONFORMITY",
  );
  const hasConformitySignature =
    closeConformitySigned || Boolean(conformitySignatureDataUrl);

  const hasCheckIn = Boolean(checkIn);
  const liveMileage =
    mileageInput.trim() !== "" ? Number(mileageInput) : null;
  const liveFuel = fuelLevelInput.trim() ? fuelLevelInput.trim() : null;
  const effectiveMileage =
    liveMileage != null && Number.isFinite(liveMileage) && liveMileage >= 0
      ? liveMileage
      : savedMileage;
  const effectiveFuel = liveFuel || savedFuelLevel;
  const hasFuelAndMileage = Boolean(
    effectiveMileage != null &&
      Number.isFinite(effectiveMileage) &&
      effectiveMileage >= 0 &&
      effectiveFuel,
  );
  const hasAccessories = Boolean(
    checklistReady || (checkIn && checkIn.checklist.length > 0),
  );
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
        ? hasFuelAndMileage
          ? "Inspección lista con km y combustible"
          : "Inspección creada — complete km y combustible en el siguiente paso"
        : "Crear CHECK_IN del vehículo",
      // Km/combustible se validan en el paso "fuel", no aquí.
      done: hasCheckIn,
      required: true,
    },
    {
      id: "fuel",
      title: "Combustible y km",
      description: hasFuelAndMileage
        ? "Datos de entrada listos"
        : "Regístrelos aquí (no hace falta salir)",
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
    if (hasCheckIn && effectiveMileage == null) {
      missing.push("registrar el kilometraje en el paso Combustible y km");
    }
    if (hasCheckIn && !effectiveFuel) {
      missing.push("registrar el combustible en el paso Combustible y km");
    }
    if (hasCheckIn && !hasAccessories) {
      missing.push("completar el checklist de accesorios en la inspección");
    }
    if (!returnReviewed) missing.push("indicar la hora real de devolución");
    if (!hasConformitySignature) {
      missing.push(
        "obtener la firma de conformidad del cliente (paso final — distinta de la firma del contrato)",
      );
    }
    return missing;
  }

  async function saveVitals() {
    if (!checkIn) {
      setError("Primero cree la inspección de entrada.");
      return false;
    }
      if (!mileageInput.trim()) {
      setError(
        "El kilometraje es obligatorio. Indíquelo aquí; si necesita salir, use Anterior o Salir.",
      );
      return false;
    }
    const mileage = Number(mileageInput);
    if (!Number.isInteger(mileage) || mileage < 0) {
      setError(
        "Indique un kilometraje válido (número entero). Puede corregirlo y continuar; o use Anterior / Salir.",
      );
      return false;
    }
    if (!fuelLevelInput.trim()) {
      setError(
        "El combustible es obligatorio. Selecciónelo aquí; o use Anterior / Salir.",
      );
      return false;
    }
    setSavingVitals(true);
    setError(null);
    setVitalsOk(null);
    try {
      const result = await saveCloseCheckInVitals(contract.id, {
        mileage,
        fuelLevel: fuelLevelInput.trim(),
      });
      if (!result.success) {
        setError(result.error);
        return false;
      }
      setSavedMileage(result.data.mileage);
      setSavedFuelLevel(result.data.fuelLevel);
      if (result.data.hasChecklist) setChecklistReady(true);
      setVitalsOk(
        "Kilometraje y combustible guardados. Puede corregirlos de nuevo si hace falta.",
      );
      router.refresh();
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar km/combustible. Intente de nuevo o salga del cierre.",
      );
      return false;
    } finally {
      setSavingVitals(false);
    }
  }

  async function goNext() {
    setError(null);
    if (current.id === "fuel" && hasCheckIn) {
      // Validación local primero: no llamar al servidor si falta km/combustible.
      if (!mileageInput.trim() || !fuelLevelInput.trim()) {
        setError(
          "Kilometraje y combustible son obligatorios para continuar. Use Anterior o Salir si necesita salir; los campos siguen editables.",
        );
        return;
      }
      const needsSave =
        savedMileage == null ||
        !savedFuelLevel ||
        String(savedMileage) !== mileageInput.trim() ||
        savedFuelLevel !== fuelLevelInput.trim();
      if (needsSave || !hasFuelAndMileage) {
        const ok = await saveVitals();
        if (!ok) return;
      }
      if (isLast) {
        openConfirm();
        return;
      }
      setStepIndex((value) => Math.min(value + 1, steps.length - 1));
      return;
    }
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

  function goToStep(index: number) {
    const target = Math.max(0, Math.min(index, steps.length - 1));
    if (target > stepIndex) {
      const blocker = steps
        .slice(0, target)
        .find((step) => step.required && !step.done);
      if (blocker) {
        const blockerIndex = steps.findIndex((step) => step.id === blocker.id);
        setError(
          `Complete primero «${blocker.title}». El kilometraje y combustible son obligatorios para el seguimiento de mantenimiento.`,
        );
        if (blockerIndex >= 0) setStepIndex(blockerIndex);
        return;
      }
    }
    setError(null);
    setStepIndex(target);
  }

  function openConfirm() {
    setError(null);
    const missing = missingRequirements();
    if (missing.length > 0) {
      setError(`Antes de cerrar debe: ${missing.join("; ")}.`);
      if (
        missing.some((item) => item.includes("kilometraje") || item.includes("combustible"))
      ) {
        const fuelIndex = steps.findIndex((step) => step.id === "fuel");
        if (fuelIndex >= 0) setStepIndex(fuelIndex);
      }
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmAndClose() {
    setClosing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("extraCharges", extraCharges);
      formData.set("damageCharges", damageCharges);
      formData.set("fuelCharges", fuelCharges);
      formData.set("complementaryAmount", complementaryAmount);
      formData.set("finalPayment", finalPayment);
      formData.set("courtesyHours", courtesyHours);
      formData.set("courtesyDays", courtesyDays);
      if (canManageCourtesy) {
        formData.set("courtesyAmount", courtesyAmount);
        formData.set("courtesyDetail", courtesyDetail.trim());
      }
      formData.set("graceExtraDaysWaived", graceExtraDaysWaived);
      formData.set("actualReturnAt", actualReturnAt);
      formData.set("deliveredByName", deliveredByName);
      formData.set("receivedByName", receivedByName);
      formData.set("closeNotes", closeNotes);
      formData.set("chargeConcept", chargeConcept);
      formData.set("depositReturned", depositReturned ? "true" : "false");
      formData.set("confirmClose", "true");
      if (effectiveMileage != null && effectiveFuel) {
        formData.set("checkInMileage", String(effectiveMileage));
        formData.set("checkInFuelLevel", effectiveFuel);
      }
      if (conformitySignatureDataUrl) {
        formData.set("conformitySignatureDataUrl", conformitySignatureDataUrl);
        formData.set(
          "conformitySignedBy",
          conformitySignedBy.trim() || contract.customerName || "Cliente",
        );
      }

      const result = await closeContract(contract.id, formData);

      if (!result.success) {
        setConfirmOpen(false);
        setError(result.error);
        if (
          /kilometr|combustible/i.test(result.error) ||
          /Combustible y km/i.test(result.error)
        ) {
          const fuelIndex = steps.findIndex((step) => step.id === "fuel");
          if (fuelIndex >= 0) setStepIndex(fuelIndex);
        }
        return;
      }

      window.open(
        closeActPdfHref(contract.id, new Date().toISOString()),
        "_blank",
        "noopener,noreferrer",
      );
      router.push(`/dashboard/contratos/${contract.id}`);
      router.refresh();
    } catch (err) {
      setConfirmOpen(false);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cerrar el contrato. Intente de nuevo o salga del cierre.",
      );
    } finally {
      setClosing(false);
    }
  }

  function goPrev() {
    setError(null);
    setSavingVitals(false);
    if (isFirst) {
      router.push(`/dashboard/contratos/${contract.id}`);
      return;
    }
    setStepIndex((value) => Math.max(value - 1, 0));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted/40 px-3 py-2 text-sm">
        <p className="text-muted">
          Cierre de <strong>{contract.code}</strong>
          {contract.customerName ? ` · ${contract.customerName}` : ""}
        </p>
        <Link
          href={`/dashboard/contratos/${contract.id}`}
          className="font-medium text-brand hover:underline"
        >
          Salir del cierre (volver al contrato)
        </Link>
      </div>

      {!canClose ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            Aún no se puede cerrar esta renta
          </p>
          <p className="mt-1">
            Esto <strong>no se resuelve anulando</strong> el contrato. Anular
            cancela el documento y ya no podrá completar el cierre ni generar el
            acta. Complete lo pendiente <strong>en esta misma pantalla</strong>:
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
            {hasCheckIn && effectiveMileage == null ? (
              <li>
                Registrar <strong>kilometraje</strong> en el paso «Combustible y
                km» (abajo en este wizard)
              </li>
            ) : null}
            {hasCheckIn && !effectiveFuel ? (
              <li>
                Registrar <strong>combustible</strong> en el paso «Combustible y
                km» (abajo en este wizard)
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
                Capturar la <strong>firma de conformidad al devolver</strong> en
                el último paso (es distinta de la firma del contrato al entregar)
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
                    onClick={() => goToStep(index)}
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
              <div className="space-y-4 text-sm">
                {!checkIn ? (
                  <p className="text-amber-900">
                    Primero cree la inspección de entrada en el paso anterior.
                  </p>
                ) : (
                  <>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                      <p className="font-semibold">
                        Kilometraje obligatorio
                      </p>
                      <p className="mt-1 text-sm">
                        Sin el km de entrada no se puede cerrar el contrato. Así
                        el sistema puede alertar mantenimientos (aceite, frenos,
                        caja, etc.). Si se equivoca, corrija aquí o use{" "}
                        <strong>Anterior / Salir</strong>; no queda trabado.
                      </p>
                    </div>
                    <p className="text-muted">
                      Registre aquí el kilometraje y combustible de entrada. No
                      necesita salir a otra pantalla.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Kilometraje entrada *"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={mileageInput}
                        onChange={(e) => {
                          setMileageInput(e.target.value);
                          setSavedMileage(null);
                          setVitalsOk(null);
                        }}
                        placeholder="Ej. 45230"
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700">
                          Combustible entrada *
                        </label>
                        <select
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                          value={fuelLevelInput}
                          onChange={(e) => {
                            setFuelLevelInput(e.target.value);
                            setSavedFuelLevel(null);
                            setVitalsOk(null);
                          }}
                        >
                          <option value="">Seleccionar…</option>
                          {FUEL_LEVEL_ORDER.map((level) => (
                            <option key={level} value={level}>
                              {FUEL_LEVEL_LABELS[level] ?? level}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {checkOut ? (
                      <p className="text-xs text-muted">
                        Referencia salida:{" "}
                        {checkOut.mileage != null
                          ? `${checkOut.mileage.toLocaleString("es-SV")} km`
                          : "sin km"}
                        {" · "}
                        {checkOut.fuel_level
                          ? FUEL_LEVEL_LABELS[checkOut.fuel_level] ??
                            checkOut.fuel_level
                          : "sin combustible"}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted">
                      Puede corregir km o combustible en cualquier momento y
                      volver a guardar antes de continuar.
                    </p>
                    {vitalsOk ? (
                      <p className="text-sm text-emerald-700">{vitalsOk}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => void saveVitals()}
                        loading={savingVitals}
                        disabled={savingVitals}
                      >
                        {hasFuelAndMileage
                          ? "Actualizar km y combustible"
                          : "Guardar km y combustible"}
                      </Button>
                      {hasFuelAndMileage ? (
                        <Badge variant="success">Listo para continuar</Badge>
                      ) : (
                        <Badge variant="warning">Pendiente</Badge>
                      )}
                    </div>
                  </>
                )}
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
                {canManageCourtesy ? (
                  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <p className="font-medium text-amber-950">
                      Cortesía manual (solo administrador)
                    </p>
                    <p className="text-xs text-amber-900/80">
                      Monto de descuento cuando horas o días no cuadran. Si ya
                      había cortesía en el total del contrato ($
                      {priorCourtesy.toFixed(2)}), solo el incremento adicional
                      reduce el saldo al cerrar.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Monto de cortesía / descuento (USD)"
                        type="number"
                        step="0.01"
                        min="0"
                        value={courtesyAmount}
                        onChange={(e) => setCourtesyAmount(e.target.value)}
                      />
                      <Textarea
                        label="Detalle de la cortesía"
                        rows={3}
                        value={courtesyDetail}
                        onChange={(e) => setCourtesyDetail(e.target.value)}
                        placeholder="Ej. 3 h de retraso no cobradas · día extra"
                      />
                    </div>
                  </div>
                ) : priorCourtesy > 0 ? (
                  <p className="text-sm text-muted">
                    Cortesía ya aplicada en el contrato:{" "}
                    {formatMoney(priorCourtesy)}
                    {contract.courtesy_detail
                      ? ` · ${contract.courtesy_detail}`
                      : ""}
                  </p>
                ) : null}
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
                {contract.notes?.trim() ? (
                  <div className="rounded-lg border border-border bg-surface-muted/40 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Notas del contrato
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {contract.notes.trim()}
                    </p>
                  </div>
                ) : null}
                <Textarea
                  label="Notas de cierre (adicionales)"
                  rows={3}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Se agregan a las notas del contrato al cerrar"
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
                    Aún faltan pasos:{" "}
                    {missingRequirements().join("; ") ||
                      "revise la lista de arriba"}.
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
                disabled={closing}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {isFirst ? "Salir" : "Anterior"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void goNext()}
                disabled={closing}
                loading={savingVitals}
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
                onClick={() => {
                  setClosing(false);
                  setConfirmOpen(false);
                }}
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
