/** Contenido legal y catálogo alineados al contrato físico OLDES Renta Autos. */

export const OLDES_COMPANY = {
  legalName: "OPERADOR LOGISTICO DE EL SALVADOR, S.A. DE C.V.",
  brandName: "OLDES Renta Autos",
  slogan: "¡Ofreciéndote siempre lo mejor!",
  address: "31 Calle ote. Col. La Rábida # 421, San Salvador",
  email: "administracion@oldes.com.sv",
  website: "www.oldes.com.sv",
  phones: ["2101-3383", "7435-0381"],
  social: "@OLDES RENTA AUTOSV",
  deductibleUsd: 1500,
  registrationCardLossFeeUsd: 350,
  lateInterestMonthlyPercent: 2,
} as const;

/** Accesorios exactos del formulario físico (Salida / Entrada). */
export const OLDES_ACCESSORIES = [
  { key: "spare_tire", label: "LLANTA DE REPUESTO" },
  { key: "mica", label: "MICA" },
  { key: "jack_handle", label: "PALANCA DE MICA" },
  { key: "lug_wrench", label: "LLAVE DE TUERCAS" },
  { key: "triangle", label: "TRIANGULO O CONO" },
  { key: "extinguisher", label: "EXTINGUIDOR" },
  { key: "spare_cover", label: "CUBIERTA LLANTA DE REPUESTO" },
  { key: "interior_mirror", label: "ESPEJO INTERIOR" },
  { key: "exterior_mirror", label: "ESPEJO EXTERIOR" },
  { key: "antenna", label: "ANTENA" },
  { key: "wipers", label: "LIMPIA PARABRISAS" },
  { key: "emblems", label: "EMBLEMAS" },
  { key: "fuel_cap", label: "TAPON DE COMBUSTIBLE" },
  { key: "hubcaps", label: "COPA DE RUEDAS" },
  { key: "mudflaps", label: "LODERAS" },
  { key: "lighter", label: "ENCENDEDOR" },
  { key: "floor_mats", label: "SOBRE ALFOMBRAS" },
  { key: "radio", label: "RADIO / CD PLAYER" },
  { key: "registration_card", label: "TARJETA DE CIRCULACIÓN" },
  { key: "upholstery", label: "TAPICERÍA BUEN ESTADO" },
  { key: "jumper_cables", label: "CABLES PARA CORRIENTE" },
] as const;

export const OLDES_DAMAGE_LEGEND = [
  { symbol: "0", meaning: "GOLPE" },
  { symbol: "+", meaning: "RAYON" },
  { symbol: "x", meaning: "FALTANTE" },
] as const;

/** Mapea tipos de daño al código del formulario físico OLDES. */
export function damageSymbol(type?: string): string {
  if (type === "SCRATCH" || type === "PAINT") return "+";
  if (type === "BROKEN" || type === "CRACK" || type === "MISSING") return "x";
  return "0";
}

/**
 * Cláusulas del reverso del contrato físico OLDES.
 * Montos de deducible / tarjeta alineados al documento original.
 */
export const OLDES_CONTRACT_CLAUSES: string[] = [
  "1. El ARRENDATARIO recibe el vehículo en buen estado de funcionamiento y se obliga a devolverlo en las mismas condiciones, salvo el desgaste normal por uso.",
  "2. El ARRENDATARIO reconoce haber revisado el vehículo al momento de la entrega (salida) y acepta el inventario de accesorios y el estado de carrocería consignados en este contrato.",
  "3. El ARRENDATARIO es responsable de todo faltante, daño, deterioro o pérdida de partes, accesorios o documentos del vehículo ocurridos durante el período de arrendamiento.",
  "4. El vehículo únicamente podrá ser conducido por las personas nombradas en este contrato, mayores de 21 años, con licencia vigente y válida para el territorio de El Salvador.",
  "5. Queda prohibido usar el vehículo para actos ilícitos, carreras, remolque, subarrendarlo, cruzar fronteras sin autorización escrita de OLDES, o conducirlo bajo influencia de alcohol o drogas.",
  `6. La pérdida de la tarjeta de circulación genera un cargo de US$ ${OLDES_COMPANY.registrationCardLossFeeUsd.toFixed(2)}, sin perjuicio de otros daños y perjuicios.`,
  "7. En caso de accidente, el ARRENDATARIO deberá dar aviso inmediato a la Policía Nacional Civil y a OLDES, y no deberá admitir responsabilidad ni efectuar arreglos particulares sin autorización.",
  "8. El ARRENDATARIO se obliga a mantener niveles adecuados de agua, aceite y presión de llantas, y a no continuar la marcha si detecta fallas mecánicas graves.",
  "9. OLDES no se hace responsable por objetos personales dejados dentro del vehículo.",
  "10. El ARRENDATARIO acepta que no se hacen reintegros por combustible no utilizado.",
  `11. CONDICIONES DE SEGURO: aplica deducible de US$ ${OLDES_COMPANY.deductibleUsd.toFixed(2)} en caso de accidente o robo según póliza vigente. Quedan excluidos, entre otros: uso off-road, caminos no pavimentados no autorizados, daños intencionales, conducción ebria y uso por persona no autorizada.`,
  "12. Para la interpretación y cumplimiento de este contrato, las partes se someten a los tribunales de San Salvador, República de El Salvador.",
  "13. El ARRENDATARIO declara haber leído y aceptado todas las condiciones del anverso y reverso de este contrato, firmándolo en señal de conformidad.",
] as const;

export const OLDES_CONTRACT_FOOTER_NOTE =
  "ESTIMADO CLIENTE: FAVOR LEER REVERSO DE ESTE CONTRATO. ESTE DOCUMENTO NO ES UNA FACTURA; EXÍJALA CUANDO SU SERVICIO ESTÉ FINALIZADO.";

/** Convierte un monto USD a texto en español (para el pagaré). */
export function amountToSpanishUsd(amount: number): string {
  const rounded = Math.round(Math.max(0, amount) * 100) / 100;
  const whole = Math.floor(rounded);
  const cents = Math.round((rounded - whole) * 100);
  const words = numberToSpanish(whole).toUpperCase();
  const centText = cents.toString().padStart(2, "0");
  return `${words} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${centText}/100`;
}

function numberToSpanish(n: number): string {
  if (n === 0) return "cero";
  if (n < 0) return `menos ${numberToSpanish(-n)}`;

  const units = [
    "",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciséis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
  ];
  const tens = [
    "",
    "",
    "veinte",
    "treinta",
    "cuarenta",
    "cincuenta",
    "sesenta",
    "setenta",
    "ochenta",
    "noventa",
  ];
  const hundreds = [
    "",
    "ciento",
    "doscientos",
    "trescientos",
    "cuatrocientos",
    "quinientos",
    "seiscientos",
    "setecientos",
    "ochocientos",
    "novecientos",
  ];

  if (n === 100) return "cien";
  if (n < 20) return units[n];
  if (n < 30) {
    return n === 20 ? "veinte" : `veinti${units[n - 20]}`;
  }
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? tens[t] : `${tens[t]} y ${units[u]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const head = h === 1 && rest === 0 ? "cien" : hundreds[h];
    return rest === 0 ? head : `${head} ${numberToSpanish(rest)}`;
  }
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const head =
      thousands === 1 ? "mil" : `${numberToSpanish(thousands)} mil`;
    return rest === 0 ? head : `${head} ${numberToSpanish(rest)}`;
  }

  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  const head =
    millions === 1 ? "un millón" : `${numberToSpanish(millions)} millones`;
  return rest === 0 ? head : `${head} ${numberToSpanish(rest)}`;
}
