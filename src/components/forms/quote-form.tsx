"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  createQuote,
  updateQuote,
} from "@/app/dashboard/cotizaciones/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { calculateQuoteLineTotals } from "@/lib/calculations/quote";
import { formatMoney, parseMoneyInput, toNumber, multiply } from "@/lib/money";

export type QuoteCatalogItem = {
  id: string;
  name_es: string;
  name_en: string;
  description_es?: string | null;
  description_en?: string | null;
  unit_price: number;
  tax_rate: number;
  item_type: string;
};

export type QuoteVehicleTypeOption = {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  referenceModels: string | null;
  referenceModelsEn: string | null;
  dailyRate: number;
};

type QuoteLineDraft = {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
  item_type: "VEHICLE" | "SERVICE" | "TAX" | "DISCOUNT" | "CUSTOM";
  catalog_item_id: string | null;
  item_code: string | null;
  tax_rate: number;
  /** Marks the auto line tied to the selected vehicle type (for language refresh). */
  from_vehicle_type?: boolean;
};

type QuoteFormProps = {
  customers: Array<{ id: string; label: string }>;
  vehicleTypes: QuoteVehicleTypeOption[];
  catalogItems?: QuoteCatalogItem[];
  mode?: "create" | "edit";
  quoteId?: string;
  defaults?: {
    customerId?: string;
    vehicleTypeId?: string;
    webRequestId?: string;
    startAt?: string;
    endAt?: string;
    insuranceAmount?: number;
    depositAmount?: number;
    deliveryFee?: number;
    taxRate?: number;
    discountPercent?: number;
    notes?: string;
    terms?: string;
    validUntil?: string;
    language?: "es" | "en";
    lines?: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      item_type?: QuoteLineDraft["item_type"];
      catalog_item_id?: string | null;
      item_code?: string | null;
      tax_rate?: number;
      from_vehicle_type?: boolean;
    }>;
  };
};

