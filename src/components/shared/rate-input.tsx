"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rentalDaysBetween } from "@/lib/dates";
import {
  dailyRateForPactTotal,
  formatRateInput,
  parseMoneyInput,
  parseRateInput,
  sanitizeRateTyping,
} from "@/lib/money";

type RateInputProps = {
  name?: string;
  label?: string;
  value?: string;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  required?: boolean;
  hint?: string;
};

/** Campo de tarifa diaria: texto (no type=number) para que 58.666666 no dé error. */
export function RateInput({
  name = "agreedRate",
  label = "Tarifa diaria (USD)",
  value,
  defaultValue,
  onChange,
  required,
  hint = "Hasta 6 decimales (ej. 58.666667). También puede usar coma: 58,666667.",
}: RateInputProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() =>
    defaultValue == null || defaultValue === ""
      ? ""
      : formatRateInput(defaultValue),
  );
  const current = isControlled ? value : internal;

  function setNext(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  return (
    <div className="space-y-1">
      <Input
        name={name}
        label={label}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        value={current}
        onChange={(e) => setNext(sanitizeRateTyping(e.target.value))}
        onBlur={() => {
          if (current.trim() === "") return;
          setNext(formatRateInput(parseRateInput(current)));
        }}
      />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

type RateWithPactTotalProps = {
  name?: string;
  rate: string;
  onRateChange: (value: string) => void;
  startAt: string;
  endAt: string;
  required?: boolean;
};

/**
 * Tarifa diaria + atajo: si ofrecieron $176 por 3 días, ponen 176 y se calcula
 * 58.666667. Evita redondear a $175 porque el navegador rechazó decimales.
 */
export function RateWithPactTotal({
  name = "agreedRate",
  rate,
  onRateChange,
  startAt,
  endAt,
  required,
}: RateWithPactTotalProps) {
  const [pact, setPact] = useState("");
  const days = useMemo(() => {
    if (!startAt || !endAt) return 0;
    try {
      return rentalDaysBetween(startAt, endAt);
    } catch {
      return 0;
    }
  }, [startAt, endAt]);

  function applyPact() {
    const total = parseMoneyInput(pact);
    if (days <= 0 || total <= 0) return;
    onRateChange(formatRateInput(dailyRateForPactTotal(total, days)));
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <RateInput
        name={name}
        label="Tarifa diaria (USD) *"
        value={rate}
        onChange={onRateChange}
        required={required}
      />
      <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
        <p className="text-xs text-muted">
          Si ya le ofreció un total (ej. $176 por {days || "N"}{" "}
          {days === 1 ? "día" : "días"}), póngalo aquí. El sistema calcula la
          tarifa con decimales para que el contrato cierre exacto. No quite
          decimales a mano.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            label="Total pactado de la renta (USD)"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={pact}
            onChange={(e) => setPact(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="176"
          />
          <Button type="button" variant="secondary" onClick={applyPact}>
            Calcular tarifa
          </Button>
        </div>
      </div>
    </div>
  );
}
