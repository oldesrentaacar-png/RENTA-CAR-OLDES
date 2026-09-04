import {
  Document,
  Image,
  Page,
  Rect,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  OLDES_ACCESSORIES,
  OLDES_COMPANY,
  OLDES_CONTRACT_CLAUSES,
  OLDES_CONTRACT_FOOTER_NOTE,
} from "@/lib/contracts/oldes-terms";
import { formatMoney } from "@/lib/money";
import { PDF_BRAND } from "@/lib/pdf/brand-assets";
import { CONTRACT_PDF_TEMPLATE_VERSION } from "@/lib/pdf/contract-pdf-meta";
import {
  MachoteField,
  MachoteGrid,
  MachoteSection,
  machoteStyles,
} from "@/lib/pdf/machote-box";

export type ContractAccessoryRow = {
  key: string;
  label: string;
  checkOut?: string | null;
  checkIn?: string | null;
};

export type ContractDamageMarkPdf = {
  view: "TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT";
  x: number;
  y: number;
  symbol: string;
  phase?: "OUT" | "IN";
};

export type ContractPdfProps = {
  businessName: string;
  legalName?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  businessWhatsapp?: string | null;
  businessWebsite?: string | null;
  logoDataUrl?: string | null;
  contractCode: string;
  ivaRegistry?: string | null;
  operatedAs?: "LOGISTICS" | "INTERMEDIATION" | null;
  customerName: string;
  billingName?: string | null;
  customerAddress?: string | null;
  customerUsaAddress?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerIdentification?: string | null;
  customerDui?: string | null;
  customerPassport?: string | null;
  driverName?: string | null;
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  additionalDriverName?: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  plate: string;
  vehicleType?: string | null;
  vehicleTypeSlug?: string | null;
  vehicleTypeName?: string | null;
  startDateLabel: string;
  startTimeLabel: string;
  endDateLabel: string;
  endTimeLabel: string;
  rentalDays: number;
  dailyRate: number;
  otherCharges?: number;
  deposit: number;
  insurance: number;
  total: number;
  totalInWords?: string | null;
  fuelOutLabel?: string | null;
  fuelInLabel?: string | null;
  mileageOut?: number | null;
  mileageIn?: number | null;
  accessories?: ContractAccessoryRow[];
  damageMarks?: ContractDamageMarkPdf[];
  viewPhotos?: Partial<
    Record<"TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT", string>
  >;
  primaryPhotoUrl?: string | null;
  /** Diagrama 5 vistas según tipo (sedán, pickup, minivan, SUV). */
  inspectionWireframeUrl?: string | null;
  observations?: string | null;
  terms?: string | null;
  clauses?: string | null;
  notes?: string | null;
  clientSignedAt?: string | null;
  representativeSignedAt?: string | null;
  /** Nombre del operador que entrega (perfil logueado). */
  operatorName?: string | null;
  /** Firma digital del operador (URL o data URL). */
  operatorSignatureUrl?: string | null;
  /** Fotos de inspección — solo al final del documento (anexo). */
  annexPhotos?: Array<{ url: string; label: string }>;
  /** Líneas de facturación (silla bebé, entrega fuera de horario, etc.) */
  billingLineItems?: Array<{ label: string; amount: number }>;
  issuedPlace?: string | null;
  issuedDateLabel?: string | null;
};

