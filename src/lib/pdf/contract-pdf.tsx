import {
  Circle,
  Document,
  Image,
  Line,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  OLDES_ACCESSORIES,
  OLDES_COMPANY,
  OLDES_CONTRACT_CLAUSES,
  OLDES_CONTRACT_FOOTER_NOTE,
  OLDES_DAMAGE_LEGEND,
} from "@/lib/contracts/oldes-terms";
import { getPickupCadElements } from "@/lib/inspections/pickup-cad";
import {
  PANEL_VIEWBOX,
  getCarPaths,
  getPanelsForBody,
  resolveBodyStyle,
  type VehicleBodyStyle,
} from "@/lib/inspections/vehicle-panel-map";
import { formatMoney } from "@/lib/money";
import { PDF_BRAND } from "@/lib/pdf/brand-assets";

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
  bodyStyle?: VehicleBodyStyle | null;
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
  /** Fotos de inspección / comprobación — se imprimen al final. */
  annexPhotoUrls?: string[];
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
    paddingBottom: 36,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  pageBack: {
    paddingTop: 32,
    paddingBottom: 36,
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
    width: 64,
    height: 42,
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
  leftCol: { width: "48%" },
  rightCol: { width: "52%" },
  fuelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  fuelLabel: {
    width: 42,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  fuelScale: {
    flexDirection: "row",
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
  },
  fuelCell: {
    flex: 1,
    fontSize: 6,
    textAlign: "center",
    paddingVertical: 2,
    borderRightWidth: 0.5,
    borderRightColor: LINE,
  },
  fuelActive: {
    backgroundColor: "#fde68a",
    fontFamily: "Helvetica-Bold",
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
  legendRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  legendItem: {
    fontSize: 7,
  },
  diagramGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  diagramBox: {
    width: "32%",
    borderWidth: 1,
    borderColor: LINE,
    padding: 4,
    alignItems: "center",
    marginBottom: 4,
  },
  diagramPhoto: {
    width: 150,
    height: 100,
    objectFit: "cover",
  },
  diagramOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 150,
    height: 100,
  },
  diagramStack: {
    position: "relative",
    width: 150,
    height: 100,
  },
  diagramCaption: {
    fontSize: 6.5,
    color: MUTED,
    marginBottom: 3,
    fontFamily: "Helvetica-Bold",
  },
  realPhotosRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  realPhotoBox: {
    width: "32%",
    borderWidth: 1,
    borderColor: LINE,
    padding: 3,
  },
  realPhotoImg: {
    width: "100%",
    height: 58,
    objectFit: "cover",
  },
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

const FUEL_MARKS = ["E", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8", "F"] as const;

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
        {FUEL_MARKS.map((mark, index) => (
          <Text
            key={mark}
            style={[
              styles.fuelCell,
              index === activeIndex ? styles.fuelActive : {},
              index === FUEL_MARKS.length - 1 ? { borderRightWidth: 0 } : {},
            ]}
          >
            {mark}
          </Text>
        ))}
      </View>
    </View>
  );
}

function PanelMapSvg({
  bodyStyle,
  marks,
}: {
  bodyStyle: VehicleBodyStyle;
  marks: ContractDamageMarkPdf[];
}) {
  const panels = getPanelsForBody(bodyStyle);
  const paths = getCarPaths(bodyStyle);
  const { width, height } = PANEL_VIEWBOX;
  const topMarks = marks.filter((m) => m.view === "TOP");
  const stroke = NAVY;

  return (
    <Svg width={200} height={360} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={0} width={width} height={height} fill="#f3e6c0" />
      <Text
        x={width / 2 - 42}
        y={22}
        style={{
          fontSize: 12,
          fill: stroke,
          fontFamily: "Helvetica-Bold",
        }}
      >
        CARRO SEDAN
      </Text>
      <Path d={paths.body} fill="#ffffff" stroke={stroke} strokeWidth={2.4} />
      <Path d={paths.bumperFront} fill="#ffffff" stroke={stroke} strokeWidth={1.5} />
      <Path d={paths.hood} fill="#ffffff" stroke={stroke} strokeWidth={1.5} />
      <Path d={paths.fenderFL} fill="#ffffff" stroke={stroke} strokeWidth={1.4} />
      <Path d={paths.fenderFR} fill="#ffffff" stroke={stroke} strokeWidth={1.4} />
      <Path d={paths.doorFL} fill="#ffffff" stroke={stroke} strokeWidth={1.4} />
      <Path d={paths.doorFR} fill="#ffffff" stroke={stroke} strokeWidth={1.4} />
      <Path d={paths.stepL} fill="#ffffff" stroke={stroke} strokeWidth={1.3} />
      <Path d={paths.stepR} fill="#ffffff" stroke={stroke} strokeWidth={1.3} />
      <Path d={paths.roof} fill="#ffffff" stroke={stroke} strokeWidth={1.5} />
      <Path d={paths.doorRL} fill="#ffffff" stroke={stroke} strokeWidth={1.4} />
      <Path d={paths.doorRR} fill="#ffffff" stroke={stroke} strokeWidth={1.4} />
      <Path d={paths.fenderRL} fill="#ffffff" stroke={stroke} strokeWidth={1.4} />
      <Path d={paths.fenderRR} fill="#ffffff" stroke={stroke} strokeWidth={1.4} />
      <Path d={paths.trunk} fill="#ffffff" stroke={stroke} strokeWidth={1.5} />
      <Path d={paths.bumperRear} fill="#ffffff" stroke={stroke} strokeWidth={1.5} />
      {paths.wheels.map((w) => (
        <Circle
          key={`wo-${w.cx}-${w.cy}`}
          cx={w.cx}
          cy={w.cy}
          r={w.r}
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={2.2}
        />
      ))}
      {paths.wheels.map((w) => (
        <Circle
          key={`wi-${w.cx}-${w.cy}`}
          cx={w.cx}
          cy={w.cy}
          r={w.r * 0.45}
          fill="none"
          stroke={stroke}
          strokeWidth={1.6}
        />
      ))}
      {panels.map((panel) => (
        <Text
          key={`${panel.id}-label`}
          x={panel.lx - Math.min(40, (panel.label.length * (panel.fontSize ?? 7)) / 3.2)}
          y={panel.ly}
          style={{
            fontSize: panel.fontSize ?? 7,
            fill: stroke,
            fontFamily: "Helvetica-Bold",
          }}
        >
          {panel.label}
        </Text>
      ))}
      {topMarks.map((mark, index) => (
        <Text
          key={`m-${index}`}
          x={mark.x * width}
          y={mark.y * height}
          style={{
            fontSize: 14,
            fill: mark.phase === "IN" ? "#b45309" : RED,
            fontFamily: "Helvetica-Bold",
          }}
        >
          {mark.symbol}
        </Text>
      ))}
    </Svg>
  );
}

function PickupCadSvg({ view }: { view: ContractDamageMarkPdf["view"] }) {
  const elements = getPickupCadElements(view);
  return (
    <>
      {elements.map((el, index) => {
        const key = `${el.type}-${index}`;
        if (el.type === "rect") {
          return (
            <Rect
              key={key}
              x={el.x}
              y={el.y}
              width={el.w}
              height={el.h}
              rx={el.rx ?? 0}
              fill={el.fill}
              stroke={el.stroke === "none" ? undefined : el.stroke}
              strokeWidth={el.sw ?? 1}
            />
          );
        }
        if (el.type === "circle") {
          return (
            <Circle
              key={key}
              cx={el.cx}
              cy={el.cy}
              r={el.r}
              fill={el.fill}
              stroke={el.stroke}
              strokeWidth={el.sw}
            />
          );
        }
        if (el.type === "line") {
          return (
            <Line
              key={key}
              x1={el.x1}
              y1={el.y1}
              x2={el.x2}
              y2={el.y2}
              stroke={el.stroke}
              strokeWidth={el.sw ?? 1}
            />
          );
        }
        return (
          <Path
            key={key}
            d={el.d}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={el.sw ?? 1}
          />
        );
      })}
    </>
  );
}

function CarDiagram({
  caption,
  view,
  marks,
  photoUrl,
}: {
  caption: string;
  view: ContractDamageMarkPdf["view"];
  marks: ContractDamageMarkPdf[];
  photoUrl?: string | null;
}) {
  return (
    <View style={styles.diagramBox}>
      <Text style={styles.diagramCaption}>{caption}</Text>
      <View style={styles.diagramStack}>
        {photoUrl ? (
          <Image src={photoUrl} style={styles.diagramPhoto} />
        ) : (
          <Svg width={150} height={100} viewBox="0 0 300 300">
            <PickupCadSvg view={view} />
          </Svg>
        )}
        <Svg
          style={styles.diagramOverlay}
          width={150}
          height={100}
          viewBox="0 0 300 300"
        >
          {marks.map((mark, index) => (
            <Text
              key={`${mark.symbol}-${mark.phase ?? "OUT"}-${index}`}
              x={mark.x * 300}
              y={mark.y * 300}
              style={{
                fontSize: 18,
                fill: mark.phase === "IN" ? "#b45309" : RED,
                fontFamily: "Helvetica-Bold",
              }}
            >
              {mark.symbol}
            </Text>
          ))}
        </Svg>
      </View>
      <Text style={{ fontSize: 5.5, color: MUTED, marginTop: 2 }}>
        {photoUrl ? "Foto real + marcas" : "Diagrama CAD pickup"}
      </Text>
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

  const marks = props.damageMarks ?? [];
  const byView = (view: ContractDamageMarkPdf["view"]) =>
    marks.filter((m) => m.view === view);

  const idDoc =
    props.customerDui ||
    props.customerPassport ||
    props.customerIdentification ||
    "";

  const clauses =
    props.clauses && props.clauses.trim().length > 40
      ? props.clauses.split(/\n+/).filter(Boolean)
      : OLDES_CONTRACT_CLAUSES;

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
            <Text style={styles.title}>CONTRATO DE ALQUILER{"\n"}DE VEHÍCULO</Text>
            <Text style={styles.contractNo}>No. {props.contractCode}</Text>
            <Text style={[styles.meta, { marginTop: 4 }]}>
              REGISTRO IVA: {props.ivaRegistry || "____________________"}
            </Text>
          </View>
        </View>

        <View style={styles.checkboxRow}>
          <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>
            OPERADO POR:
          </Text>
          <View style={styles.checkItem}>
            <View
              style={[
                styles.box,
                props.operatedAs !== "INTERMEDIATION" ? styles.boxChecked : {},
              ]}
            />
            <Text style={{ fontSize: 7 }}>Operador logístico</Text>
          </View>
          <View style={styles.checkItem}>
            <View
              style={[
                styles.box,
                props.operatedAs === "INTERMEDIATION" ? styles.boxChecked : {},
              ]}
            />
            <Text style={{ fontSize: 7 }}>Intermediación</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>1. Datos del arrendatario</Text>
        <Field label="ARRENDATARIO(A):" value={props.customerName} />
        <Field
          label="FACTURAR A NOMBRE DE:"
          value={props.billingName || props.customerName}
        />
        <Field label="DIRECCIÓN:" value={props.customerAddress} />
        <View style={styles.dual}>
          <Field label="CONDUCTOR:" value={props.driverName || props.customerName} />
          <Field label="TEL:" value={props.customerPhone} />
        </View>
        <View style={styles.dual}>
          <Field label="LICENCIA:" value={props.licenseNumber} />
          <Field label="VENCIMIENTO:" value={props.licenseExpiry} />
        </View>
        <View style={styles.dual}>
          <Field label="DUI O PASAPORTE:" value={idDoc} />
          <Field label="E-MAIL:" value={props.customerEmail} />
        </View>
        <Field label="DIRECCIÓN USA:" value={props.customerUsaAddress} />
        <Field
          label="CONDUCTOR ADICIONAL:"
          value={props.additionalDriverName}
        />

        <Text style={styles.sectionTitle}>2. Datos del vehículo y facturación</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.th}>MARCA</Text>
            <Text style={styles.th}>MODELO</Text>
            <Text style={styles.th}>PLACAS</Text>
            <Text style={styles.th}>TIPO</Text>
          </View>
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.td}>{props.vehicleBrand}</Text>
            <Text style={styles.td}>
              {props.vehicleModel} {props.vehicleYear}
            </Text>
            <Text style={styles.td}>{props.plate}</Text>
            <Text style={[styles.td, styles.tdLast]}>
              {props.vehicleType || "—"}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.th, { flex: 1.2 }]} />
            <Text style={styles.th}>DÍA</Text>
            <Text style={styles.th}>HORAS</Text>
            <Text style={styles.th}>KM</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.td, { flex: 1.2, fontFamily: "Helvetica-Bold" }]}>
              SALIDA
            </Text>
            <Text style={styles.td}>{props.startDateLabel}</Text>
            <Text style={styles.td}>{props.startTimeLabel}</Text>
            <Text style={[styles.td, styles.tdLast]}>
              {props.mileageOut != null ? String(props.mileageOut) : "—"}
            </Text>
          </View>
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.td, { flex: 1.2, fontFamily: "Helvetica-Bold" }]}>
              ENTRADA
            </Text>
            <Text style={styles.td}>{props.endDateLabel}</Text>
            <Text style={styles.td}>{props.endTimeLabel}</Text>
            <Text style={[styles.td, styles.tdLast]}>
              {props.mileageIn != null ? String(props.mileageIn) : "—"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Combustible</Text>
        <FuelGauge
          label="SALIDA"
          activeIndex={fuelIndexFromLabel(props.fuelOutLabel)}
        />
        <FuelGauge
          label="ENTRADA"
          activeIndex={fuelIndexFromLabel(props.fuelInLabel)}
        />
        <Text style={{ fontSize: 6, color: MUTED, marginBottom: 4 }}>
          (No se hace reintegros por combustible no utilizado)
        </Text>

        <View style={styles.twoColMain}>
          <View style={{ width: "100%" }}>
            <Text style={styles.sectionTitle}>Revisión de accesorios</Text>
            <View style={styles.accessoryHeader}>
              <Text style={[styles.accessoryHeaderText, { width: "62%" }]}>
                ACCESORIO
              </Text>
              <Text style={[styles.accessoryHeaderText, { width: "19%" }]}>
                SALIDA
              </Text>
              <Text style={[styles.accessoryHeaderText, { width: "19%" }]}>
                ENTRADA
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {accessories.map((item) => (
                <View
                  key={item.key}
                  style={[styles.accessoryRow, { width: "50%", paddingRight: 4 }]}
                >
                  <Text style={[styles.accessoryLabel, { width: "62%" }]}>
                    {item.label}
                  </Text>
                  <Text style={styles.accessoryMark}>
                    {item.checkOut || "☐"}
                  </Text>
                  <Text style={styles.accessoryMark}>
                    {item.checkIn || "☐"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Estado del vehículo</Text>
        <View style={styles.legendRow}>
          <Text style={[styles.legendItem, { fontFamily: "Helvetica-Bold" }]}>
            CÓDIGO DE IDENTIFICACIÓN:
          </Text>
          {OLDES_DAMAGE_LEGEND.map((item) => (
            <Text key={item.symbol} style={styles.legendItem}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: RED }}>
                {item.symbol}
              </Text>
              {" = "}
              {item.meaning}
            </Text>
          ))}
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start",
            marginTop: 4,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <PanelMapSvg
              bodyStyle={
                props.bodyStyle ||
                resolveBodyStyle(props.vehicleType, props.vehicleModel)
              }
              marks={marks}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: MUTED, marginBottom: 4 }}>
              Marque daños sobre el plano superior (como el formulario físico).
              Rojo = salida · Ámbar = entrada.
            </Text>
            <View style={styles.diagramGrid}>
              <CarDiagram
                caption="Frontal"
                view="FRONT"
                marks={byView("FRONT")}
                photoUrl={props.viewPhotos?.FRONT}
              />
              <CarDiagram
                caption="Trasera"
                view="REAR"
                marks={byView("REAR")}
                photoUrl={props.viewPhotos?.REAR}
              />
              <CarDiagram
                caption="Izquierda"
                view="LEFT"
                marks={byView("LEFT")}
                photoUrl={props.viewPhotos?.LEFT}
              />
              <CarDiagram
                caption="Derecha"
                view="RIGHT"
                marks={byView("RIGHT")}
                photoUrl={props.viewPhotos?.RIGHT}
              />
            </View>
          </View>
        </View>

        <View style={styles.billingBox}>
          <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Facturación</Text>
          <Text style={{ fontSize: 7, marginBottom: 3 }}>
            El servicio a facturar comprende del día {props.startDateLabel} al
            día {props.endDateLabel}
          </Text>
          <View style={styles.billingRow}>
            <Text>Días a facturar</Text>
            <Text>{props.rentalDays}</Text>
          </View>
          <View style={styles.billingRow}>
            <Text>Tarifa por día</Text>
            <Text>{formatMoney(props.dailyRate)}</Text>
          </View>
          <View style={styles.billingRow}>
            <Text>Seguro</Text>
            <Text>{formatMoney(props.insurance)}</Text>
          </View>
          <View style={styles.billingRow}>
            <Text>Otros cargos adicionales</Text>
            <Text>{formatMoney(props.otherCharges ?? 0)}</Text>
          </View>
          <View style={styles.billingRow}>
            <Text>Depósito (garantía)</Text>
            <Text>{formatMoney(props.deposit)}</Text>
          </View>
          <View style={[styles.billingRow, { marginTop: 4 }]}>
            <Text style={styles.totalStrong}>TOTAL</Text>
            <Text style={styles.totalStrong}>{formatMoney(props.total)}</Text>
          </View>
          <Text style={styles.disclaimer}>
            ESTE DOCUMENTO NO ES UNA FACTURA; EXÍJALA CUANDO SU SERVICIO ESTÉ
            FINALIZADO
          </Text>
        </View>

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
              RECIBE (ARRENDATARIO)
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
              ENTREGA (OLDES)
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
          Se anexan fotos de comprobación de entrega al final de este documento.
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
          <Text style={styles.footerText}>{businessName}</Text>
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

      {(props.annexPhotoUrls?.length ?? 0) > 0 ? (
        <Page size="LETTER" style={styles.page}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Helvetica-Bold",
              color: NAVY,
              marginBottom: 8,
            }}
          >
            ANEXO — Fotos de comprobación de entrega
          </Text>
          <Text style={{ fontSize: 8, color: MUTED, marginBottom: 10 }}>
            Contrato {props.contractCode} · Evidencia fotográfica al final del
            documento para impresión corrida.
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {props.annexPhotoUrls!.map((url, index) => (
              <View
                key={`${url}-${index}`}
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
                  src={url}
                  style={{ width: "100%", height: 180, objectFit: "contain" }}
                />
                <Text style={{ fontSize: 7, marginTop: 4, color: MUTED }}>
                  Foto {index + 1}
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
