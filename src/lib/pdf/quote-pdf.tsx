import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatMoney } from "@/lib/money";
import { PDF_BRAND } from "@/lib/pdf/brand-assets";

export type QuotePdfLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type QuotePdfProps = {
  businessName: string;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  businessWhatsapp?: string | null;
  logoDataUrl?: string | null;
  quoteCode: string;
  issuedAtLabel?: string | null;
  language?: "es" | "en";
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  vehicleLabel: string;
  startAtLabel: string;
  endAtLabel: string;
  rentalDays: number;
  dailyRate: number;
  subtotal: number;
  insuranceAmount: number;
  depositAmount: number;
  deliveryFee: number;
  pickupFee: number;
  discountAmount: number;
  otherCharges: number;
  taxAmount: number;
  total: number;
  lineItems?: QuotePdfLineItem[];
  welcomeText?: string | null;
  paymentConditions?: string | null;
  deliveryInstructions?: string | null;
  insurancePolicyText?: string | null;
  drivingGuidelines?: string | null;
  notes?: string | null;
  terms?: string | null;
  validUntilLabel?: string | null;
};

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
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.border,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    maxWidth: "62%",
  },
  logo: {
    width: 78,
    height: 52,
    objectFit: "contain",
  },
  brandText: {
    flexDirection: "column",
  },
  brandName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.navy,
    marginBottom: 2,
  },
  brandMeta: {
    fontSize: 8,
    color: PDF_BRAND.muted,
    marginBottom: 1,
  },
  docBadge: {
    backgroundColor: PDF_BRAND.cream,
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 150,
    alignItems: "flex-end",
  },
  docType: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.red,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  docCode: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.navy,
  },
  docDate: {
    fontSize: 8,
    color: PDF_BRAND.muted,
    marginTop: 4,
  },
  twoCol: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 18,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 6,
    padding: 12,
    backgroundColor: "#fafbfc",
  },
  cardTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.navy,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.border,
  },
  line: {
    fontSize: 9,
    marginBottom: 3,
    color: PDF_BRAND.text,
  },
  lineMuted: {
    fontSize: 9,
    marginBottom: 3,
    color: PDF_BRAND.muted,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.navy,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: PDF_BRAND.navy,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: PDF_BRAND.border,
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  colDesc: { width: "58%" },
  colQty: { width: "14%", textAlign: "right" },
  colRate: { width: "14%", textAlign: "right" },
  colAmount: { width: "14%", textAlign: "right" },
  cell: { fontSize: 9 },
  summaryBox: {
    marginTop: 14,
    marginLeft: "auto",
    width: "48%",
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.border,
  },
  summaryLabel: {
    fontSize: 9,
    color: PDF_BRAND.muted,
  },
  summaryValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.text,
  },
  summaryNote: {
    fontSize: 7.5,
    color: PDF_BRAND.muted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8fafc",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: PDF_BRAND.navy,
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  totalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  notesBox: {
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#ffffff",
  },
  notesText: {
    fontSize: 8.5,
    color: "#334155",
    lineHeight: 1.45,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: PDF_BRAND.border,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7.5,
    color: PDF_BRAND.muted,
  },
  validity: {
    marginTop: 10,
    padding: 8,
    backgroundColor: PDF_BRAND.cream,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: PDF_BRAND.red,
  },
  validityText: {
    fontSize: 9,
    color: PDF_BRAND.navyDark,
  },
});

function ChargeRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          emphasize ? { color: PDF_BRAND.red } : {},
        ]}
      >
        {emphasize && value > 0 ? `− ${formatMoney(value)}` : formatMoney(value)}
      </Text>
    </View>
  );
}

