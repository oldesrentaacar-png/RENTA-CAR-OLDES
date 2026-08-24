const DEFAULT_COUNTRY_CODE = "503";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizePhoneForWhatsApp(phone: string): string {
  let digits = digitsOnly(phone);

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === 8) {
    digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  return digits;
}

export function buildWaMeLink(phone: string, message: string): string {
  const normalizedPhone = normalizePhoneForWhatsApp(phone);
  const encodedMessage = encodeURIComponent(message.trim());
  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

export function buildQuoteWhatsAppMessage(input: {
  customerName: string;
  quoteCode: string;
  vehicleLabel: string;
  totalLabel: string;
  businessName?: string;
}): string {
  const business = input.businessName ?? "OLDES Rent-a-Car";
  return [
    `Hola ${input.customerName},`,
    `le compartimos su cotización ${input.quoteCode} de ${business}.`,
    `Vehículo: ${input.vehicleLabel}.`,
    `Total: ${input.totalLabel}.`,
    "Quedamos atentos para confirmar su reserva.",
  ].join(" ");
}

export function buildReservationWhatsAppMessage(input: {
  customerName: string;
  reservationCode: string;
  vehicleLabel: string;
  startAtLabel: string;
  endAtLabel: string;
}): string {
  return [
    `Hola ${input.customerName},`,
    `su reserva ${input.reservationCode} ha sido confirmada.`,
    `Vehículo: ${input.vehicleLabel}.`,
    `Recogida: ${input.startAtLabel}.`,
    `Devolución: ${input.endAtLabel}.`,
  ].join(" ");
}

export function buildPaymentReceiptWhatsAppMessage(input: {
  customerName: string;
  receiptCode: string;
  amountLabel: string;
  concept?: string;
  businessName?: string;
  pdfUrl?: string | null;
  receiptKind?: "PAYMENT" | "REFUND";
}): string {
  const business = input.businessName ?? "OLDES Rent-a-Car";
  const isRefund = input.receiptKind === "REFUND";
  const docLabel = isRefund ? "comprobante de devolución" : "recibo de abono";
  const conceptPart = input.concept
    ? ` Concepto: ${input.concept}.`
    : "";
  const pdfPart = input.pdfUrl
    ? ` Puede ver el PDF aquí: ${input.pdfUrl}`
    : " El comprobante PDF está disponible con OLDES Rent-a-Car (+503 7435-0381); solicítelo al negocio si aún no lo tiene.";

  return [
    `Hola ${input.customerName},`,
    `le compartimos su ${docLabel} ${input.receiptCode} de ${business}`,
    `por ${input.amountLabel}.${conceptPart}`,
    "Por favor confirme la recepción de este comprobante.",
    pdfPart.trim(),
  ].join(" ");
}
