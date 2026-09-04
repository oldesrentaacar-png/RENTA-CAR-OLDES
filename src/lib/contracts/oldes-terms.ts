/** Contenido legal y catálogo alineados al contrato físico OLDES Renta Autos. */

export const OLDES_COMPANY = {
  legalName: "OPERADOR LOGISTICO DE EL SALVADOR, SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE (OLDES, S.A. DE C.V.)",
  legalNameShort: "OLDES, S.A. DE C.V.",
  brandName: "OLDES Rent-a-Car",
  slogan: "¡Ofreciéndote siempre lo mejor!",
  address: "CWXV+297, San Luis Talpa",
  email: "soporte@oldesrentacar.com",
  website: "www.oldes.com.sv",
  phones: ["+503 7435-0381"],
  whatsapp: "+503 7435-0381",
  social: "@OLDES RENTA AUTOSV",
  /** Fallback / pérdida total mínima */
  deductibleUsd: 1500,
  deductibleSedanUsd: 490,
  deductibleSuvMinivanUsd: 800,
  deductiblePickupUsd: 1500,
  photoFineAdminFeeUsd: 15,
  registrationCardLossFeeUsd: 350,
  lateInterestMonthlyPercent: 2,
  totalLossMinUsd: 1500,
  totalLossPercent: 25,
} as const;

/** Deducible por categoría de vehículo (póliza). */
export function deductibleForVehicleType(
  typeSlugOrName?: string | null,
): number {
  const hay = (typeSlugOrName ?? "").toLowerCase();
  if (hay.includes("pickup") || hay.includes("pick-up") || hay.includes("pick up")) {
    return OLDES_COMPANY.deductiblePickupUsd;
  }
  if (
    hay.includes("suv") ||
    hay.includes("camioneta") ||
    hay.includes("minivan") ||
    hay.includes("mini van")
  ) {
    return OLDES_COMPANY.deductibleSuvMinivanUsd;
  }
  return OLDES_COMPANY.deductibleSedanUsd;
}

/**
 * Pagaré mercantil solo para clientes locales (El Salvador / DUI).
 * Turistas con pasaporte extranjero / USA: no se imprime ni se exige.
 */
