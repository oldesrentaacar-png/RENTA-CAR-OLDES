import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { OLDES_COMPANY } from "@/lib/contracts/oldes-terms";
import { formatMoney } from "@/lib/money";
import { PDF_BRAND } from "@/lib/pdf/brand-assets";
import {
  MachoteField,
  MachoteGrid,
  MachoteSection,
  machoteStyles,
} from "@/lib/pdf/machote-box";

export const CLOSE_ACT_PDF_VERSION = "2026-09-04-v2";

export type CloseActAccessoryRow = {
  label: string;
  returned: boolean;
  /** Optional status label for display: SÍ / NO / DAÑADO */
  statusLabel?: string | null;
};

export type CloseActPdfProps = {
  businessName: string;
  legalName?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  logoDataUrl?: string | null;
  /** Folio del acta, ej. REC-2026-000005 */
  receiptCode: string;
  issuedDateLabel: string;
  contractCode: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerIdentification?: string | null;
  vehicleLabel: string;
  plate: string;
  scheduledEndLabel: string;
  actualReturnLabel: string;
  returnPlace?: string | null;
  mileageOut?: number | null;
  mileageIn?: number | null;
  fuelOutLabel?: string | null;
  fuelInLabel?: string | null;
  fuelSameLevel?: boolean | null;
  accessories: CloseActAccessoryRow[];
  missingAccessories?: string[];
  noNewDamage: boolean;
  newDamageNotes?: string | null;
  /** Marcas por zona (símbolos R/G/F) para la sección 4 */
  bodyZoneMarks?: Partial<
    Record<
      | "front"
      | "left"
      | "right"
      | "top"
      | "rear"
      | "glass",
      string
    >
  >;
  extraCharges: number;
  damageCharges: number;
  fuelCharges: number;
  complementaryAmount: number;
  deposit: number;
  depositReturned: boolean;
  chargeConcept?: string | null;
  chargeLines?: Array<{ label: string; amount: number }>;
  amountPaid: number;
  balanceDue: number;
  totalOwed: number;
  observations?: string | null;
  operatorName?: string | null;
  operatorSignatureUrl?: string | null;
  clientSignatureUrl?: string | null;
  clientSignedAt?: string | null;
  closedAtLabel?: string | null;
  verificationId?: string | null;
};

const NAVY = PDF_BRAND.navy;
const RED = PDF_BRAND.red;
const MUTED = "#475569";
const LINE = "#94a3b8";
const LIGHT = "#f1f5f9";

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 48,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  logo: { width: 88, height: 38, objectFit: "contain" },
  brandName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY },
  slogan: { fontSize: 7, color: RED, fontFamily: "Helvetica-Oblique" },
  meta: { fontSize: 7, color: MUTED, marginBottom: 1 },
  titleBlock: { width: "42%", alignItems: "flex-end" },
  title: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "right",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 7.5,
    color: MUTED,
    textAlign: "right",
    marginBottom: 4,
  },
  folio: { fontSize: 13, fontFamily: "Helvetica-Bold", color: RED },
  fuelRow: { width: "100%", marginTop: 4, marginBottom: 4, paddingHorizontal: 6 },
  fuelLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 3,
  },
  fuelScale: {
    flexDirection: "row",
    width: "100%",
    height: 16,
    borderWidth: 1,
    borderColor: LINE,
  },
  fuelCell: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: LINE,
  },
  fuelActive: { backgroundColor: NAVY },
  fuelCellText: { fontSize: 6, color: "#fff", fontFamily: "Helvetica-Bold" },
  checkGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 6,
    gap: 4,
  },
  checkItem: {
    width: "32%",
    flexDirection: "row",
    gap: 4,
    alignItems: "flex-start",
  },
  mark: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, width: 12 },
  checkLabel: { flex: 1, fontSize: 7, lineHeight: 1.25 },
  zoneGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 6,
    gap: 4,
  },
  zoneBox: {
    width: "32%",
    borderWidth: 0.8,
    borderColor: LINE,
    minHeight: 34,
    padding: 4,
  },
  zoneTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    marginBottom: 2,
  },
  declaration: {
    fontSize: 7.5,
    lineHeight: 1.4,
    padding: 8,
    color: "#0f172a",
  },
  signRow: { flexDirection: "row", gap: 10, padding: 8 },
  signBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    padding: 8,
    minHeight: 90,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: MUTED },
  note: { fontSize: 7, color: MUTED, paddingHorizontal: 6, paddingBottom: 6 },
});

const FUEL_SEGMENT_COUNT = 9;

