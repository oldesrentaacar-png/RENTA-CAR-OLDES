import type {
  Contract,
  ContractSignature,
  Customer,
  Inspection,
  InspectionChecklistItem,
  InspectionDamageMark,
  InspectionPhoto,
  Quote,
  Reservation,
  Vehicle,
  VehicleImage,
  WebRequest,
} from "@/types/database";
import type { CustomerInput } from "@/lib/validation/customer";
import type { VehicleInput } from "@/lib/validation/vehicle";

type CustomerRow = {
  id: string;
  customer_type?: Customer["customer_type"] | null;
  first_name: string;
  last_name: string;
  company_name?: string | null;
  nit?: string | null;
  nrc?: string | null;
  contact_person?: string | null;
  identification: string | null;
  dui: string | null;
  passport: string | null;
  license_number: string | null;
  license_expiry: string | null;
  date_of_birth: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  country: string | null;
  additional_driver_name?: string | null;
  additional_driver_license?: string | null;
  document_image_url?: string | null;
  license_image_url?: string | null;
  receiver_name?: string | null;
  deliverer_name?: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

type VehicleRow = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  vin: string | null;
  chassis: string | null;
  engine_number: string | null;
  color: string | null;
  transmission: string | null;
  fuel_type: string | null;
  passengers: number | null;
  doors: number | null;
  luggage: number | null;
  air_conditioning: boolean;
  category: string | null;
  vehicle_type_id?: string | null;
  ownership_type: Vehicle["ownership_type"];
  daily_rate: number;
  weekly_rate: number | null;
  deposit: number | null;
  public_description: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  sublease_daily_cost?: number | null;
  sublease_payee_name?: string | null;
  internal_notes: string | null;
  engine_oil?: string | null;
  tire_info?: string | null;
  current_mileage?: number | null;
  status: Vehicle["status"];
  published_on_web: boolean;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

type QuoteRow = {
  id: string;
  code: string;
  customer_id: string;
  vehicle_id: string | null;
  vehicle_type_id?: string | null;
  web_request_id: string | null;
  status: Quote["status"];
  language?: string | null;
  start_at: string;
  end_at: string;
  days: number;
  daily_rate: number;
  subtotal: number;
  insurance: number;
  deposit: number;
  delivery_fee: number;
  pickup_fee: number;
  discount: number;
  discount_percent?: number | null;
  other_charges: number;
  tax_rate?: number | null;
  tax: number;
  total: number;
  notes: string | null;
  terms: string | null;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

type ReservationRow = {
  id: string;
  code: string;
  customer_id: string;
  vehicle_id: string;
  quote_id: string | null;
  status: Reservation["status"];
  start_at: string;
  end_at: string;
  pickup_location: string | null;
  return_location: string | null;
  vehicle_type?: string | null;
  agreed_rate: number;
  deposit: number;
  insurance: number;
  total: number;
  cash_amount?: number | null;
  card_amount?: number | null;
  additional_costs?: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

type WebRequestRow = {
  id: string;
  code: string;
  source: WebRequest["source"];
  status: WebRequest["status"];
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  pickup_date: string;
  pickup_time: string | null;
  return_date: string;
  return_time: string | null;
  vehicle_id: string | null;
  vehicle_category: string | null;
  pickup_location: string | null;
  return_location: string | null;
  notes: string | null;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export function mapCustomerRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    customer_type: row.customer_type === "COMPANY" ? "COMPANY" : "PERSON",
    first_name: row.first_name,
    last_name: row.last_name,
    company_name: row.company_name ?? null,
    nit: row.nit ?? null,
    nrc: row.nrc ?? null,
    contact_person: row.contact_person ?? null,
    identification: row.identification,
    dui: row.dui,
    passport: row.passport,
    license_number: row.license_number,
    license_expiry: row.license_expiry,
    date_of_birth: row.date_of_birth,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    address: row.address,
    country: row.country,
    additional_driver_name: row.additional_driver_name ?? null,
    additional_driver_license: row.additional_driver_license ?? null,
    document_image_url: row.document_image_url ?? null,
    license_image_url: row.license_image_url ?? null,
    receiver_name: row.receiver_name ?? null,
    deliverer_name: row.deliverer_name ?? null,
    notes: row.notes,
    status: row.is_active ? "ACTIVE" : "INACTIVE",
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function customerInputToRow(
  input: Partial<CustomerInput>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.customerType !== undefined) row.customer_type = input.customerType;
  if (input.firstName !== undefined) row.first_name = input.firstName;
  if (input.lastName !== undefined) row.last_name = input.lastName;
  if (input.companyName !== undefined)
    row.company_name = input.companyName ?? null;
  if (input.nit !== undefined) row.nit = input.nit ?? null;
  if (input.nrc !== undefined) row.nrc = input.nrc ?? null;
  if (input.contactPerson !== undefined)
    row.contact_person = input.contactPerson ?? null;
  if (input.identification !== undefined)
    row.identification = input.identification ?? null;
  if (input.dui !== undefined) row.dui = input.dui ?? null;
  if (input.passport !== undefined) row.passport = input.passport ?? null;
  if (input.licenseNumber !== undefined)
    row.license_number = input.licenseNumber ?? null;
  if (input.licenseExpiry !== undefined)
    row.license_expiry = input.licenseExpiry ?? null;
  if (input.birthDate !== undefined)
    row.date_of_birth = input.birthDate ?? null;
  if (input.phone !== undefined) row.phone = input.phone;
  if (input.whatsapp !== undefined) row.whatsapp = input.whatsapp ?? null;
  if (input.email !== undefined) row.email = input.email ?? null;
  if (input.address !== undefined) row.address = input.address ?? null;
  if (input.country !== undefined) row.country = input.country ?? null;
  if (input.additionalDriverName !== undefined)
    row.additional_driver_name = input.additionalDriverName ?? null;
  if (input.additionalDriverLicense !== undefined)
    row.additional_driver_license = input.additionalDriverLicense ?? null;
  if (input.documentImageUrl !== undefined)
    row.document_image_url = input.documentImageUrl ?? null;
  if (input.licenseImageUrl !== undefined)
    row.license_image_url = input.licenseImageUrl ?? null;
  if (input.receiverName !== undefined)
    row.receiver_name = input.receiverName ?? null;
  if (input.delivererName !== undefined)
    row.deliverer_name = input.delivererName ?? null;
  if (input.notes !== undefined) row.notes = input.notes ?? null;
  if (input.status !== undefined) row.is_active = input.status === "ACTIVE";
  return row;
}

export function mapVehicleRow(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    year: row.year,
    plate: row.plate,
    vin: row.vin,
    chassis: row.chassis,
    engine: row.engine_number,
    color: row.color,
    transmission: row.transmission,
    fuel_type: row.fuel_type,
    passengers: row.passengers,
    doors: row.doors,
    luggage: row.luggage,
    air_conditioning: row.air_conditioning,
    category: row.category,
    vehicle_type_id: row.vehicle_type_id ?? null,
    ownership_type: row.ownership_type,
    daily_rate: row.daily_rate,
    weekly_rate: row.weekly_rate,
    deposit: row.deposit ?? 0,
    public_description: row.public_description,
    owner_name: row.owner_name,
    owner_phone: row.owner_phone,
    sublease_daily_cost: row.sublease_daily_cost ?? null,
    sublease_payee_name: row.sublease_payee_name ?? null,
    internal_notes: row.internal_notes,
    engine_oil: row.engine_oil ?? null,
    tire_info: row.tire_info ?? null,
    current_mileage: row.current_mileage ?? null,
    status: row.status,
    published_on_web: row.published_on_web,
    is_active: row.is_active,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function vehicleInputToRow(
  input: Partial<VehicleInput>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.brand !== undefined) row.brand = input.brand;
  if (input.model !== undefined) row.model = input.model;
  if (input.year !== undefined) row.year = input.year;
  if (input.plate !== undefined) row.plate = input.plate;
  if (input.vin !== undefined) row.vin = input.vin ?? null;
  if (input.chassis !== undefined) row.chassis = input.chassis ?? null;
  if (input.engine !== undefined) row.engine_number = input.engine ?? null;
  if (input.color !== undefined) row.color = input.color ?? null;
  if (input.transmission !== undefined)
    row.transmission = input.transmission ?? null;
  if (input.fuelType !== undefined) row.fuel_type = input.fuelType ?? null;
  if (input.passengers !== undefined)
    row.passengers = input.passengers ?? null;
  if (input.doors !== undefined) row.doors = input.doors ?? null;
  if (input.luggage !== undefined) row.luggage = input.luggage ?? null;
  if (input.airConditioning !== undefined)
    row.air_conditioning = input.airConditioning;
  if (input.category !== undefined) row.category = input.category ?? null;
  if (input.vehicleTypeId !== undefined)
    row.vehicle_type_id = input.vehicleTypeId ?? null;
  if (input.ownershipType !== undefined)
    row.ownership_type = input.ownershipType;
  if (input.dailyRate !== undefined) row.daily_rate = input.dailyRate;
  if (input.weeklyRate !== undefined)
    row.weekly_rate = input.weeklyRate ?? null;
  if (input.deposit !== undefined) row.deposit = input.deposit;
  if (input.publicDescription !== undefined)
    row.public_description = input.publicDescription ?? null;
  if (input.ownerName !== undefined) row.owner_name = input.ownerName ?? null;
  if (input.ownerPhone !== undefined)
    row.owner_phone = input.ownerPhone ?? null;
  if (input.subleaseDailyCost !== undefined)
    row.sublease_daily_cost = input.subleaseDailyCost ?? null;
  if (input.subleasePayeeName !== undefined)
    row.sublease_payee_name = input.subleasePayeeName ?? null;
  if (input.internalNotes !== undefined)
    row.internal_notes = input.internalNotes ?? null;
  if (input.engineOil !== undefined) row.engine_oil = input.engineOil ?? null;
  if (input.tireInfo !== undefined) row.tire_info = input.tireInfo ?? null;
  if (input.currentMileage !== undefined)
    row.current_mileage = input.currentMileage ?? null;
  if (input.status !== undefined) row.status = input.status;
  if (input.publishedOnWeb !== undefined)
    row.published_on_web = input.publishedOnWeb;
  return row;
}

export function mapQuoteRow(row: QuoteRow): Quote {
  const language = row.language === "es" ? "es" : "en";
  return {
    id: row.id,
    code: row.code,
    customer_id: row.customer_id,
    vehicle_id: row.vehicle_id,
    vehicle_type_id: row.vehicle_type_id ?? null,
    web_request_id: row.web_request_id,
    status: row.status,
    language,
    start_at: row.start_at,
    end_at: row.end_at,
    rental_days: row.days,
    daily_rate: row.daily_rate,
    subtotal: row.subtotal,
    insurance_amount: row.insurance,
    deposit_amount: row.deposit,
    delivery_fee: row.delivery_fee,
    pickup_fee: row.pickup_fee,
    discount_amount: row.discount,
    discount_percent: Number(row.discount_percent ?? 0),
    other_charges: row.other_charges,
    tax_rate: Number(row.tax_rate ?? 0),
    tax_amount: row.tax,
    total: row.total,
    notes: row.notes,
    terms: row.terms,
    valid_until: row.valid_until,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapReservationRow(row: ReservationRow): Reservation {
  return {
    id: row.id,
    code: row.code,
    customer_id: row.customer_id,
    vehicle_id: row.vehicle_id,
    quote_id: row.quote_id,
    status: row.status,
    start_at: row.start_at,
    end_at: row.end_at,
    pickup_location: row.pickup_location,
    return_location: row.return_location,
    vehicle_type: row.vehicle_type ?? null,
    agreed_rate: row.agreed_rate,
    deposit: row.deposit,
    insurance: row.insurance,
    total: row.total,
    cash_amount: Number(row.cash_amount ?? 0),
    card_amount: Number(row.card_amount ?? 0),
    additional_costs: Number(row.additional_costs ?? 0),
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapWebRequestRow(row: WebRequestRow): WebRequest {
  return {
    id: row.id,
    code: row.code,
    source: row.source,
    status: row.status,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    email: row.email,
    pickup_date: row.pickup_date,
    pickup_time: row.pickup_time ?? "00:00",
    return_date: row.return_date,
    return_time: row.return_time ?? "00:00",
    vehicle_id: row.vehicle_id,
    vehicle_category: row.vehicle_category,
    pickup_location: row.pickup_location,
    return_location: row.return_location,
    notes: row.notes,
    customer_id: row.customer_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapVehicleImageRow(row: {
  id: string;
  vehicle_id: string;
  url: string;
  public_id: string;
  position: number;
  is_primary: boolean;
  view?: VehicleImage["view"] | null;
  created_at: string;
}): VehicleImage {
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    url: row.url,
    public_id: row.public_id,
    position: row.position,
    is_primary: row.is_primary,
    view: row.view ?? null,
    created_at: row.created_at,
  };
}

type ContractRow = {
  id: string;
  code: string;
  reservation_id: string;
  customer_id: string;
  vehicle_id: string;
  status: Contract["status"];
  start_at: string;
  end_at: string;
  agreed_rate: number;
  deposit: number;
  insurance: number;
  total: number;
  terms: string | null;
  clauses: string | null;
  notes: string | null;
  pdf_path: string | null;
  billed_days?: number | null;
  subtotal?: number | null;
  extra_charges?: number | null;
  damage_charges?: number | null;
  fuel_charges?: number | null;
  amount_paid?: number | null;
  balance_due?: number | null;
  complementary_amount?: number | null;
  payment_status?: Contract["payment_status"] | null;
  closed_at?: string | null;
  delivered_by_name?: string | null;
  received_by_name?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

type ContractSignatureRow = {
  id: string;
  contract_id: string;
  signer_type: ContractSignature["signer_type"];
  signed_by_name: string;
  signed_by_user_id: string | null;
  signature_path: string;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
};

type InspectionRow = {
  id: string;
  code: string;
  reservation_id: string;
  vehicle_id: string;
  customer_id: string;
  type: Inspection["type"];
  inspection_date: string;
  mileage: number | null;
  fuel_level: Inspection["fuel_level"];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function mapContractRow(row: ContractRow): Contract {
  return {
    id: row.id,
    code: row.code,
    reservation_id: row.reservation_id,
    customer_id: row.customer_id,
    vehicle_id: row.vehicle_id,
    status: row.status,
    start_at: row.start_at,
    end_at: row.end_at,
    agreed_rate: row.agreed_rate,
    deposit: row.deposit,
    insurance: row.insurance,
    total: row.total,
    terms: row.terms,
    clauses: row.clauses,
    notes: row.notes,
    pdf_path: row.pdf_path,
    billed_days: row.billed_days ?? null,
    subtotal: Number(row.subtotal ?? 0),
    extra_charges: Number(row.extra_charges ?? 0),
    damage_charges: Number(row.damage_charges ?? 0),
    fuel_charges: Number(row.fuel_charges ?? 0),
    amount_paid: Number(row.amount_paid ?? 0),
    balance_due: Number(row.balance_due ?? 0),
    complementary_amount: Number(row.complementary_amount ?? 0),
    payment_status: row.payment_status ?? "PENDING",
    closed_at: row.closed_at ?? null,
    delivered_by_name: row.delivered_by_name ?? null,
    received_by_name: row.received_by_name ?? null,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapContractSignatureRow(
  row: ContractSignatureRow,
): ContractSignature {
  return {
    id: row.id,
    contract_id: row.contract_id,
    signer_type: row.signer_type,
    signed_by_name: row.signed_by_name,
    signed_by_user_id: row.signed_by_user_id,
    signature_path: row.signature_path,
    signed_at: row.signed_at,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
  };
}

export function mapInspectionRow(row: InspectionRow): Inspection {
  return {
    id: row.id,
    code: row.code,
    reservation_id: row.reservation_id,
    vehicle_id: row.vehicle_id,
    customer_id: row.customer_id,
    type: row.type,
    inspection_date: row.inspection_date,
    mileage: row.mileage,
    fuel_level: row.fuel_level,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapInspectionChecklistRow(row: {
  id: string;
  inspection_id: string;
  item_name: string;
  status: InspectionChecklistItem["status"];
  notes: string | null;
  sort_order: number;
}): InspectionChecklistItem {
  return {
    id: row.id,
    inspection_id: row.inspection_id,
    item_name: row.item_name,
    status: row.status,
    notes: row.notes,
    sort_order: row.sort_order,
  };
}

export function mapInspectionDamageRow(row: {
  id: string;
  inspection_id: string;
  view: InspectionDamageMark["view"];
  x: number;
  y: number;
  damage_type: InspectionDamageMark["damage_type"];
  severity: InspectionDamageMark["severity"];
  description: string | null;
  photo_id: string | null;
  mark_number: number;
  created_at: string;
}): InspectionDamageMark {
  return {
    id: row.id,
    inspection_id: row.inspection_id,
    view: row.view,
    x: Number(row.x),
    y: Number(row.y),
    damage_type: row.damage_type,
    severity: row.severity,
    description: row.description,
    photo_id: row.photo_id,
    mark_number: row.mark_number,
    created_at: row.created_at,
  };
}

export function mapInspectionPhotoRow(row: {
  id: string;
  inspection_id: string;
  category: InspectionPhoto["category"];
  storage_path: string;
  file_name: string | null;
  caption: string | null;
  created_at: string;
}): InspectionPhoto {
  return {
    id: row.id,
    inspection_id: row.inspection_id,
    category: row.category,
    storage_path: row.storage_path,
    file_name: row.file_name,
    caption: row.caption,
    created_at: row.created_at,
  };
}

export type {
  CustomerRow,
  VehicleRow,
  QuoteRow,
  ReservationRow,
  WebRequestRow,
  ContractRow,
  ContractSignatureRow,
  InspectionRow,
};