export function shouldIncludePagare(customer: {
  country?: string | null;
  dui?: string | null;
  passport?: string | null;
}): boolean {
  const country = (customer.country ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (
    country.includes("united states") ||
    country.includes("estados unidos") ||
    country.includes("ee.uu") ||
    country.includes("eeuu") ||
    country === "us" ||
    country === "usa"
  ) {
    return false;
  }
  if (customer.dui?.trim()) return true;
  if (country.includes("salvador") || country === "sv") return true;
  // Pasaporte sin DUI → turista / extranjero
  if (customer.passport?.trim() && !customer.dui?.trim()) return false;
  return false;
}

/** Treat empty / seed placeholders as missing so PDFs use OLDES defaults. */
function isUsableContactValue(value?: string | null): value is string {
  if (!value?.trim()) return false;
  const normalized = value.trim().toLowerCase();
  return !(
    normalized.includes("0000-0000") ||
    normalized === "n/a" ||
    normalized === "-"
  );
}

function isUsableAddress(value?: string | null): value is string {
  if (!isUsableContactValue(value)) return false;
  const normalized = value.trim().toLowerCase();
  return !(
    normalized.includes("la rábida") ||
    normalized.includes("la rabida") ||
    normalized.includes("31 calle") ||
    normalized.includes("san antonio, san miguel")
  );
}

function isUsableEmail(value?: string | null): value is string {
  if (!isUsableContactValue(value)) return false;
  const normalized = value.trim().toLowerCase();
  return !(
    normalized === "info@oldesrentacar.com" ||
    normalized === "administracion@oldes.com.sv"
  );
}

export type PdfBusinessContact = {
  businessName: string;
  legalName: string | null;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  businessWhatsapp: string;
  businessWebsite: string;
};

/** Resolve contact block for every generated PDF (settings + hard defaults). */
export function resolvePdfBusinessContact(settings?: {
  business_name?: string | null;
  legal_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
} | null): PdfBusinessContact {
  const phone = isUsableContactValue(settings?.phone)
    ? settings.phone.trim()
    : OLDES_COMPANY.phones[0];
  const whatsapp = isUsableContactValue(settings?.whatsapp)
    ? settings.whatsapp.trim()
    : OLDES_COMPANY.whatsapp;

  return {
    businessName: isUsableContactValue(settings?.business_name)
      ? settings.business_name.trim()
      : OLDES_COMPANY.brandName,
    legalName: isUsableContactValue(settings?.legal_name)
      ? settings.legal_name.trim()
      : OLDES_COMPANY.legalName,
    businessAddress: isUsableAddress(settings?.address)
      ? settings.address.trim()
      : OLDES_COMPANY.address,
    businessPhone: phone,
    businessEmail: isUsableEmail(settings?.email)
      ? settings.email.trim()
      : OLDES_COMPANY.email,
    businessWhatsapp: whatsapp,
    businessWebsite: OLDES_COMPANY.website,
  };
}

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
 * Contrato digital de arrendamiento — cláusulas oficiales OLDES, S.A. DE C.V.
 * Orden: 1–10. El pagaré NO forma parte de estas cláusulas (documento aparte).
 */
export const OLDES_CONTRACT_CLAUSES: string[] = [
  "CONTRATO DIGITAL DE ARRENDAMIENTO DE VEHÍCULO — OLDES, S.A. DE C.V.",
  "CLÁUSULAS DEL CONTRATO",
  '1. PARTES Y OBJETO\nEl presente contrato se celebra entre OLDES, S.A. DE C.V. (en adelante "La Arrendadora") y la persona natural o jurídica identificada como cliente en el formulario de recepción/anverso digital (en adelante "El Arrendatario"). La Arrendadora entrega en arrendamiento a El Arrendatario, y este recibe a título de depósito y bajo su entera responsabilidad, el vehículo automotor y sus accesorios descritos en la ficha técnica del servicio.',
  "2. PLAZO, ENTREGA Y DEVOLUCIÓN\n2.1. Plazo: El plazo del arrendamiento será el estipulado en la recepción del servicio, computado por horas, días, semanas o meses.\n2.2. Devolución: El Arrendatario se obliga a devolver el vehículo en la fecha, hora y lugar convenidos (incluyendo gasolineras, residenciales o las instalaciones de La Arrendadora) en las mismas condiciones mecánicas, estéticas y de limpieza en que lo recibió.\n2.3. Retrasos y Apropiación Indebida: Si El Arrendatario no devuelve el vehículo dentro del plazo pactado ni solicita una extensión autorizada por escrito, incurrirá en mora y facultará a La Arrendadora para reposesionarlo en el lugar donde se encuentre, sin necesidad de requerimiento judicial previo. El Arrendatario responderá por los días adicionales, cargos por mora y reajustes de tarifa aplicables.",
  "3. CONDICIONES DE PAGO Y DEPÓSITO DE GARANTÍA\n3.1. Formas de Pago: El pago total del alquiler debe realizarse al momento de recibir el vehículo. Se acepta efectivo y tarjetas de crédito/débito.\n3.2. Depósito de Garantía: El Arrendatario debe constituir un depósito de garantía o preautorización en tarjeta de crédito. La Arrendadora queda expresamente autorizada para cargar a la tarjeta de crédito suministrada cualquier saldo pendiente por: excedente de tiempo, combustible, faltantes de accesorios, daños ocultos, reparaciones menores y multas de tránsito.",
  `4. FOTO-MULTAS, INFRACCIONES DE TRÁNSITO Y MULTAS EXTEMPORÁNEAS\n4.1. Responsabilidad Directa: El Arrendatario es el único responsable por las infracciones, esquelas y multas de tránsito cometidas durante el periodo de arrendamiento.\n4.2. Notificación Diferida (Sistema SERTRASEN/VMT): El Arrendatario reconoce y acepta que las foto-multas e infracciones de tránsito pueden tardar de 3 a 5 días hábiles (o más) en verse reflejadas en el sistema de SERTRASEN u organismos correspondientes.\n4.3. Autorización de Cobro Post-Alquiler: El Arrendatario autoriza a La Arrendadora a realizar el cobro posterior a su tarjeta de crédito/débito por el valor de cualquier esquela o foto-multa imputada al vehículo dentro de la fecha y hora comprendidas en su contrato, sumando un cargo administrativo de US$ ${OLDES_COMPANY.photoFineAdminFeeUsd.toFixed(2)} por gestión del trámite. La Arrendadora remitirá al cliente el comprobante de la multa emitida por la autoridad competente.`,
  "5. CONDICIONES Y RESTRICCIONES DE USO\nEl vehículo será conducido exclusivamente por El Arrendatario o los conductores adicionales registrados digitalmente. Se prohíbe estrictamente:\na) Permitir la conducción a personas no autorizadas en el contrato o menores de 21 años.\nb) Conducir sin la licencia de conducir vigente correspondiente al tipo de vehículo.\nc) Conducir bajo los efectos del alcohol, drogas o sustancias psicotrópicas.\nd) Destinar el vehículo al transporte remunerado de pasajeros o carga sin autorización por escrito.\ne) Transportar carga pesada que exceda la capacidad del vehículo o remolcar otros automotores.\nf) Transitar fuera del territorio de la República de El Salvador, salvo autorización notarial expresa emitida por La Arrendadora.\ng) Exceder los límites de velocidad legales (máximo 90 km/h o lo regulado por la Ley de Tránsito).\nh) Circular por vías no pavimentadas, inapropiadas o inaccesibles que pongan en riesgo la integridad mecánica o estética de la unidad.\ni) Incurrir en negligencia, como no revisar los niveles de aceite, líquido refrigerante o ignorar testigos de alerta en el tablero.\nEl incumplimiento de cualquiera de estas restricciones anula automáticamente toda cobertura de seguro o protección contratada, haciendo a El Arrendatario responsable del 100% de los daños, pérdidas y responsabilidades civiles o penales.",
  `6. PÓLIZA DE SEGURO, DEDUCIBLES Y PÉRDIDA TOTAL / ROBO\n6.1. Deducible por Colisión y Daños Reparables: En caso de accidente o colisión que requiera reparación mecánica o de carrocería, y siempre que el cliente cumpla con el procedimiento policial y del contrato, El Arrendatario pagará el deducible correspondiente a la categoría del vehículo:\n• Vehículos Sedán: US$ ${OLDES_COMPANY.deductibleSedanUsd.toFixed(2)}\n• Camionetas (SUV) y Minivans: US$ ${OLDES_COMPANY.deductibleSuvMinivanUsd.toFixed(2)}\n• Pick-Up: US$ ${OLDES_COMPANY.deductiblePickupUsd.toFixed(2)}\n6.2. Deducible por Pérdida Total o Robo Total: En caso de Pérdida Total del vehículo (declarada por la compañía aseguradora a consecuencia de accidente, vuelco o destrucción) o Robo Total de la unidad, El Arrendatario responderá por el equivalente al ${OLDES_COMPANY.totalLossPercent}% del valor comercial o de factura del vehículo, con un monto mínimo cobrable de US$ ${OLDES_COMPANY.totalLossMinUsd.toFixed(2)}. Este valor cubre la franquicia del seguro, así como los gastos administrativos e indemnización por el tiempo de inactividad de la unidad (lucro cesante) durante el proceso de liquidación del siniestro.\n6.3. Daños Menores: Los daños que no requieran reclamo formal ante la aseguradora (tales como rayones leves, abolladuras menores o piezas de desgaste rápido) serán asumidos directamente por El Arrendatario según la cotización real de reparación efectuada por La Arrendadora.\n6.4. Exclusiones de la Cobertura: La cobertura no aplica para: daños en la parte inferior del vehículo (chasis, cárter, suspensión); robo parcial de piezas, accesorios, llantas o llaves de encendido; daños causados por conducir en estado de ebriedad o bajo efectos de drogas; pérdida o extravío de la tarjeta de circulación (costo de reposición y compensación por inmovilización: US$ ${OLDES_COMPANY.registrationCardLossFeeUsd.toFixed(2)}).`,
  "7. PROCEDIMIENTO EN CASO DE ACCIDENTE O SINIESTRO\nEn caso de colisión, robo o incidente vial, El Arrendatario se obliga a: (1) dar aviso inmediato a La Arrendadora; (2) permanecer en el lugar del siniestro y solicitar la inspección de la Policía Nacional Civil (PNC) y de la aseguradora; (3) obtener la certificación o constancia de la inspección policial. La omisión de estos pasos invalidará la cobertura del seguro, trasladando la responsabilidad total de los costos de reparación, indemnizaciones a terceros y lucro cesante a El Arrendatario.",
  "8. AUTORIZACIÓN DE CARGOS A TARJETA Y COBROS POSTERIORES\nEl Arrendatario autoriza de manera expresa e irrevocable a OLDES, S.A. DE C.V. a cargar a la tarjeta de crédito o débito registrada al momento de la apertura del contrato o recepción del vehículo, todos los valores pendientes derivados de la prestación del servicio, tales como: extensiones de tiempo, combustible, deducibles de seguro, faltantes de accesorios, daños ocultos, reparaciones menores, así como el monto de esquelas, foto-multas o infracciones de tránsito cometidas durante el periodo de arrendamiento. La firma del presente contrato constituye autorización suficiente de cobro ante la entidad emisora del plástico.",
  "9. PERTENENCIAS PERSONALES\nLa Arrendadora no se hace responsable por la pérdida, olvido o daño de objetos personales, equipaje o valores dejados en el interior del vehículo durante o al finalizar el periodo de arrendamiento.",
  "10. JURISDICCIÓN Y LEGISLACIÓN\nPara la interpretación y cumplimiento de este contrato, las partes se someten a las leyes de la República de El Salvador y a la jurisdicción de los tribunales de la ciudad de San Salvador, renunciando al fuero de sus domicilios.",
];

export const OLDES_CONTRACT_FOOTER_NOTE =
  "ESTE DOCUMENTO NO ES UNA FACTURA; EXÍJALA CUANDO SU SERVICIO ESTÉ FINALIZADO.";

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