const NAVY = PDF_BRAND.navy;
const RED = PDF_BRAND.red;
const MUTED = "#475569";
const LINE = "#94a3b8";
const LIGHT = "#f1f5f9";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 52,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  pageBack: {
    paddingTop: 32,
    paddingBottom: 52,
    paddingHorizontal: 32,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#0f172a",
    lineHeight: 1.35,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  companyBlock: {
    width: "62%",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  logo: {
    width: 88,
    height: 38,
    objectFit: "contain",
  },
  brandName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  slogan: {
    fontSize: 7,
    color: RED,
    fontFamily: "Helvetica-Oblique",
  },
  meta: {
    fontSize: 7,
    color: MUTED,
    marginBottom: 1,
  },
  titleBlock: {
    width: "36%",
    alignItems: "flex-end",
  },
  title: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "right",
    marginBottom: 4,
  },
  contractNo: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: RED,
  },
  checkboxRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  box: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: LINE,
  },
  boxChecked: {
    backgroundColor: NAVY,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    backgroundColor: LIGHT,
    paddingVertical: 3,
    paddingHorizontal: 5,
    marginBottom: 4,
    marginTop: 6,
    textTransform: "uppercase",
  },
  fieldLine: {
    flexDirection: "row",
    marginBottom: 3,
    alignItems: "flex-end",
  },
  fieldLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    marginRight: 4,
  },
  fieldValue: {
    flex: 1,
    borderBottomWidth: 0.8,
    borderBottomColor: LINE,
    fontSize: 8,
    paddingBottom: 1,
    minHeight: 10,
  },
  dual: {
    flexDirection: "row",
    gap: 8,
  },
  half: { flex: 1 },
  table: {
    borderWidth: 1,
    borderColor: LINE,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  th: {
    flex: 1,
    backgroundColor: NAVY,
    color: "#fff",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    padding: 3,
    textAlign: "center",
  },
  td: {
    flex: 1,
    fontSize: 8,
    padding: 3,
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: LINE,
  },
  tdLast: {
    borderRightWidth: 0,
  },
  twoColMain: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  photoPanel: {
    width: "52%",
    borderWidth: 1,
    borderColor: LINE,
    padding: 4,
    alignItems: "center",
  },
  heroPhoto: {
    width: "100%",
    height: 168,
    objectFit: "contain",
    marginBottom: 6,
  },
  wireframeDiagram: {
    width: "100%",
    height: 200,
    objectFit: "contain",
    marginBottom: 6,
  },
  checklistPanel: {
    width: "48%",
    borderWidth: 1,
    borderColor: LINE,
    padding: 4,
  },
  checklistItem: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 3,
    alignItems: "flex-start",
  },
  checklistMark: {
    width: 14,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  checklistLabel: {
    flex: 1,
    fontSize: 7,
    lineHeight: 1.3,
  },
  fuelRow: {
    width: "100%",
    marginTop: 4,
  },
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
    borderRightWidth: 0.5,
    borderRightColor: LINE,
  },
  fuelCellText: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
  },
  fuelActive: {
    backgroundColor: "#fde68a",
  },
  accessoryHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  accessoryHeaderText: {
    color: "#fff",
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
  },
  accessoryRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 1.5,
    paddingHorizontal: 3,
  },
  accessoryLabel: { width: "62%", fontSize: 6.5 },
  accessoryMark: { width: "19%", fontSize: 6.5, textAlign: "center" },
  billingBox: {
    borderWidth: 1,
    borderColor: LINE,
    padding: 6,
    marginTop: 6,
  },
  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  totalStrong: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  disclaimer: {
    fontSize: 6.5,
    color: RED,
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
  },
  signRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  signBox: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 4,
    minHeight: 40,
  },
  clause: {
    fontSize: 7.2,
    marginBottom: 4,
    textAlign: "justify",
  },
  pagareBox: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: NAVY,
    padding: 10,
  },
  pagareTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 6,
    color: NAVY,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    borderTopWidth: 0.8,
    borderTopColor: LINE,
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 6.5, color: MUTED },
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

