import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { amountToSpanishUsd } from "@/lib/contracts/oldes-terms";
import { formatMoney } from "@/lib/money";
import { PDF_BRAND } from "@/lib/pdf/brand-assets";

export type PaymentReceiptPdfProps = {
  businessName: string;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  businessWhatsapp?: string | null;
  contactPhone?: string | null;
  logoDataUrl?: string | null;
  receiptCode: string;
  issuedAtLabel: string;
  customerName: string;
  customerPhone?: string | null;
  customerIdentification?: string | null;
  concept: string;
  amount: number;
  amountInWords?: string | null;
  paymentMethodLabel: string;
  paymentMethod?: "CASH" | "CARD" | "TRANSFER" | string | null;
  contractCode?: string | null;
  reservationCode?: string | null;
  vehicleLabel?: string | null;
  plate?: string | null;
  /** Total del contrato / saldo anterior */
  accountTotal?: number | null;
  /** Monto abonado previo a este recibo (opcional) */
  previousPaid?: number | null;
  balanceRemaining: number;
  notes?: string | null;
  receiptKind?: "PAYMENT" | "REFUND";
  templateImageUrl?: string | null;
  receivedByName?: string | null;
};

const DEFAULT_CONTACT = "+503 7435-0381";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: PDF_BRAND.text,
    backgroundColor: "#ffffff",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: PDF_BRAND.navy,
  },
  accentBar: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: PDF_BRAND.red,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.border,
  },
  brandName: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.navy,
    marginBottom: 2,
  },
  brandMeta: { fontSize: 8, color: PDF_BRAND.muted, marginBottom: 1 },
  docTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.red,
    textAlign: "right",
    marginBottom: 4,
  },
  docCode: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.navy,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.navy,
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  line: { fontSize: 9.5, marginBottom: 3 },
  muted: { fontSize: 8, color: PDF_BRAND.muted },
  box: {
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  checkRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  checkBox: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderColor: PDF_BRAND.navy,
  },
  checkBoxOn: { backgroundColor: PDF_BRAND.navy },
  table: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    marginTop: 6,
  },
  tableCol: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: PDF_BRAND.border,
  },
  tableColLast: { flex: 1, padding: 8 },
  tableHead: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.muted,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  tableValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: PDF_BRAND.navy },
  signRow: { flexDirection: "row", gap: 16, marginTop: 22 },
  signBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 4,
    padding: 10,
    minHeight: 70,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: PDF_BRAND.border,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7.5, color: PDF_BRAND.muted },
});

function Check({
  label,
  on,
}: {
  label: string;
  on?: boolean;
}) {
  return (
    <View style={styles.checkItem}>
      <View style={[styles.checkBox, on ? styles.checkBoxOn : {}]} />
      <Text style={{ fontSize: 8 }}>{label}</Text>
    </View>
  );
}