export function QuotePdfDocument(props: QuotePdfProps) {
  const businessName = props.businessName || PDF_BRAND.name;
  const en = props.language === "en";
  const t = {
    docType: en ? "Quote" : "Cotización",
    issued: en ? "Issued" : "Emitida",
    customer: en ? "Customer" : "Cliente",
    rental: en ? "Rental" : "Alquiler",
    pickup: en ? "Pickup" : "Recogida",
    return: en ? "Return" : "Devolución",
    day: en ? "day" : "día",
    days: en ? "days" : "días",
    perDay: en ? "/day" : "/día",
    detail: en ? "Charge details" : "Detalle de cargos",
    description: en ? "Description" : "Concepto",
    qty: en ? "Qty" : "Cant.",
    price: en ? "Price" : "Precio",
    amount: en ? "Amount" : "Monto",
    vehicleRental: en ? "Vehicle rental" : "Alquiler de vehículo",
    insurance: en ? "Insurance" : "Seguro",
    deliveryFee: en ? "Delivery fee" : "Cargo por entrega",
    pickupFee: en ? "Pickup fee" : "Cargo por recogida",
    otherCharges: en ? "Other charges" : "Otros cargos",
    subtotal: en ? "Rental subtotal" : "Subtotal renta",
    delivery: en ? "Delivery" : "Entrega",
    pickupShort: en ? "Pickup" : "Recogida",
    other: en ? "Other" : "Otros",
    discount: en ? "Discount" : "Descuento",
    taxes: en ? "Taxes" : "Impuestos",
    deposit: en ? "Deposit (security)" : "Depósito (garantía)",
    depositNote: en
      ? "The deposit is a refundable security hold and is not part of the rental amount due."
      : "El depósito es una garantía reembolsable y no forma parte del total a cobrar por el alquiler.",
    totalDue: en ? "Total due" : "Total a cobrar",
    validity: en
      ? "This quote is valid until"
      : "Vigencia de esta cotización: hasta",
    notes: en ? "Notes" : "Notas",
    payment: en ? "Payment conditions" : "Condiciones de pago",
    deliveryReturn: en ? "Delivery & return" : "Entrega y devolución",
    insurancePolicy: en
      ? "Insurance & deductibles"
      : "Póliza de seguro y deducibles",
    driving: en ? "Driving guidelines" : "Directrices de conducción",
    terms: en ? "Terms" : "Condiciones",
    footerDoc: en ? "Commercial document" : "Documento comercial",
    page: en ? "Page" : "Página",
    of: en ? "of" : "de",
  };

  return (
    <Document
      title={`${t.docType} ${props.quoteCode}`}
      author={businessName}
      subject={`${t.docType} ${props.quoteCode}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} fixed />
        <View style={styles.accentBar} fixed />

        <View style={styles.header}>
          <View style={styles.brandBlock}>
            {props.logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
              <Image src={props.logoDataUrl} style={styles.logo} />
            ) : null}
            <View style={styles.brandText}>
              <Text style={styles.brandName}>{businessName}</Text>
              {props.businessAddress ? (
                <Text style={styles.brandMeta}>{props.businessAddress}</Text>
              ) : null}
              {props.businessPhone ? (
                <Text style={styles.brandMeta}>
                  {en ? "Ph" : "Tel"}: {props.businessPhone}
                </Text>
              ) : null}
              {props.businessWhatsapp ? (
                <Text style={styles.brandMeta}>
                  WhatsApp: {props.businessWhatsapp}
                </Text>
              ) : null}
              {props.businessEmail ? (
                <Text style={styles.brandMeta}>{props.businessEmail}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.docBadge}>
            <Text style={styles.docType}>{t.docType}</Text>
            <Text style={styles.docCode}>{props.quoteCode}</Text>
            {props.issuedAtLabel ? (
              <Text style={styles.docDate}>
                {t.issued}: {props.issuedAtLabel}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.customer}</Text>
            <Text style={styles.line}>{props.customerName}</Text>
            {props.customerPhone ? (
              <Text style={styles.lineMuted}>
                {en ? "Ph" : "Tel"}: {props.customerPhone}
              </Text>
            ) : null}
            {props.customerEmail ? (
              <Text style={styles.lineMuted}>{props.customerEmail}</Text>
            ) : null}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.rental}</Text>
            <Text style={styles.line}>{props.vehicleLabel}</Text>
            <Text style={styles.lineMuted}>
              {t.pickup}: {props.startAtLabel}
            </Text>
            <Text style={styles.lineMuted}>
              {t.return}: {props.endAtLabel}
            </Text>
            <Text style={styles.lineMuted}>
              {props.rentalDays}{" "}
              {props.rentalDays === 1 ? t.day : t.days} ·{" "}
              {formatMoney(props.dailyRate)}
              {t.perDay}
            </Text>
          </View>
        </View>

        {props.welcomeText ? (
          <View style={styles.validity}>
            <Text style={styles.validityText}>{props.welcomeText}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.detail}</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDesc]}>
              {t.description}
            </Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>
              {t.qty}
            </Text>
            <Text style={[styles.tableHeaderText, styles.colRate]}>
              {t.price}
            </Text>
            <Text style={[styles.tableHeaderText, styles.colAmount]}>
              {t.amount}
            </Text>
          </View>
          {props.lineItems && props.lineItems.length > 0
            ? props.lineItems.map((item, index) => (
                <View
                  key={`${item.description}-${index}`}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 ? styles.tableRowAlt : {},
                  ]}
                >
                  <Text style={[styles.cell, styles.colDesc]}>
                    {item.description}
                  </Text>
                  <Text style={[styles.cell, styles.colQty]}>
                    {item.quantity}
                  </Text>
                  <Text style={[styles.cell, styles.colRate]}>
                    {formatMoney(item.unitPrice)}
                  </Text>
                  <Text style={[styles.cell, styles.colAmount]}>
                    {formatMoney(item.amount)}
                  </Text>
                </View>
              ))
            : (
              <>
                <View style={styles.tableRow}>
                  <Text style={[styles.cell, styles.colDesc]}>
                    {t.vehicleRental} — {props.vehicleLabel}
                  </Text>
                  <Text style={[styles.cell, styles.colQty]}>
                    {props.rentalDays}
                  </Text>
                  <Text style={[styles.cell, styles.colRate]}>
                    {formatMoney(props.dailyRate)}
                  </Text>
                  <Text style={[styles.cell, styles.colAmount]}>
                    {formatMoney(props.subtotal)}
                  </Text>
                </View>
                {props.insuranceAmount > 0 ? (
                  <View style={[styles.tableRow, styles.tableRowAlt]}>
                    <Text style={[styles.cell, styles.colDesc]}>
                      {t.insurance}
                    </Text>
                    <Text style={[styles.cell, styles.colQty]}>—</Text>
                    <Text style={[styles.cell, styles.colRate]}>—</Text>
                    <Text style={[styles.cell, styles.colAmount]}>
                      {formatMoney(props.insuranceAmount)}
                    </Text>
                  </View>
                ) : null}
                {props.deliveryFee > 0 ? (
                  <View style={styles.tableRow}>
                    <Text style={[styles.cell, styles.colDesc]}>
                      {t.deliveryFee}
                    </Text>
                    <Text style={[styles.cell, styles.colQty]}>—</Text>
                    <Text style={[styles.cell, styles.colRate]}>—</Text>
                    <Text style={[styles.cell, styles.colAmount]}>
                      {formatMoney(props.deliveryFee)}
                    </Text>
                  </View>
                ) : null}
                {props.pickupFee > 0 ? (
                  <View style={[styles.tableRow, styles.tableRowAlt]}>
                    <Text style={[styles.cell, styles.colDesc]}>
                      {t.pickupFee}
                    </Text>
                    <Text style={[styles.cell, styles.colQty]}>—</Text>
                    <Text style={[styles.cell, styles.colRate]}>—</Text>
                    <Text style={[styles.cell, styles.colAmount]}>
                      {formatMoney(props.pickupFee)}
                    </Text>
                  </View>
                ) : null}
                {props.otherCharges > 0 ? (
                  <View style={styles.tableRow}>
                    <Text style={[styles.cell, styles.colDesc]}>
                      {t.otherCharges}
                    </Text>
                    <Text style={[styles.cell, styles.colQty]}>—</Text>
                    <Text style={[styles.cell, styles.colRate]}>—</Text>
                    <Text style={[styles.cell, styles.colAmount]}>
                      {formatMoney(props.otherCharges)}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
        </View>

        <View style={styles.summaryBox}>
          <ChargeRow label={t.subtotal} value={props.subtotal} />
          {props.insuranceAmount > 0 ? (
            <ChargeRow label={t.insurance} value={props.insuranceAmount} />
          ) : null}
          {props.deliveryFee > 0 ? (
            <ChargeRow label={t.delivery} value={props.deliveryFee} />
          ) : null}
          {props.pickupFee > 0 ? (
            <ChargeRow label={t.pickupShort} value={props.pickupFee} />
          ) : null}
          {props.otherCharges > 0 ? (
            <ChargeRow label={t.other} value={props.otherCharges} />
          ) : null}
          {props.discountAmount > 0 ? (
            <ChargeRow
              label={t.discount}
              value={props.discountAmount}
              emphasize
            />
          ) : null}
          {props.taxAmount > 0 ? (
            <ChargeRow label={t.taxes} value={props.taxAmount} />
          ) : null}
          {props.depositAmount > 0 ? (
            <>
              <ChargeRow label={t.deposit} value={props.depositAmount} />
              <Text style={styles.summaryNote}>{t.depositNote}</Text>
            </>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.totalDue}</Text>
            <Text style={styles.totalValue}>{formatMoney(props.total)}</Text>
          </View>
        </View>

        {props.validUntilLabel ? (
          <View style={styles.validity}>
            <Text style={styles.validityText}>
              {t.validity} {props.validUntilLabel}
            </Text>
          </View>
        ) : null}

        {props.notes ? (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>{t.notes}</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{props.notes}</Text>
            </View>
          </View>
        ) : null}

        {props.paymentConditions ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.payment}</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{props.paymentConditions}</Text>
            </View>
          </View>
        ) : null}

        {props.deliveryInstructions ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.deliveryReturn}</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{props.deliveryInstructions}</Text>
            </View>
          </View>
        ) : null}

        {props.insurancePolicyText ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.insurancePolicy}</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{props.insurancePolicyText}</Text>
            </View>
          </View>
        ) : null}

        {props.drivingGuidelines ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.driving}</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{props.drivingGuidelines}</Text>
            </View>
          </View>
        ) : null}

        {props.terms ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.terms}</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{props.terms}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {businessName} — {t.footerDoc}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${t.page} ${pageNumber} ${t.of} ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