function newKey() {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

function vehicleTypeDescription(
  type: QuoteVehicleTypeOption,
  language: "es" | "en",
): string {
  if (language === "en") {
    const name = type.nameEn?.trim() || type.name;
    const models = type.referenceModelsEn?.trim() || type.referenceModels?.trim();
    const detail = type.descriptionEn?.trim() || type.description?.trim();
    return [name, models, detail].filter(Boolean).join(" — ");
  }
  const models = type.referenceModels?.trim();
  const detail = type.description?.trim();
  return [type.name, models, detail].filter(Boolean).join(" — ");
}

/** Catalog line text follows selected language. */
function catalogDescriptionText(
  item: QuoteCatalogItem,
  language: "es" | "en",
): string {
  if (language === "en") {
    return [item.name_en, item.description_en].filter(Boolean).join(" — ");
  }
  return [item.name_es, item.description_es].filter(Boolean).join(" — ");
}

function catalogName(item: QuoteCatalogItem, language: "es" | "en"): string {
  return language === "en" ? item.name_en : item.name_es;
}

function vehicleTypeName(
  type: QuoteVehicleTypeOption,
  language: "es" | "en",
): string {
  if (language === "en") return type.nameEn?.trim() || type.name;
  return type.name;
}

const FORM_COPY = {
  es: {
    hint: "Seleccione el tipo de vehículo a cotizar (Sedán, Pick Up, SUV, etc.), no una unidad con placa. ES = cotización en español · EN = cotización en inglés (formulario y PDF).",
    language: "Idioma de la cotización",
    languageHint: "Cambia etiquetas, catálogo, descripciones y el PDF",
    customer: "Cliente *",
    selectCustomer: "Seleccionar…",
    start: "Inicio *",
    end: "Fin *",
    vehicleType: "Tipo de vehículo cotizado *",
    selectType: "Seleccionar tipo…",
    perDay: "/día",
    typeHint:
      "Cotiza la categoría (p. ej. Pick Up), no un carro específico de la flota.",
    catalog: "Catálogo (extras / servicios)",
    addItem: "Agregar artículo…",
    customLine: "Línea personalizada",
    emptyLines:
      "Elija un tipo de vehículo o agregue líneas del catálogo / personalizadas.",
    description: "Descripción",
    qty: "Cant.",
    price: "Precio",
    amount: "Importe",
    remove: "Quitar",
    tax: "Impuesto (%)",
    discount: "Descuento (%)",
    deposit: "Depósito / garantía (USD)",
    validUntil: "Válida hasta",
    summary: "Resumen automático",
    subtotal: "Subtotal",
    day: "día",
    days: "días",
    total: "Total",
    depositNote: "Depósito garantía",
    depositNoteExtra: "(no suma al total)",
    fillDates: "Complete fechas y líneas para ver el total.",
    notes: "Notas",
    terms: "Términos",
    create: "Crear cotización",
    save: "Guardar cambios",
    cancel: "Cancelar",
    errLines: "Agregue al menos una línea de detalle.",
    errDesc: "Cada línea necesita descripción.",
  },
  en: {
    hint: "Select the vehicle type to quote (Sedan, Pick Up, SUV, etc.), not a specific plated unit. ES = Spanish quote · EN = English quote (form and PDF).",
    language: "Quote language",
    languageHint: "Changes labels, catalog, descriptions, and the PDF",
    customer: "Customer *",
    selectCustomer: "Select…",
    start: "Start *",
    end: "End *",
    vehicleType: "Quoted vehicle type *",
    selectType: "Select type…",
    perDay: "/day",
    typeHint:
      "Quote the category (e.g. Pick Up), not a specific fleet unit.",
    catalog: "Catalog (extras / services)",
    addItem: "Add item…",
    customLine: "Custom line",
    emptyLines:
      "Choose a vehicle type or add catalog / custom lines.",
    description: "Description",
    qty: "Qty",
    price: "Price",
    amount: "Amount",
    remove: "Remove",
    tax: "Tax (%)",
    discount: "Discount (%)",
    deposit: "Deposit / security (USD)",
    validUntil: "Valid until",
    summary: "Automatic summary",
    subtotal: "Subtotal",
    day: "day",
    days: "days",
    total: "Total",
    depositNote: "Security deposit",
    depositNoteExtra: "(not included in total)",
    fillDates: "Complete dates and lines to see the total.",
    notes: "Notes",
    terms: "Terms",
    create: "Create quote",
    save: "Save changes",
    cancel: "Cancel",
    errLines: "Add at least one detail line.",
    errDesc: "Each line needs a description.",
  },
} as const;

export function QuoteForm({
  customers,
  vehicleTypes,
  catalogItems = [],
  mode = "create",
  quoteId,
  defaults,
}: QuoteFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<"es" | "en">(
    defaults?.language ?? "es",
  );
  const [vehicleTypeId, setVehicleTypeId] = useState(
    defaults?.vehicleTypeId ?? "",
  );
  const [startAt, setStartAt] = useState(defaults?.startAt ?? "");
  const [endAt, setEndAt] = useState(defaults?.endAt ?? "");
  const [taxRate, setTaxRate] = useState(
    String(defaults?.taxRate ?? 13),
  );
  const [discountPercent, setDiscountPercent] = useState(
    String(defaults?.discountPercent ?? 0),
  );
  const [deposit, setDeposit] = useState(
    String(defaults?.depositAmount ?? 0),
  );
  const [catalogSelect, setCatalogSelect] = useState("");
  const [lines, setLines] = useState<QuoteLineDraft[]>(() =>
    (defaults?.lines ?? []).map((line) => ({
      key: newKey(),
      description: line.description,
      quantity: String(line.quantity),
      unit_price: String(line.unit_price),
      item_type: line.item_type ?? "CUSTOM",
      catalog_item_id: line.catalog_item_id ?? null,
      item_code: line.item_code ?? null,
      tax_rate: line.tax_rate ?? 0,
      from_vehicle_type: Boolean(line.from_vehicle_type),
    })),
  );

  // Prefill vehicle-type line when creating from a solicitud / default type.
  useEffect(() => {
    if (mode !== "create") return;
    if (!defaults?.vehicleTypeId) return;
    if ((defaults.lines?.length ?? 0) > 0) return;
    if (lines.some((l) => l.from_vehicle_type)) return;
    applyVehicleType(defaults.vehicleTypeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedType = useMemo(
    () => vehicleTypes.find((t) => t.id === vehicleTypeId) ?? null,
    [vehicleTypes, vehicleTypeId],
  );

  /** When language changes, refresh only description text of type/catalog-sourced lines. */
  useEffect(() => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.from_vehicle_type && selectedType) {
          return {
            ...line,
            description: vehicleTypeDescription(selectedType, language),
          };
        }
        if (line.catalog_item_id) {
          const item = catalogItems.find((c) => c.id === line.catalog_item_id);
          if (item) {
            return {
              ...line,
              description: catalogDescriptionText(item, language),
            };
          }
        }
        return line;
      }),
    );
    // Intentionally only when language changes — not on every type/catalog update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const preview = useMemo(() => {
    if (!startAt || !endAt || lines.length === 0) return null;
    try {
      return calculateQuoteLineTotals({
        startAt,
        endAt,
        lines: lines.map((line) => ({
          quantity: parseMoneyInput(line.quantity || "0"),
          unit_price: parseMoneyInput(line.unit_price || "0"),
        })),
        discountPercent: parseMoneyInput(discountPercent || "0"),
        taxRatePercent: parseMoneyInput(taxRate || "0"),
        depositAmount: parseMoneyInput(deposit || "0"),
      });
    } catch {
      return null;
    }
  }, [startAt, endAt, lines, discountPercent, taxRate, deposit]);

  function applyVehicleType(typeId: string) {
    setVehicleTypeId(typeId);
    if (!typeId) {
      setLines((prev) => prev.filter((line) => !line.from_vehicle_type));
      return;
    }
    const type = vehicleTypes.find((t) => t.id === typeId);
    if (!type) return;

    const vehicleLine: QuoteLineDraft = {
      key: newKey(),
      description: vehicleTypeDescription(type, language),
      quantity: "1",
      unit_price: String(type.dailyRate),
      item_type: "VEHICLE",
      catalog_item_id: null,
      item_code: null,
      tax_rate: parseMoneyInput(taxRate || "0") / 100,
      from_vehicle_type: true,
    };

    setLines((prev) => {
      const withoutType = prev.filter((line) => !line.from_vehicle_type);
      return [vehicleLine, ...withoutType];
    });
  }

  function addFromCatalog(itemId: string) {
    const item = catalogItems.find((c) => c.id === itemId);
    if (!item) return;
    const itemType =
      item.item_type === "VEHICLE" || item.item_type === "SERVICE"
        ? item.item_type
        : "CUSTOM";
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        description: catalogDescriptionText(item, language),
        quantity: "1",
        unit_price: String(item.unit_price),
        item_type: itemType,
        catalog_item_id: item.id,
        item_code: null,
        tax_rate: Number(item.tax_rate ?? 0),
      },
    ]);
    setCatalogSelect("");
  }

  function addCustomLine() {
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        description: "",
        quantity: "1",
        unit_price: "0",
        item_type: "CUSTOM",
        catalog_item_id: null,
        item_code: null,
        tax_rate: parseMoneyInput(taxRate || "0") / 100,
      },
    ]);
  }

  function updateLine(key: string, patch: Partial<QuoteLineDraft>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        // Manual edit of description → stop auto-sync from language toggle
        if (patch.description !== undefined) {
          next.from_vehicle_type = false;
          next.catalog_item_id = null;
        }
        return next;
      }),
    );
  }

  function removeLine(key: string) {
    setLines((prev) => {
      const removed = prev.find((line) => line.key === key);
      if (removed?.from_vehicle_type) setVehicleTypeId("");
      return prev.filter((line) => line.key !== key);
    });
  }

  function lineAmount(line: QuoteLineDraft) {
    return toNumber(
      multiply(
        parseMoneyInput(line.quantity || "0"),
        parseMoneyInput(line.unit_price || "0"),
      ),
    );
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const t = FORM_COPY[language];
    if (lines.length === 0) {
      setError(t.errLines);
      return;
    }
    if (lines.some((l) => !l.description.trim())) {
      setError(t.errDesc);
      return;
    }

    formData.set("language", language);
    formData.set("vehicleTypeId", vehicleTypeId);
    formData.set("taxRate", taxRate);
    formData.set("discountPercent", discountPercent);
    formData.set("depositAmount", deposit);
    formData.set("dailyRate", selectedType ? String(selectedType.dailyRate) : "0");
    formData.set(
      "lines",
      JSON.stringify(
        lines.map((line) => ({
          description: line.description.trim(),
          quantity: parseMoneyInput(line.quantity || "0"),
          unit_price: parseMoneyInput(line.unit_price || "0"),
          amount: lineAmount(line),
          item_type: line.item_type,
          catalog_item_id: line.catalog_item_id,
          item_code: line.item_code,
          tax_rate: line.tax_rate,
        })),
      ),
    );

    const result =
      mode === "edit" && quoteId
        ? await updateQuote(quoteId, formData)
        : await createQuote(formData);

    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/cotizaciones/${result.data.id}`);
    router.refresh();
  }

  const t = FORM_COPY[language];

  return (
    <form action={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
        {t.hint}
      </div>

      {defaults?.webRequestId ? (
        <input type="hidden" name="webRequestId" value={defaults.webRequestId} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-700">{t.language}</span>
        <Button
          type="button"
          size="sm"
          variant={language === "es" ? "primary" : "secondary"}
          onClick={() => setLanguage("es")}
        >
          ES
        </Button>
        <Button
          type="button"
          size="sm"
          variant={language === "en" ? "primary" : "secondary"}
          onClick={() => setLanguage("en")}
        >
          EN
        </Button>
        <input type="hidden" name="language" value={language} />
        <span className="text-xs text-muted">{t.languageHint}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-700">
            {t.customer}
          </label>
          <select
            name="customerId"
            required
            defaultValue={defaults?.customerId}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">{t.selectCustomer}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          name="startAt"
          label={t.start}
          type="datetime-local"
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          required
        />
        <Input
          name="endAt"
          label={t.end}
          type="datetime-local"
          value={endAt}
          onChange={(e) => setEndAt(e.target.value)}
          required
        />

        <div className="space-y-1 sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-700">
            {t.vehicleType}
          </label>
          <select
            name="vehicleTypeId"
            required
            value={vehicleTypeId}
            onChange={(e) => applyVehicleType(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">{t.selectType}</option>
            {vehicleTypes.map((vt) => (
              <option key={vt.id} value={vt.id}>
                {vehicleTypeName(vt, language)} · {formatMoney(vt.dailyRate)}
                {t.perDay}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">{t.typeHint}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1 space-y-1">
            <label className="block text-sm font-medium text-zinc-700">
              {t.catalog}
            </label>
            <select
              value={catalogSelect}
              onChange={(e) => {
                const id = e.target.value;
                setCatalogSelect(id);
                if (id) addFromCatalog(id);
              }}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">{t.addItem}</option>
              {catalogItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {catalogName(item, language)} · {formatMoney(item.unit_price)}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="secondary" onClick={addCustomLine}>
            {t.customLine}
          </Button>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-muted">{t.emptyLines}</p>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-lg border border-zinc-200 p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-5">
                  <label className="mb-1 block text-xs text-muted">
                    {t.description}
                  </label>
                  <input
                    value={line.description}
                    onChange={(e) =>
                      updateLine(line.key, { description: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-muted">{t.qty}</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.key, { quantity: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-muted">
                    {t.price}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) =>
                      updateLine(line.key, { unit_price: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end justify-between gap-2 sm:col-span-3">
                  <div>
                    <p className="text-xs text-muted">{t.amount}</p>
                    <p className="text-sm font-medium tabular-nums">
                      {formatMoney(lineAmount(line))}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(line.key)}
                  >
                    {t.remove}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700">
            {t.tax}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={taxRate === "0" ? "primary" : "secondary"}
              onClick={() => setTaxRate("0")}
            >
              0%
            </Button>
            <Button
              type="button"
              size="sm"
              variant={taxRate === "13" ? "primary" : "secondary"}
              onClick={() => setTaxRate("13")}
            >
              13%
            </Button>
            <input
              name="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <Input
          name="discountPercent"
          label={t.discount}
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
        />
        <Input
          name="depositAmount"
          label={t.deposit}
          type="number"
          step="0.01"
          min="0"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
        />
        <Input
          name="validUntil"
          label={t.validUntil}
          type="datetime-local"
          defaultValue={defaults?.validUntil ?? ""}
        />
      </div>

      {preview ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface-muted/40 p-4 text-sm">
          <p className="mb-2 font-medium text-foreground">{t.summary}</p>
          <div className="flex justify-between gap-4">
            <span>
              {t.subtotal} ({preview.rentalDays}{" "}
              {preview.rentalDays === 1 ? t.day : t.days})
            </span>
            <span className="tabular-nums">{formatMoney(preview.subtotal)}</span>
          </div>
          {preview.discountAmount > 0 ? (
            <div className="flex justify-between gap-4 text-muted">
              <span>
                {t.discount.replace(" (%)", "")} ({discountPercent}%)
              </span>
              <span className="tabular-nums">
                − {formatMoney(preview.discountAmount)}
              </span>
            </div>
          ) : null}
          {preview.taxAmount > 0 ? (
            <div className="flex justify-between gap-4">
              <span>
                {t.tax.replace(" (%)", "")} ({taxRate}%)
              </span>
              <span className="tabular-nums">{formatMoney(preview.taxAmount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold">
            <span>{t.total}</span>
            <span className="tabular-nums">{formatMoney(preview.total)}</span>
          </div>
          {preview.depositAmount > 0 ? (
            <p className="pt-1 text-xs text-muted">
              {t.depositNote}: {formatMoney(preview.depositAmount)}{" "}
              {t.depositNoteExtra}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">{t.fillDates}</p>
      )}

      <Textarea
        name="notes"
        label={t.notes}
        defaultValue={defaults?.notes ?? ""}
      />
      <Textarea
        name="terms"
        label={t.terms}
        defaultValue={defaults?.terms ?? ""}
      />
      {mode === "create" ? (
        <input type="hidden" name="status" value="DRAFT" />
      ) : null}

      <div className="flex gap-3">
        <SubmitButton>{mode === "edit" ? t.save : t.create}</SubmitButton>
        <Link
          href={
            mode === "edit" && quoteId
              ? `/dashboard/cotizaciones/${quoteId}`
              : "/dashboard/cotizaciones"
          }
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          {t.cancel}
        </Link>
      </div>
    </form>
  );
}