function Field({
  label,
  value,
  width,
}: {
  label: string;
  value?: string | null;
  width?: number | string;
}) {
  return (
    <View style={[styles.fieldLine, width ? { width } : { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value?.trim() ? value : " "}</Text>
    </View>
  );
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
              <Text style={styles.fuelCellText}>
                {index === 0 ? "E" : "F"}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export function ContractPdfDocument(props: ContractPdfProps) {
  const legalName = props.legalName || OLDES_COMPANY.legalName;
  const businessName = props.businessName || OLDES_COMPANY.brandName;
  const address = props.businessAddress || OLDES_COMPANY.address;
  const email = props.businessEmail || OLDES_COMPANY.email;
  const phones =
    props.businessPhone ||
    OLDES_COMPANY.phones.join(" / ");
  const website = props.businessWebsite || OLDES_COMPANY.website;
  const social = props.businessWhatsapp || OLDES_COMPANY.social;

  const accessories =
    props.accessories && props.accessories.length > 0
      ? props.accessories
      : OLDES_ACCESSORIES.map((item) => ({
          key: item.key,
          label: item.label,
          checkOut: null,
          checkIn: null,
        }));

  const idDoc =
    props.customerDui ||
    props.customerPassport ||
    props.customerIdentification ||
    "";

  const clauses =
    props.clauses && props.clauses.trim().length > 40
      ? props.clauses.split(/\n+/).filter(Boolean)
      : OLDES_CONTRACT_CLAUSES;

  const billingLines = props.billingLineItems ?? [];
  const subtotalRental = props.dailyRate * props.rentalDays;

  const openingAccessories = accessories.filter(
    (item) => item.checkOut && item.checkOut !== "☐",
  );
  const checklistRows =
    openingAccessories.length > 0
      ? openingAccessories
      : accessories.filter((item) => item.checkOut !== undefined);

  const issuedWhen =
    props.issuedDateLabel ||
    `${props.startDateLabel} · ${props.startTimeLabel}`;

  return (
    <Document
      title={`Contrato ${props.contractCode}`}
      author={businessName}
      subject="Contrato de alquiler de vehículo OLDES"
    >
      {/* ===================== ANVERSO ===================== */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.companyBlock}>
            <View style={styles.brandRow}>
              {props.logoDataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
                <Image src={props.logoDataUrl} style={styles.logo} />
              ) : null}
              <View>
                <Text style={styles.brandName}>{businessName}</Text>
                <Text style={styles.slogan}>{OLDES_COMPANY.slogan}</Text>
              </View>
            </View>
            <Text style={styles.meta}>{legalName}</Text>
            <Text style={styles.meta}>{address}</Text>
            <Text style={styles.meta}>
              {email} · {website}
            </Text>
            <Text style={styles.meta}>
              Tel: {phones} · {social}
            </Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>
              CONTRATO DE ARRENDAMIENTO{"\n"}Y ACTA DE ENTREGA
            </Text>
            <Text style={styles.contractNo}>No. {props.contractCode}</Text>
            <Text style={[styles.meta, { marginTop: 4, textAlign: "right" }]}>
              Fecha: {issuedWhen}
            </Text>
          </View>
        </View>

        <MachoteSection title="1. Datos del arrendatario">
          <MachoteGrid>
            <MachoteField label="Nombre completo" value={props.customerName} width="full" />
            <MachoteField label="DUI / Pasaporte / ID" value={idDoc} width="half" />
            <MachoteField label="Teléfono / Celular" value={props.customerPhone} width="half" />
            <MachoteField label="N° Licencia de conducir" value={props.licenseNumber} width="half" />
            <MachoteField label="Vencimiento licencia" value={props.licenseExpiry} width="half" />
            <MachoteField label="Correo electrónico" value={props.customerEmail} width="full" />
            <MachoteField
              label="Conductor adicional"
              value={props.additionalDriverName}
              width="full"
            />
            <MachoteField label="Dirección" value={props.customerAddress} width="full" />
            <MachoteField label="Dirección USA" value={props.customerUsaAddress} width="full" />
          </MachoteGrid>
        </MachoteSection>

        <MachoteSection title="2. Datos del vehículo y facturación">
          <MachoteGrid>
            <MachoteField
              label="Marca y modelo"
              value={`${props.vehicleBrand} ${props.vehicleModel} ${props.vehicleYear}`}
              width="half"
            />
            <MachoteField label="Placa / Matrícula" value={props.plate} width="half" />
            <MachoteField label="Tipo de vehículo" value={props.vehicleType} width="half" />
            <MachoteField
              label="Combustible (salida)"
              value={props.fuelOutLabel ? `Registrado: ${props.fuelOutLabel}` : null}
              width="half"
            />
            <MachoteField
              label="Devolución pactada"
              value={`${props.endDateLabel} · ${props.endTimeLabel}`}
              width="full"
            />
            <MachoteField
              label="Días acordados"
              value={`${props.rentalDays} día${props.rentalDays === 1 ? "" : "s"}`}
              width="third"
            />
            <MachoteField
              label="Tarifa diaria"
              value={`${formatMoney(props.dailyRate)} / día`}
              width="third"
            />
            <MachoteField label="Depósito (garantía)" value={formatMoney(props.deposit)} width="third" />
          </MachoteGrid>
          <View style={machoteStyles.billingRow}>
            <Text style={{ fontSize: 7.5 }}>Renta ({props.rentalDays} días × {formatMoney(props.dailyRate)})</Text>
            <Text style={{ fontSize: 7.5 }}>{formatMoney(subtotalRental)}</Text>
          </View>
          {props.insurance > 0 ? (
            <View style={machoteStyles.billingRow}>
              <Text style={{ fontSize: 7.5 }}>Seguro</Text>
              <Text style={{ fontSize: 7.5 }}>{formatMoney(props.insurance)}</Text>
            </View>
          ) : null}
          {billingLines.map((line) => (
            <View key={line.label} style={machoteStyles.billingRow}>
              <Text style={{ fontSize: 7.5 }}>{line.label}</Text>
              <Text style={{ fontSize: 7.5 }}>{formatMoney(line.amount)}</Text>
            </View>
          ))}
          {(props.otherCharges ?? 0) > 0 ? (
            <View style={machoteStyles.billingRow}>
              <Text style={{ fontSize: 7.5 }}>Otros cargos</Text>
              <Text style={{ fontSize: 7.5 }}>{formatMoney(props.otherCharges ?? 0)}</Text>
            </View>
          ) : null}
          <View style={machoteStyles.billingTotal}>
            <Text style={styles.totalStrong}>MONTO TOTAL</Text>
            <Text style={styles.totalStrong}>{formatMoney(props.total)}</Text>
          </View>
          <Text style={[styles.disclaimer, { marginHorizontal: 6, marginBottom: 4 }]}>
            ESTE DOCUMENTO NO ES UNA FACTURA; EXÍJALA CUANDO SU SERVICIO ESTÉ FINALIZADO
          </Text>
        </MachoteSection>

        <MachoteSection title="3. Inspección de estado del vehículo y combustible">
          <Text style={{ fontSize: 6.5, color: MUTED, paddingHorizontal: 6, paddingTop: 4 }}>
            Simbología: (X) Rayón · (O) Golpe · (*) Cristal · (△) Faltante
          </Text>
          <View style={[styles.twoColMain, { paddingHorizontal: 4, paddingBottom: 4 }]}>
            <View style={styles.photoPanel}>
              {props.inspectionWireframeUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf
                <Image
                  src={props.inspectionWireframeUrl}
                  style={styles.wireframeDiagram}
                />
              ) : props.primaryPhotoUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf
                <Image src={props.primaryPhotoUrl} style={styles.heroPhoto} />
              ) : props.viewPhotos?.FRONT ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf
                <Image src={props.viewPhotos.FRONT} style={styles.heroPhoto} />
              ) : (
                <View style={[styles.heroPhoto, { backgroundColor: LIGHT, justifyContent: "center", alignItems: "center" }]}>
                  <Text style={{ fontSize: 7, color: MUTED }}>Sin diagrama del vehículo</Text>
                </View>
              )}
              <FuelGauge
                label="NIVEL COMBUSTIBLE"
                activeIndex={fuelIndexFromLabel(props.fuelOutLabel)}
              />
            </View>
            <View style={styles.checklistPanel}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 }}>
                CHECKLIST INVENTARIO (SALIDA)
              </Text>
              {checklistRows.map((item) => (
                <View key={item.key} style={styles.checklistItem}>
                  <Text style={styles.checklistMark}>
                    [{item.checkOut === "✓" ? " ✓ " : item.checkOut || "   "}]
                  </Text>
                  <Text style={styles.checklistLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </MachoteSection>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {businessName} · {CONTRACT_PDF_TEMPLATE_VERSION}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* ===================== FIRMAS APERTURA ===================== */}
      <Page size="LETTER" style={styles.page}>
        <Text style={[styles.sectionTitle, { marginTop: 0 }]}>
          Términos y condiciones generales
        </Text>
        {clauses.slice(0, 3).map((clause) => (
          <Text key={clause.slice(0, 24)} style={[styles.clause, { fontSize: 7 }]}>
            {clause}
          </Text>
        ))}
        <Text style={{ fontSize: 7, marginTop: 6, fontFamily: "Helvetica-Bold", color: NAVY }}>
          ✓ ACEPTO Y ESTOY DE ACUERDO con los términos, inventario y estado del vehículo
          registrados en este contrato de apertura.
        </Text>

        <Text style={styles.sectionTitle}>Observaciones</Text>
        <View
          style={{
            minHeight: 36,
            borderWidth: 1,
            borderColor: LINE,
            padding: 4,
          }}
        >
          <Text style={{ fontSize: 7.5 }}>
            {props.observations || props.notes || " "}
          </Text>
        </View>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>
              FIRMA DEL ARRENDATARIO
            </Text>
            <Text style={{ fontSize: 7 }}>
              Nombre: {props.customerName}
            </Text>
            <Text style={{ fontSize: 7 }}>
              Firma:{" "}
              {props.clientSignedAt
                ? `Firmado ${props.clientSignedAt}`
                : "________________"}
            </Text>
          </View>
          <View style={styles.signBox}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>
              POR LA EMPRESA ARRENDADORA
            </Text>
            <Text style={{ fontSize: 7 }}>
              Nombre:{" "}
              {props.operatorName?.trim()
                ? props.operatorName
                : "____________________"}
            </Text>
            {props.operatorSignatureUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf
              <Image
                src={props.operatorSignatureUrl}
                style={{ width: 120, height: 36, objectFit: "contain", marginTop: 4 }}
              />
            ) : (
              <Text style={{ fontSize: 7 }}>
                Firma:{" "}
                {props.representativeSignedAt
                  ? `Firmado ${props.representativeSignedAt}`
                  : "________________"}
              </Text>
            )}
          </View>
        </View>

        <Text
          style={{
            fontSize: 7,
            marginTop: 8,
            fontFamily: "Helvetica-Bold",
            textAlign: "center",
            color: NAVY,
          }}
        >
          {(props.annexPhotos?.length ?? 0) > 0
            ? "Las fotos de comprobación se anexan al final de este documento."
            : "Puede adjuntar fotos de comprobación desde la inspección; se imprimirán al final."}
        </Text>

        <Text
          style={{
            fontSize: 6.5,
            marginTop: 6,
            color: MUTED,
            textAlign: "center",
          }}
        >
          {OLDES_CONTRACT_FOOTER_NOTE}
        </Text>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {businessName} · {CONTRACT_PDF_TEMPLATE_VERSION}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* ===================== REVERSO ===================== */}
      <Page size="LETTER" style={styles.pageBack}>
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Helvetica-Bold",
            color: NAVY,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          CONTRATO DE ARRENDAMIENTO — CONDICIONES GENERALES
        </Text>
        <Text
          style={{
            fontSize: 8,
            textAlign: "center",
            marginBottom: 10,
            color: MUTED,
          }}
        >
          {legalName}
        </Text>

        {clauses.map((clause) => (
          <Text key={clause.slice(0, 24)} style={styles.clause}>
            {clause}
          </Text>
        ))}

        <View
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: LINE,
            padding: 8,
            backgroundColor: LIGHT,
          }}
        >
          <Text
            style={{
              fontSize: 8,
              fontFamily: "Helvetica-Bold",
              marginBottom: 4,
              color: NAVY,
            }}
          >
            AUTORIZACIÓN DE CARGO A TARJETA DE CRÉDITO
          </Text>
          <Text style={{ fontSize: 7.5, lineHeight: 1.45 }}>
            Yo, {props.customerName || "________________"}, autorizo a{" "}
            {legalName} cargar a mi tarjeta de Crédito N°
            ________________________ con fecha de vencimiento: ____/____ el
            monto de $ {formatMoney(props.total)} en concepto de: alquiler de
            vehículo / depósito en garantía / cargos adicionales derivados del
            presente contrato {props.contractCode}.
          </Text>
        </View>

        <View style={{ alignItems: "center", marginTop: 28 }}>
          <View
            style={{
              width: 240,
              borderTopWidth: 1,
              borderTopColor: LINE,
              paddingTop: 4,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>
              FIRMA DEL ARRENDATARIO (TÉRMINOS)
            </Text>
            <Text style={{ fontSize: 7, color: MUTED }}>
              {props.customerName}
              {props.clientSignedAt
                ? ` · Firmado ${props.clientSignedAt}`
                : ""}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 7,
            marginTop: 16,
            color: MUTED,
            textAlign: "center",
          }}
        >
          Los pagarés se gestionan por escrito y por separado para notarización.
          No forman parte de este PDF digital.
        </Text>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Términos — {props.contractCode}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>

      {(props.annexPhotos?.length ?? 0) > 0 ? (
        <Page size="LETTER" style={styles.page}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Helvetica-Bold",
              color: NAVY,
              marginBottom: 8,
            }}
          >
            ANEXO — Fotos de comprobación
          </Text>
          <Text style={{ fontSize: 8, color: MUTED, marginBottom: 10 }}>
            Contrato {props.contractCode} · Evidencia fotográfica adjunta al
            final del documento.
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {props.annexPhotos!.map((photo, index) => (
              <View
                key={`${photo.url}-${index}`}
                style={{
                  width: "48%",
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: LINE,
                  padding: 4,
                }}
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf */}
                <Image
                  src={photo.url}
                  style={{ width: "100%", height: 180, objectFit: "contain" }}
                />
                <Text style={{ fontSize: 7, marginTop: 4, color: MUTED }}>
                  {photo.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>Anexos — {props.contractCode}</Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) =>
                `Página ${pageNumber} de ${totalPages}`
              }
            />
          </View>
        </Page>
      ) : null}
    </Document>
  );
}
