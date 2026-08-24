import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type PricingBreakdownProps = {
  rentalDays: number;
  dailyRate: number;
  subtotal: number;
  insurance?: number;
  deliveryFee?: number;
  discount?: number;
  tax?: number;
  deposit?: number;
  total: number;
  className?: string;
};

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        muted && "text-muted",
        strong && "text-base font-semibold text-foreground",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function PricingBreakdown({
  rentalDays,
  dailyRate,
  subtotal,
  insurance = 0,
  deliveryFee = 0,
  discount = 0,
  tax = 0,
  deposit = 0,
  total,
  className,
}: PricingBreakdownProps) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border border-border bg-surface-muted/40 p-4 text-sm",
        className,
      )}
    >
      <p className="mb-3 font-medium text-foreground">Resumen automático</p>
      <Row
        label={`${rentalDays} día${rentalDays === 1 ? "" : "s"} × ${formatMoney(dailyRate)}`}
        value={formatMoney(subtotal)}
      />
      {insurance > 0 ? (
        <Row label="Seguro" value={formatMoney(insurance)} />
      ) : null}
      {deliveryFee > 0 ? (
        <Row label="Entrega" value={formatMoney(deliveryFee)} />
      ) : null}
      {discount > 0 ? (
        <Row label="Descuento" value={`− ${formatMoney(discount)}`} />
      ) : null}
      {tax > 0 ? <Row label="Impuesto" value={formatMoney(tax)} /> : null}
      <div className="border-t border-border pt-2">
        <Row label="Total a cobrar" value={formatMoney(total)} strong />
      </div>
      {deposit > 0 ? (
        <Row
          label="Depósito (garantía, no suma al total)"
          value={formatMoney(deposit)}
          muted
        />
      ) : (
        <p className="pt-1 text-xs text-muted">
          El depósito es una garantía reembolsable: no se suma al total.
        </p>
      )}
    </div>
  );
}
