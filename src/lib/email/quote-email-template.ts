import { formatMoney } from "@/lib/money";

export type QuoteEmailTemplateInput = {
  customerName: string;
  quoteCode: string;
  vehicleLabel: string;
  total: number;
  startAtLabel: string;
  endAtLabel: string;
  rentalDays?: number | null;
  pdfShareUrl?: string | null;
  businessName?: string;
  businessPhone?: string | null;
  businessWhatsapp?: string | null;
  businessEmail?: string | null;
};

const BRAND_NAVY = "#0a1f5c";
const BRAND_RED = "#e30613";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildQuoteEmailSubject(quoteCode: string): string {
  return `Cotización ${quoteCode} — OLDES Rent-a-Car`;
}

export function buildQuoteEmailText(input: QuoteEmailTemplateInput): string {
  const business = input.businessName ?? "OLDES Rent-a-Car";
  return [
    `Estimado/a ${input.customerName},`,
    "",
    `Adjuntamos el PDF de su cotización ${input.quoteCode} de ${business}.`,
    `Vehículo: ${input.vehicleLabel}`,
    `Periodo: ${input.startAtLabel} – ${input.endAtLabel}`,
    input.rentalDays ? `Días: ${input.rentalDays}` : "",
    `Total: ${formatMoney(input.total)}`,
    input.pdfShareUrl ? `Ver PDF: ${input.pdfShareUrl}` : "",
    "",
    "Quedamos atentos para confirmar su reserva.",
    "",
    business,
    input.businessPhone ? `Tel: ${input.businessPhone}` : "",
    input.businessWhatsapp ? `WhatsApp: ${input.businessWhatsapp}` : "",
    input.businessEmail ? `Correo: ${input.businessEmail}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** HTML email template (inline styles for client compatibility). */
export function buildQuoteEmailHtml(input: QuoteEmailTemplateInput): string {
  const business = escapeHtml(input.businessName ?? "OLDES Rent-a-Car");
  const name = escapeHtml(input.customerName);
  const code = escapeHtml(input.quoteCode);
  const vehicle = escapeHtml(input.vehicleLabel);
  const start = escapeHtml(input.startAtLabel);
  const end = escapeHtml(input.endAtLabel);
  const total = escapeHtml(formatMoney(input.total));
  const days =
    input.rentalDays != null && input.rentalDays > 0
      ? String(input.rentalDays)
      : null;
  const pdfUrl = input.pdfShareUrl ? escapeHtml(input.pdfShareUrl) : null;
  const phone = input.businessPhone ? escapeHtml(input.businessPhone) : null;
  const whatsapp = input.businessWhatsapp
    ? escapeHtml(input.businessWhatsapp)
    : null;
  const email = input.businessEmail ? escapeHtml(input.businessEmail) : null;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cotización ${code}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:${BRAND_NAVY};padding:20px 24px;">
              <div style="height:4px;width:64px;background:${BRAND_RED};border-radius:2px;margin-bottom:12px;"></div>
              <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;font-weight:700;">OLDES Rent-a-Car</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;">Su cotización está lista</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Estimado/a <strong>${name}</strong>,</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155;">
                Adjuntamos el PDF de su cotización <strong style="color:${BRAND_NAVY};">${code}</strong>.
                Puede revisarlo en el archivo adjunto${pdfUrl ? " o con el botón de abajo" : ""}.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Detalle</p>
                    <p style="margin:0 0 8px;font-size:14px;"><span style="color:#64748b;">Vehículo:</span> <strong>${vehicle}</strong></p>
                    <p style="margin:0 0 8px;font-size:14px;"><span style="color:#64748b;">Periodo:</span> <strong>${start} – ${end}</strong></p>
                    ${
                      days
                        ? `<p style="margin:0 0 8px;font-size:14px;"><span style="color:#64748b;">Días:</span> <strong>${days}</strong></p>`
                        : ""
                    }
                    <p style="margin:0;font-size:16px;"><span style="color:#64748b;">Total:</span> <strong style="color:${BRAND_NAVY};">${total}</strong></p>
                  </td>
                </tr>
              </table>

              ${
                pdfUrl
                  ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                <tr>
                  <td style="border-radius:8px;background:${BRAND_RED};">
                    <a href="${pdfUrl}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Ver / descargar PDF
                    </a>
                  </td>
                </tr>
              </table>`
                  : ""
              }

              <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#334155;">
                Quedamos atentos para confirmar su reserva.
              </p>
              <p style="margin:0;font-size:14px;color:#64748b;">Atentamente,<br/><strong style="color:${BRAND_NAVY};">${business}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 22px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
                ${phone ? `Tel: ${phone}<br/>` : ""}
                ${whatsapp ? `WhatsApp: ${whatsapp}<br/>` : ""}
                ${email ? `Correo: ${email}` : ""}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