export function PaymentReceiptPdfDocument(props: PaymentReceiptPdfProps) {
  const businessName = props.businessName || PDF_BRAND.name;
  const isRefund = props.receiptKind === "REFUND";
  const docTitle = isRefund
    ? "Comprobante de devolución"
    : "Comprobante oficial de pago / abono";
  const contactPhone =
    props.contactPhone ||
    props.businessPhone ||
    props.businessWhatsapp ||
    DEFAULT_CONTACT;
  const words =
    props.amountInWords?.trim() || amountToSpanishUsd(props.amount);
  const method = (props.paymentMethod || "").toUpperCase();
  const accountTotal = props.accountTotal ?? null;
  const abonadoHoy = props.amount;
  const nuevoSaldo = props.balanceRemaining;

  return (
    <Document
      title={`${docTitle} ${props.receiptCode}`}
      author={businessName}
      subject={`${docTitle} ${props.receiptCode}`}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topBar} fixed />
        <View style={styles.accentBar} fixed />

        <View style={styles.header}>
          <View style={{ maxWidth: "58%" }}>
            {props.logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf
              <Image
                src={props.logoDataUrl}
                style={{
                  width: 96,
                  height: 40,
                  objectFit: "contain",
                  marginBottom: 6,
                }}
              />
            ) : null}
            <Text style={styles.brandName}>{businessName}</Text>
            <Text style={styles.brandMeta}>Servicios de renta de vehículos</Text>
            {props.businessAddress ? (
              <Text style={styles.brandMeta}>{props.businessAddress}</Text>
            ) : null}
            <Text style={styles.brandMeta}>
              Tel: {contactPhone}
              {props.businessEmail ? ` · ${props.businessEmail}` : ""}
            </Text>
          </View>
          <View>
            <Text style={styles.docTitle}>{docTitle.toUpperCase()}</Text>
            <Text style={styles.docCode}>N° {props.receiptCode}</Text>
            <Text style={[styles.muted, { textAlign: "right", marginTop: 4 }]}>
              Fecha: {props.issuedAtLabel}
            </Text>
          </View>
        </View>

        {props.templateImageUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf
          <Image
            src={props.templateImageUrl}
            style={{
              width: "100%",
              maxHeight: 90,
              objectFit: "contain",
              marginBottom: 8,
            }}
          />
        ) : null}

        <Text style={styles.sectionTitle}>1. Datos del cliente y referencia</Text>
        <View style={styles.box}>
          <Text style={styles.line}>Recibido de: {props.customerName}</Text>
          <Text style={styles.line}>
            DUI / Pasaporte: {props.customerIdentification || "—"}
          </Text>
          <Text style={styles.line}>
            N° Contrato / cuenta: {props.contractCode || props.reservationCode || "—"}
          </Text>
          <Text style={styles.line}>
            Vehículo: {props.vehicleLabel || "—"}
            {props.plate ? ` · Placa: ${props.plate}` : ""}
          </Text>
          {props.customerPhone ? (
            <Text style={styles.muted}>Tel cliente: {props.customerPhone}</Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>2. Detalle del monto recibido</Text>
        <View style={styles.box}>
          <View style={styles.row}>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>
              {isRefund ? "MONTO DEVUELTO" : "MONTO RECIBIDO"}
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: PDF_BRAND.navy }}>
              {formatMoney(props.amount)}
            </Text>
          </View>
          <Text style={[styles.muted, { marginTop: 4 }]}>Suma en letras:</Text>
          <Text style={styles.line}>{words}</Text>
        </View>

        <Text style={styles.sectionTitle}>3. Forma de pago y concepto</Text>
        <View style={styles.box}>
          <Text style={styles.muted}>Método de pago:</Text>
          <View style={styles.checkRow}>
            <Check label="Efectivo" on={method === "CASH"} />
            <Check label="Transferencia" on={method === "TRANSFER"} />
            <Check label="Tarjeta" on={method === "CARD"} />
            <Check
              label={props.paymentMethodLabel}
              on={!["CASH", "CARD", "TRANSFER"].includes(method)}
            />
          </View>
          <Text style={[styles.line, { marginTop: 8 }]}>
            Concepto: {props.concept}
          </Text>
          {props.notes ? (
            <Text style={styles.muted}>Notas / cortesía: {props.notes}</Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>4. Estado actual de la cuenta</Text>
        <View style={styles.table}>
          <View style={styles.tableCol}>
            <Text style={styles.tableHead}>Monto total / anterior</Text>
            <Text style={styles.tableValue}>
              {accountTotal != null ? formatMoney(accountTotal) : "—"}
            </Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.tableHead}>
              {isRefund ? "Devuelto (hoy)" : "Abonado (hoy)"}
            </Text>
            <Text style={styles.tableValue}>{formatMoney(abonadoHoy)}</Text>
          </View>
          <View style={styles.tableColLast}>
            <Text style={styles.tableHead}>Nuevo saldo pendiente</Text>
            <Text style={styles.tableValue}>{formatMoney(nuevoSaldo)}</Text>
          </View>
        </View>

        <Text style={[styles.muted, { marginTop: 10 }]}>
          ¡Agradecemos su puntual pago y su preferencia! Este documento sirve
          como comprobante legal y administrativo. Conserve este recibo.
        </Text>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 6 }}>
              POR LA EMPRESA (COBROS / RECEPTOR)
            </Text>
            <Text style={styles.line}>
              Recibido por: {props.receivedByName || "________________"}
            </Text>
            <Text style={styles.muted}>Firma y sello</Text>
            <Text style={[styles.muted, { marginTop: 8 }]}>
              Validación: {props.receiptCode} · REGISTRADO EN SISTEMA
            </Text>
          </View>
          <View style={styles.signBox}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 6 }}>
              EL CLIENTE (PAGADOR)
            </Text>
            <Text style={styles.line}>Entregado por: {props.customerName}</Text>
            <Text style={styles.muted}>Firma de conformidad</Text>
            <Text style={[styles.muted, { marginTop: 8 }]}>
              Envío WhatsApp / correo disponible desde el panel.
            </Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{businessName} — Recibo</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
