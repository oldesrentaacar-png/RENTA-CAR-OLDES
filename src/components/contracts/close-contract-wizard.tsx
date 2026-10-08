"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  closeContract,
  saveCloseCheckInVitals,
  type ContractCloseContext,
} from "@/app/dashboard/contratos/actions";
import {
  FlowToast,
  MissingFieldsBanner,
  ScrollHint,
} from "@/components/contracts/flow-coach";
import { SignaturePad } from "@/components/contracts/signature-pad";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateReturnSettlement,
  calculateSuggestedExtraDayCharge,
} from "@/lib/calculations/rental-close";
import {
  formatAppDateTime,
  normalizeFormDateTimeToIso,
  toDatetimeLocalValue,
} from "@/lib/dates";
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

  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [closing, setClosing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const [actualReturnAt, setActualReturnAt] = useState(
    toDatetimeLocalValue(
      checkIn?.inspection_date ?? contract.end_at ?? new Date(),
    ),
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
  const [coachToast, setCoachToast] = useState<{
    text: string;
    tick: number;
  } | null>(null);
  const [, setChecklistReady] = useState(
    Boolean(checkIn && checkIn.checklist.length > 0),
  );
  const [showOptionalClose, setShowOptionalClose] = useState(false);

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

  const returnSettlement = useMemo(() => {
    if (!actualReturnAt || !contract.start_at) return null;
    try {
      return calculateReturnSettlement({
        startAt: contract.start_at,
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
    contract.start_at,
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
    const dayAdjustment = returnSettlement?.dayAdjustment ?? 0;
    const owed = Math.max(
      0,
      Number(contract.total) +
        extra +
        damage +
        fuel +
        complementary +
        dayAdjustment -
        additionalCourtesy,
    );
    const paid = amountPaidBase + payment;
    const balance = Math.round((owed - paid) * 100) / 100;
    return {
      owed,
      paid,
      balance,
      payment,
      courtesy,
      additionalCourtesy,
      dayAdjustment,
      fuel,
    };
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
    returnSettlement,
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
  const canClose =
    hasCheckIn && hasFuelAndMileage && hasConformitySignature;

  const steps: Array<{
    id: StepId;
    title: string;
    description: string;
    done: boolean;
    required: boolean;
  }> = [
    ...(!hasCheckIn
      ? [
          {
            id: "checkin" as const,
            title: "Inspección de entrada",
            description: "Crear la revisión del vehículo al regresar",
            done: false,
            required: true,
          },
        ]
      : []),
    {
      id: "fuel",
      title: "Espejo: salida → recepción",
      description: hasFuelAndMileage
        ? "Km y combustible de entrada listos. Siguiente: firma"
        : "Compare con cuánto salió y registre cómo vuelve",
      done: hasFuelAndMileage,
      required: true,
    },
    {
      id: "close",
      title: "Firma del cliente",
      description: hasConformitySignature
        ? "Firma lista. Ya puede cerrar"
        : "El cliente firma aquí, en esta pantalla",
      done: hasConformitySignature,
      required: true,
    },
  ];

  const current = steps[stepIndex] ?? steps[0];
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= steps.length - 1;

  // No saltar a la firma: el operador debe ver siempre el espejo salida|entrada
  // (combustible y km con los que debe recibir el vehículo).

  useEffect(() => {
    if (stepIndex > steps.length - 1) {
      setStepIndex(Math.max(0, steps.length - 1));
    }
  }, [stepIndex, steps.length]);

  function missingRequirements(): string[] {
    const missing: string[] = [];
    if (!hasCheckIn) missing.push("crear la inspección de entrada (CHECK_IN)");
    if (hasCheckIn && effectiveMileage == null) {
      missing.push("registrar el kilometraje en el paso Kilometraje");
    }
    if (hasCheckIn && !effectiveFuel) {
      missing.push("registrar el combustible en el paso Kilometraje");
    }
    if (!hasConformitySignature) {
      missing.push(
        "que el cliente firme y pulse Confirmar firma en este paso",
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
        "Kilometraje y combustible guardados. Siguiente: la firma del cliente.",
      );
      setCoachToast({
        text: "Kilometraje y combustible guardados.",
        tick: Date.now(),
      });
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
      const closeIndex = steps.findIndex((step) => step.id === "close");
      if (closeIndex >= 0) {
        setStepIndex(closeIndex);
        return;
      }
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

  const nextBlocked =
    (current.id === "checkin" && !hasCheckIn) ||
    (current.id === "fuel" && !hasFuelAndMileage) ||
    (current.id === "close" && !canClose);
  const nextBlockedReason = missingRequirements()[0] ?? "Complete este paso.";

  return (
    <div className="space-y-4">
      <FlowToast
        message={coachToast?.text ?? null}
        tick={coachToast?.tick ?? 0}
      />
      <ScrollHint
        message={
          current.id === "close"
            ? "Deslice para firmar y cerrar."
            : "Deslice para ver kilometraje y combustible."
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted/40 px-3 py-2 text-sm">
        <p className="text-muted">
          Recibir vehículo · <strong>{contract.code}</strong>
          {contract.customerName ? ` · ${contract.customerName}` : ""}
        </p>
        <Link
          href={`/dashboard/contratos/${contract.id}`}
          className="font-medium text-brand hover:underline"
        >
          Salir
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recibir vehículo
          </CardTitle>
          <p className="text-sm text-muted">
            1) Km y combustible · 2) Firma del cliente · Cerrar.
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

          <div className="flex flex-col rounded-xl border border-border bg-white p-4 sm:p-5">
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
                {!checkOut ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
                    <p className="font-semibold">
                      No hay inspección de salida en este contrato
                    </p>
                    <p className="mt-1">
                      Sin esa referencia no se puede saber con cuánto combustible
                      debió regresar. Genere/revise la CHECK_OUT de la reserva.
                    </p>
                  </div>
                ) : null}

                {!checkIn ? (
                  <p className="text-amber-900">
                    Preparando inspección de entrada… Si no aparece, vuelva a
                    abrir Cerrar renta.
                  </p>
                ) : (
                  <>
                    <p className="rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-muted">
                      Reciba en ~5 minutos: izquierda = cómo salió · derecha =
                      cómo vuelve. Rayones de salida en gris; solo marque nuevos en rojo.
                    </p>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border-2 border-slate-300 bg-slate-100 px-4 py-3 text-slate-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Izquierda · Cómo se entregó
                        </p>
                        <p className="mt-2 text-xs font-medium text-slate-600">
                          Combustible salida
                        </p>
                        <p className="text-2xl font-semibold tabular-nums">
                          {checkOut?.fuel_level
                            ? FUEL_LEVEL_LABELS[checkOut.fuel_level] ??
                              checkOut.fuel_level
                            : "—"}
                        </p>
                        <p className="mt-2 text-xs font-medium text-slate-600">
                          Kilometraje salida
                        </p>
                        <p className="text-lg font-semibold tabular-nums">
                          {checkOut?.mileage != null
                            ? `${checkOut.mileage.toLocaleString("es-SV")} km`
                            : "—"}
                        </p>
                        {checkOut ? (
                          <Link
                            href={`/dashboard/inspecciones/${checkOut.id}`}
                            className="mt-3 inline-flex text-sm font-medium text-brand hover:underline"
                          >
                            Ver inspección de salida
                          </Link>
                        ) : null}
                      </div>

                      <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-red-950">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
                          Derecha · Cómo lo recibe ahora
                        </p>
                        <p className="mt-2 text-xs text-red-800">
                          Debe recibir al menos el combustible de la izquierda
                          (salvo acuerdo).
                        </p>
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Combustible entrada *
                            </label>
                            <select
                              className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"
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
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-white px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          Inventario (espejo salida → entrada)
                        </p>
                        {checkIn ? (
                          <Link
                            href={`/dashboard/inspecciones/${checkIn.id}#accesorios`}
                            className="text-sm font-medium text-brand hover:underline"
                          >
                            Editar accesorios / mapa de daños
                          </Link>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        El inventario de entrada parte igual al de salida. Solo
                        cambie lo que falte o esté dañado. En el mapa:{" "}
                        <strong>gris = salida</strong>,{" "}
                        <strong>rojo = daño nuevo</strong>.
                      </p>
                      {accessoryComparison.length === 0 ? (
                        <p className="mt-2 text-amber-800">
                          Sin ítems aún. Abra accesorios para completar el
                          checklist.
                        </p>
                      ) : (
                        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-border">
                          <table className="w-full min-w-[28rem] text-left text-sm">
                            <thead className="sticky top-0 bg-surface-muted">
                              <tr className="border-b border-border text-muted">
                                <th className="px-3 py-2 font-medium">
                                  Accesorio
                                </th>
                                <th className="px-3 py-2 font-medium">Salida</th>
                                <th className="px-3 py-2 font-medium">
                                  Entrada
                                </th>
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
                                  <td className="px-3 py-2 text-slate-600">
                                    {row.checkOutStatus
                                      ? CHECKLIST_STATUS_LABELS[
                                          row.checkOutStatus
                                        ] ?? row.checkOutStatus
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {row.checkInStatus
                                      ? CHECKLIST_STATUS_LABELS[
                                          row.checkInStatus
                                        ] ?? row.checkInStatus
                                      : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

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
                        <Badge variant="success">Listo para firmar</Badge>
                      ) : (
                        <Badge variant="warning">Pendiente km/combustible</Badge>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {showOptionalClose ? (
              <div className="order-last space-y-3 border-t border-border pt-4 text-sm">
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

            {showOptionalClose ? (
              <div className="order-last space-y-4 border-t border-border pt-4 text-sm">
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

            {showOptionalClose ? (
              <div className="order-last space-y-4 border-t border-border pt-4 text-sm">
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
                <p className="text-xs text-muted">
                  Las observaciones del contrato son un solo cuadro (sección 4).
                  No se escribe otra nota aquí.
                </p>
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
                    <p className="text-sm font-medium text-muted">Saldo pendiente</p>
                    <p className="text-3xl font-semibold tracking-tight text-foreground">
                      {formatMoney(billing.balance)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {current.id === "close" ? (
              <div className="space-y-4 text-sm">
                <div className="rounded-xl border border-border bg-surface-muted/40 p-4">
                  <p className="font-semibold text-foreground">
                    Lo pactado no se reabre
                  </p>
                  <p className="mt-1 text-muted">
                    Fechas y tarifa del contrato quedan como se firmaron. Aquí
                    solo se ajusta la recepción: días de más suman, días de
                    menos restan, y el combustible distinto se cobra aparte.
                  </p>
                  <p className="mt-2">
                    Pactado:{" "}
                    <strong>
                      {returnSettlement?.agreedDays ?? "—"} días
                    </strong>{" "}
                    hasta{" "}
                    <strong>{formatAppDateTime(contract.end_at)}</strong> ·{" "}
                    {formatMoney(contract.total)} a{" "}
                    {formatMoney(contract.agreed_rate)} por día.
                  </p>
                </div>
                <Input
                  label="Hora real de devolución"
                  type="datetime-local"
                  value={actualReturnAt}
                  onChange={(e) => setActualReturnAt(e.target.value)}
                />
                {returnSettlement ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
                    <p>
                      Días reales de uso:{" "}
                      <strong>{returnSettlement.actualDays}</strong>
                      {returnSettlement.returnedEarly
                        ? ` · se restan ${returnSettlement.unusedDays} día(s) no usados (${formatMoney(returnSettlement.earlyCredit)})`
                        : returnSettlement.extraDays > 0
                          ? ` · se suman ${returnSettlement.extraDays} día(s) (${formatMoney(returnSettlement.extraCharge)})`
                          : " · sin cambio de días"}
                    </p>
                    <p className="mt-1 text-xs">
                      Margen de cortesía antes de cobrar día extra:{" "}
                      {extraDayGraceHours} h.
                    </p>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-white p-3 sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Combustible
                    </p>
                    <p className="mt-1">
                      Salió:{" "}
                      <strong>
                        {checkOut?.fuel_level
                          ? FUEL_LEVEL_LABELS[checkOut.fuel_level]
                          : "—"}
                      </strong>
                      {" · "}
                      Vuelve:{" "}
                      <strong>
                        {liveFuel
                          ? FUEL_LEVEL_LABELS[liveFuel] ?? liveFuel
                          : "—"}
                      </strong>
                    </p>
                  </div>
                  <Input
                    label="Cobro extra de combustible (USD)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={fuelCharges}
                    onChange={(e) => setFuelCharges(e.target.value)}
                  />
                  <Input
                    label="Cobro por daño (USD)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={damageCharges}
                    onChange={(e) => setDamageCharges(e.target.value)}
                  />
                </div>
                {canManageCourtesy ? (
                  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <p className="font-medium text-amber-950">
                      Descuento extra al recibir (solo administrador)
                    </p>
                    <p className="text-xs text-amber-900/80">
                      Para un inconveniente (cambio de vehículo, demora, etc.).
                      No reabre la tarifa pactada. El reintegro de dinero, si
                      aplica, se hace aparte y queda autorizado.
                    </p>
                    <Input
                      label="Descuento / cortesía al recibir (USD)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={courtesyAmount}
                      onChange={(e) => setCourtesyAmount(e.target.value)}
                    />
                    <Textarea
                      label="Motivo"
                      rows={2}
                      value={courtesyDetail}
                      onChange={(e) => setCourtesyDetail(e.target.value)}
                      placeholder="Ej. se cambió el vehículo el segundo día"
                    />
                  </div>
                ) : null}
                <div
                  className={cn(
                    "rounded-xl border-2 px-4 py-3",
                    billing.balance < -0.009
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-border bg-white",
                  )}
                >
                  <p className="text-sm font-medium text-muted">
                    {billing.balance < -0.009
                      ? "Saldo a favor (no es devolución de dinero)"
                      : "Saldo pendiente"}
                  </p>
                  <p className="text-3xl font-semibold tracking-tight text-foreground">
                    {formatMoney(Math.abs(billing.balance))}
                  </p>
                  {billing.balance < -0.009 ? (
                    <p className="mt-1 text-xs text-emerald-900">
                      El cliente ya abonó de más por los días no usados. Queda
                      anotado en este contrato. No aparece como deuda ni como
                      reintegro hasta que un administrador lo autorice.
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted">
                    A cobrar ahora: {formatMoney(billing.owed)} · Ya abonado:{" "}
                    {formatMoney(billing.paid)}
                  </p>
                </div>
                <div className="rounded-lg border-2 border-brand/40 bg-brand/5 p-4">
                  <p className="text-base font-semibold text-foreground">
                    Firma del cliente al devolver
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    El cliente firma abajo. Puede levantar el dedo entre letras.
                    Cuando termine, pulse <strong>Confirmar firma</strong>.
                  </p>
                </div>

                {closeConformitySigned && !conformitySignatureDataUrl ? (
                  <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-900">
                    Ya hay firma de conformidad en este contrato.
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
                          Firma confirmada. Ya puede cerrar.
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={conformitySignatureDataUrl}
                          alt="Firma de conformidad"
                          className="h-24 max-w-full rounded border border-border bg-white object-contain"
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
                        onConfirm={(dataUrl) => {
                          setConformitySignatureDataUrl(dataUrl);
                          setCoachToast({
                            text: "Firma confirmada.",
                            tick: Date.now(),
                          });
                        }}
                        disabled={closing}
                      />
                    )}
                  </div>
                )}

                <details className="rounded-lg border border-border bg-surface-muted/40 p-3 text-muted">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Texto de la declaración (opcional)
                  </summary>
                  <p className="mt-2 leading-relaxed">{CLOSE_CONFORMITY_TEXT}</p>
                </details>

                {!canClose ? (
                  <MissingFieldsBanner items={missingRequirements()} />
                ) : (
                  <p className="text-green-800">
                    Listo: km, combustible y firma. Puede cerrar.
                  </p>
                )}
                <Tooltip
                  content={
                    canClose
                      ? "Cierra la renta con el km y la firma ya capturados."
                      : nextBlockedReason
                  }
                  className="max-w-xs whitespace-normal"
                >
                  <span className="inline-flex">
                    <Button
                      type="button"
                      onClick={openConfirm}
                      disabled={!canClose || closing}
                    >
                      Revisar y cerrar contrato
                    </Button>
                  </span>
                </Tooltip>
                <button
                  type="button"
                  className="text-left text-sm font-medium text-brand underline"
                  onClick={() => setShowOptionalClose((value) => !value)}
                >
                  {showOptionalClose
                    ? "Ocultar ajustes opcionales"
                    : "Ajustes opcionales (no son necesarios para firmar)"}
                </button>
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
              <Tooltip
                content={
                  nextBlocked
                    ? nextBlockedReason
                    : isLast
                      ? "Confirma el cierre."
                      : "Pasa al siguiente paso."
                }
                className="max-w-xs whitespace-normal"
              >
                <span className="inline-flex">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void goNext()}
                    disabled={closing || nextBlocked}
                    loading={savingVitals}
                  >
                    {isLast ? "Confirmar cierre" : "Siguiente"}
                    {!isLast ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
                  </Button>
                </span>
              </Tooltip>
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
                    ? formatAppDateTime(normalizeFormDateTimeToIso(actualReturnAt))
                    : "—"}
                </strong>
              </li>
              <li>
                Total adeudado: <strong>{formatMoney(billing.owed)}</strong>
              </li>
              <li>
                Abonado: <strong>{formatMoney(billing.paid)}</strong>
              </li>
              <li className="pt-1">
                Saldo pendiente:{" "}
                <strong className="text-3xl tracking-tight">
                  {formatMoney(billing.balance)}
                </strong>
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