function fuelIndexFromLabel(label?: string | null): number {
  if (!label) return -1;
  const map: Record<string, number> = {
    EMPTY: 0,
    Vacío: 0,
    "Vacío (E)": 0,
    ONE_EIGHTH: 1,
    "1/8": 1,
    QUARTER: 2,
    "1/4": 2,
    THREE_EIGHTHS: 3,
    "3/8": 3,
    HALF: 4,
    "1/2": 4,
    FIVE_EIGHTHS: 5,
    "5/8": 5,
    THREE_QUARTERS: 6,
    "3/4": 6,
    SEVEN_EIGHTHS: 7,
    "7/8": 7,
    FULL: 8,
    Lleno: 8,
    "Lleno (F)": 8,
  };
  return map[label] ?? -1;
}

function FuelGauge({
  label,
  activeIndex,
}: {
  label: string;
  activeIndex: number;
}) {
  return (
    <View style={styles.fuelRow}>
      <Text style={styles.fuelLabel}>{label}</Text>
      <View style={styles.fuelScale}>
        {Array.from({ length: FUEL_SEGMENT_COUNT }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.fuelCell,
              index === activeIndex ? styles.fuelActive : {},
              index === FUEL_SEGMENT_COUNT - 1 ? { borderRightWidth: 0 } : {},
            ]}
          >
            {index === 0 || index === FUEL_SEGMENT_COUNT - 1 ? (
              <Text
                style={[
                  styles.fuelCellText,
                  index !== activeIndex ? { color: MUTED } : {},
                ]}
              >
                {index === 0 ? "E" : "F"}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function dash(value?: string | number | null): string {
  if (value == null || value === "") return "—";
  return String(value);
}

export function CloseActPdfDocument(props: CloseActPdfProps) {
  const businessName = props.businessName || OLDES_COMPANY.brandName;
  const legalName = props.legalName || OLDES_COMPANY.legalName;
  const totalExtra =
    props.extraCharges +
    props.damageCharges +
    props.fuelCharges +
    props.complementaryAmount;
  const kmOut = props.mileageOut;
  const kmIn = props.mileageIn;
  const tripKm =
    kmOut != null && kmIn != null && kmIn >= kmOut ? kmIn - kmOut : null;

  const accessories =
    props.accessories.length > 0
      ? props.accessories
      : [
          { label: "Tarjeta de circulación", returned: false },
          { label: "Llanta de repuesto", returned: false },
          { label: "Llave de tuercas", returned: false },
          { label: "Gato / mica", returned: false },
          { label: "Triángulos / conos", returned: false },
          { label: "Extintor", returned: false },
          { label: "Alfombras", returned: false },
          { label: "Antena / copas", returned: false },
        ];

  return (
    <Document
      title={`Acta de recepción ${props.receiptCode}`}
      author={businessName}
      subject="Acta de recepción y cierre de renta OLDES"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ width: "56%" }}>
            <View style={styles.brandRow}>
              {props.logoDataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf
                <Image src={props.logoDataUrl} style={styles.logo} />
              ) : null}
              <View>
                <Text style={styles.brandName}>{businessName}</Text>
                <Text style={styles.slogan}>{OLDES_COMPANY.slogan}</Text>
              </View>
            </View>
            <Text style={styles.meta}>{legalName}</Text>
            {props.businessAddress ? (
              <Text style={styles.meta}>{props.businessAddress}</Text>
            ) : null}
            <Text style={styles.meta}>
              {[props.businessPhone, props.businessEmail]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>
              ACTA DE RECEPCIÓN{"\n"}Y CIERRE DE RENTAS
            </Text>
            <Text style={styles.subtitle}>
              Constancia de devolución de vehículo y finiquito de servicio
            </Text>
            <Text style={styles.folio}>N° {props.receiptCode}</Text>
            <Text style={[styles.meta, { textAlign: "right", marginTop: 4 }]}>
              Fecha: {props.issuedDateLabel}
            </Text>
          </View>
        </View>

        <MachoteSection title="1. Información de la renta y partes">
          <MachoteGrid>
            <MachoteField
              label="Cliente / Arrendatario"
              value={props.customerName}
              width="half"
            />
            <MachoteField
              label="N° Contrato original"
              value={props.contractCode}
              width="half"
            />
            <MachoteField
              label="DUI / Pasaporte / ID"
              value={props.customerIdentification || "—"}
              width="half"
            />
            <MachoteField
              label="Teléfono / Email"
              value={
                [props.customerPhone, props.customerEmail]
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
              width="half"
            />
            <MachoteField
              label="Vehículo"
              value={props.vehicleLabel}
              width="half"
            />
            <MachoteField label="Placa / Matrícula" value={props.plate} width="half" />
          </MachoteGrid>
        </MachoteSection>

        <MachoteSection title="2. Condición de entrega y kilometraje">
          <MachoteGrid>
            <MachoteField
              label="Fecha programada de devolución"
              value={props.scheduledEndLabel}
              width="half"
            />
            <MachoteField
              label="Km inicial (salida)"
              value={kmOut != null ? `${kmOut.toLocaleString("es-SV")} km` : "—"}
              width="half"
            />
            <MachoteField
              label="Fecha / hora real de devolución"
              value={props.actualReturnLabel}
              width="half"
            />
            <MachoteField
              label="Km final (retorno)"
              value={kmIn != null ? `${kmIn.toLocaleString("es-SV")} km` : "—"}
              width="half"
            />
            <MachoteField
              label="Lugar de devolución"
              value={props.returnPlace || OLDES_COMPANY.address}
              width="half"
            />
            <MachoteField
              label="Recorrido total"
              value={
                tripKm != null ? `${tripKm.toLocaleString("es-SV")} km` : "—"
              }
              width="half"
            />
          </MachoteGrid>
        </MachoteSection>

        <MachoteSection title="3. Nivel de combustible e inventario de accesorios">
          <FuelGauge
            label="NIVEL DE COMBUSTIBLE AL RECIBIR"
            activeIndex={fuelIndexFromLabel(props.fuelInLabel)}
          />
          <Text style={styles.note}>
            Combustible salida: {props.fuelOutLabel || "—"} · Combustible
            retorno: {props.fuelInLabel || "—"}
          </Text>
          <Text style={styles.note}>
            Mismo nivel entregado en salida:{" "}
            {props.fuelSameLevel == null
              ? "[ ] Sí   [ ] No"
              : props.fuelSameLevel
                ? "[X] Sí   [ ] No"
                : "[ ] Sí   [X] No"}
          </Text>
          <Text
            style={{
              fontSize: 7,
              fontFamily: "Helvetica-Bold",
              color: NAVY,
              paddingHorizontal: 6,
              marginBottom: 2,
            }}
          >
            Checklist de accesorios (devolución)
          </Text>
          <View style={styles.checkGrid}>
            {accessories.map((item) => (
              <View key={item.label} style={styles.checkItem}>
                <Text
                  style={[
                    styles.mark,
                    {
                      color: item.returned ? "#15803d" : "#b91c1c",
                      fontFamily: "Helvetica-Bold",
                    },
                  ]}
                >
                  {item.statusLabel?.trim()
                    ? `[${item.statusLabel}]`
                    : item.returned
                      ? "[SÍ]"
                      : "[NO]"}
                </Text>
                <Text style={styles.checkLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          {(props.missingAccessories?.length ?? 0) > 0 ? (
            <Text style={[styles.note, { color: "#b91c1c" }]}>
              Faltantes / novedades de inventario:{" "}
              {props.missingAccessories!.join("; ")}
            </Text>
          ) : null}
        </MachoteSection>

        <MachoteSection title="4. Inspección de carrocería e incidencias nuevas">
          <Text style={styles.note}>
            Leyenda: R = Rayón · G = Golpe · F = Faltante
          </Text>
          <View style={styles.zoneGrid}>
            {(
              [
                ["Frente / Bumper del.", "front"],
                ["Lado izquierdo", "left"],
                ["Lado derecho", "right"],
                ["Parte superior / Techo", "top"],
                ["Atrás / Bumper tras.", "rear"],
                ["Vidrios / Parabrisas", "glass"],
              ] as const
            ).map(([zone, key]) => (
              <View key={zone} style={styles.zoneBox}>
                <Text style={styles.zoneTitle}>{zone}</Text>
                <Text style={{ fontSize: 8, marginTop: 4 }}>
                  {props.bodyZoneMarks?.[key]?.trim() || " "}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.note, { fontFamily: "Helvetica-Bold" }]}>
            {props.noNewDamage
              ? "[X] Sin nuevos daños o rayones."
              : "[ ] Sin nuevos daños o rayones."}
          </Text>
          <Text style={styles.note}>
            {props.noNewDamage
              ? "[ ] Se detectan las siguientes novedades:"
              : "[X] Se detectan las siguientes novedades:"}
          </Text>
          <Text style={[styles.note, { minHeight: 28 }]}>
            {props.newDamageNotes?.trim() || props.observations?.trim() || " "}
          </Text>
        </MachoteSection>

        <MachoteSection title="5. Balance financiero de cierre">
          <MachoteGrid>
            <MachoteField
              label="Cargos adicionales (total)"
              value={formatMoney(totalExtra)}
              width="half"
            />
            <MachoteField
              label="Garantía / depósito en custodia"
              value={formatMoney(props.deposit)}
              width="half"
            />
          </MachoteGrid>
          {(props.chargeLines?.length
            ? props.chargeLines
            : [
                props.extraCharges > 0
                  ? { label: "Días extra / cargos extra", amount: props.extraCharges }
                  : null,
                props.damageCharges > 0
                  ? { label: "Daños", amount: props.damageCharges }
                  : null,
                props.fuelCharges > 0
                  ? { label: "Combustible", amount: props.fuelCharges }
                  : null,
                props.complementaryAmount > 0
                  ? {
                      label: "Complementario",
                      amount: props.complementaryAmount,
                    }
                  : null,
              ].filter(Boolean) as Array<{ label: string; amount: number }>
          ).map((line) => (
            <View key={line.label} style={machoteStyles.billingRow}>
              <Text style={{ fontSize: 7.5 }}>{line.label}</Text>
              <Text style={{ fontSize: 7.5 }}>{formatMoney(line.amount)}</Text>
            </View>
          ))}
          <MachoteField
            label="Concepto de cargo"
            value={
              props.chargeConcept?.trim() ||
              (totalExtra > 0
                ? "Cargos de cierre según detalle anterior"
                : "Sin cargos adicionales")
            }
            width="full"
          />
          <MachoteGrid>
            <MachoteField
              label="Total adeudado al cierre"
              value={formatMoney(props.totalOwed)}
              width="third"
            />
            <MachoteField
              label="Abonado"
              value={formatMoney(props.amountPaid)}
              width="third"
            />
            <MachoteField
              label="Saldo"
              value={formatMoney(props.balanceDue)}
              width="third"
            />
          </MachoteGrid>
          <Text style={styles.note}>
            Estado de garantía / depósito:{" "}
            {props.depositReturned
              ? "[X] Devuelta total   [ ] Retención parcial/total"
              : props.deposit > 0
                ? "[ ] Devuelta total   [X] Retención parcial/total / en custodia"
                : "[ ] Sin depósito registrado"}
          </Text>
          <View style={machoteStyles.billingTotal}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>
              FINIQUITO / ESTADO DE CUENTA
            </Text>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>
              Saldo {formatMoney(props.balanceDue)}
            </Text>
          </View>
        </MachoteSection>

        <MachoteSection title="6. Declaración de conformidad">
          <Text style={styles.declaration}>
            Por medio del presente documento, el ARRENDATARIO declara la
            devolución del vehículo, reconoce el inventario y estado
            registrados en esta acta, y manifiesta su conformidad y
            satisfacción con el cierre del servicio. Ambas partes confirman que
            la unidad fue recibida según el reporte de recepción y que el
            finiquito queda aceptado con esta firma.
          </Text>
          <Text
            style={{
              fontSize: 7,
              fontFamily: "Helvetica-Bold",
              color: NAVY,
              paddingHorizontal: 6,
              marginBottom: 4,
            }}
          >
            {props.clientSignatureUrl
              ? "☑ El cliente firmó la declaración de conformidad al cierre."
              : "☐ Pendiente firma de conformidad del cliente al cierre."}
          </Text>
          <View style={styles.signRow}>
            <View style={styles.signBox}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>
                POR LA EMPRESA (RECEPTOR)
              </Text>
              <Text style={{ fontSize: 7, marginTop: 4 }}>
                Agente: {dash(props.operatorName)}
              </Text>
              {props.operatorSignatureUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf
                <Image
                  src={props.operatorSignatureUrl}
                  style={{
                    width: 120,
                    height: 36,
                    objectFit: "contain",
                    marginTop: 6,
                  }}
                />
              ) : (
                <Text style={{ fontSize: 7, marginTop: 16 }}>
                  Firma / sello: ________________
                </Text>
              )}
              <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 6 }}>
                Validación: {props.verificationId || props.receiptCode}
                {props.closedAtLabel ? ` · ${props.closedAtLabel}` : ""}
              </Text>
            </View>
            <View style={styles.signBox}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>
                EL CLIENTE (ARRENDATARIO)
              </Text>
              <Text style={{ fontSize: 7, marginTop: 4 }}>
                Nombre: {props.customerName}
              </Text>
              {props.clientSignatureUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf
                <Image
                  src={props.clientSignatureUrl}
                  style={{
                    width: 120,
                    height: 36,
                    objectFit: "contain",
                    marginTop: 6,
                  }}
                />
              ) : (
                <Text style={{ fontSize: 7, marginTop: 16 }}>
                  Firma de conformidad: ________________
                </Text>
              )}
              <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 6 }}>
                {props.clientSignedAt
                  ? `Firmado electrónicamente: ${props.clientSignedAt}`
                  : "Pendiente firma electrónica"}
              </Text>
            </View>
          </View>
        </MachoteSection>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {businessName} · Acta de recepción · {CLOSE_ACT_PDF_VERSION}
          </Text>
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
