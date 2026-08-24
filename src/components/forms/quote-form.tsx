"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { createQuote } from "@/app/dashboard/cotizaciones/actions";
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

type QuoteLineDraft = {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
  item_type: "VEHICLE" | "SERVICE" | "TAX" | "DISCOUNT" | "CUSTOM";
  catalog_item_id: string | null;
  item_code: string | null;
  tax_rate: number;
};

type QuoteFormProps = {
  customers: Array<{ id: string; label: string }>;
  vehicles: Array<{
    id: string;
    label: string;
    dailyRate: number;
    deposit: number;
  }>;
  catalogItems?: QuoteCatalogItem[];
  defaults?: {
    customerId?: string;
    vehicleId?: string;
    webRequestId?: string;
    startAt?: string;
    endAt?: string;
    insuranceAmount?: number;
    depositAmount?: number;
    deliveryFee?: number;
    terms?: string;
    language?: "es" | "en";
  };
};

function newKey() {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

export function QuoteForm({
  customers,
  vehicles,
  catalogItems = [],
  defaults,
}: QuoteFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<"es" | "en">(
    defaults?.language ?? "en",
  );
  const [startAt, setStartAt] = useState(defaults?.startAt ?? "");
  const [endAt, setEndAt] = useState(defaults?.endAt ?? "");
  const [taxRate, setTaxRate] = useState("13");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [deposit, setDeposit] = useState(
    String(defaults?.depositAmount ?? 0),
  );
  const [catalogSelect, setCatalogSelect] = useState("");
  const [lines, setLines] = useState<QuoteLineDraft[]>([]);

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

  function catalogLabel(item: QuoteCatalogItem) {
    return language === "es" ? item.name_es : item.name_en;
  }

  function catalogDescription(item: QuoteCatalogItem) {
    return language === "es"
      ? item.description_es
      : item.description_en;
  }

  function addFromCatalog(itemId: string) {
    const item = catalogItems.find((c) => c.id === itemId);
    if (!item) return;
    const desc = [catalogLabel(item), catalogDescription(item)]
      .filter(Boolean)
      .join(" — ");
    const itemType =
      item.item_type === "VEHICLE" || item.item_type === "SERVICE"
        ? item.item_type
        : "CUSTOM";
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        description: desc,
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
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
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
    if (lines.length === 0) {
      setError("Agregue al menos una línea de detalle.");
      return;
    }
    if (lines.some((l) => !l.description.trim())) {
      setError("Cada línea necesita descripción.");
      return;
    }

    formData.set("language", language);
    formData.set("taxRate", taxRate);
    formData.set("discountPercent", discountPercent);
    formData.set("depositAmount", deposit);
    formData.set("dailyRate", "0");
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

    const result = await createQuote(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/cotizaciones/${result.data.id}`);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
        Cliente → período → líneas del catálogo → impuestos → enviar. Meta: ≤ 3
        minutos. El vehículo unidad es opcional.
      </div>

      {defaults?.webRequestId ? (
        <input type="hidden" name="webRequestId" value={defaults.webRequestId} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-700">Idioma</span>
        <Button
          type="button"
          size="sm"
          variant={language === "en" ? "primary" : "secondary"}
          onClick={() => setLanguage("en")}
        >
          EN
        </Button>
        <Button
          type="button"
          size="sm"
          variant={language === "es" ? "primary" : "secondary"}
          onClick={() => setLanguage("es")}
        >
          ES
        </Button>
        <input type="hidden" name="language" value={language} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-700">
            Cliente *
          </label>
          <select
            name="customerId"
            required
            defaultValue={defaults?.customerId}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          name="startAt"
          label="Inicio *"
          type="datetime-local"
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          required
        />
        <Input
          name="endAt"
          label="Fin *"
          type="datetime-local"
          value={endAt}
          onChange={(e) => setEndAt(e.target.value)}
          required
        />

        <div className="space-y-1 sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-700">
            Vehículo (opcional — unidad específica)
          </label>
          <select
            name="vehicleId"
            defaultValue={defaults?.vehicleId ?? ""}
            onChange={(e) => {
              const v = vehicles.find((item) => item.id === e.target.value);
              if (v) setDeposit(String(v.deposit ?? 0));
            }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Sin unidad (solo tipo / líneas)</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1 space-y-1">
            <label className="block text-sm font-medium text-zinc-700">
              Catálogo
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
              <option value="">Agregar artículo…</option>
              {catalogItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {catalogLabel(item)} · {formatMoney(item.unit_price)}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="secondary" onClick={addCustomLine}>
            Línea personalizada
          </Button>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-muted">
            Agregue líneas desde el catálogo o una línea personalizada (p. ej.
            tipo de vehículo).
          </p>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-lg border border-zinc-200 p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-5">
                  <label className="mb-1 block text-xs text-muted">
                    Descripción
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
                  <label className="mb-1 block text-xs text-muted">Cant.</label>
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
                    Precio
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
                    <p className="text-xs text-muted">Importe</p>
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
                    Quitar
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
            Impuesto (%)
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
          label="Descuento (%)"
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
        />
        <Input
          name="depositAmount"
          label="Depósito / garantía (USD)"
          type="number"
          step="0.01"
          min="0"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
        />
        <Input name="validUntil" label="Válida hasta" type="datetime-local" />
      </div>

      {preview ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface-muted/40 p-4 text-sm">
          <p className="mb-2 font-medium text-foreground">Resumen automático</p>
          <div className="flex justify-between gap-4">
            <span>Subtotal ({preview.rentalDays} día{preview.rentalDays === 1 ? "" : "s"})</span>
            <span className="tabular-nums">{formatMoney(preview.subtotal)}</span>
          </div>
          {preview.discountAmount > 0 ? (
            <div className="flex justify-between gap-4 text-muted">
              <span>Descuento ({discountPercent}%)</span>
              <span className="tabular-nums">
                − {formatMoney(preview.discountAmount)}
              </span>
            </div>
          ) : null}
          {preview.taxAmount > 0 ? (
            <div className="flex justify-between gap-4">
              <span>Impuesto ({taxRate}%)</span>
              <span className="tabular-nums">{formatMoney(preview.taxAmount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(preview.total)}</span>
          </div>
          {preview.depositAmount > 0 ? (
            <p className="pt-1 text-xs text-muted">
              Depósito garantía: {formatMoney(preview.depositAmount)} (no suma
              al total)
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Complete fechas y líneas para ver el total.
        </p>
      )}

      <Textarea name="notes" label="Notas" />
      <Textarea
        name="terms"
        label="Términos"
        defaultValue={defaults?.terms ?? ""}
      />
      <input type="hidden" name="status" value="DRAFT" />

      <div className="flex gap-3">
        <SubmitButton>Crear cotización</SubmitButton>
        <Link
          href="/dashboard/cotizaciones"
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
