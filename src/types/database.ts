export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type WebRequestStatus =
  | "PENDING"
  | "CONTACTED"
  | "QUOTED"
  | "CONVERTED"
  | "REJECTED"
  | "CANCELLED";

export type WebRequestSource = "WEBSITE" | "PHONE" | "WHATSAPP" | "OTHER";

export type CustomerStatus = "ACTIVE" | "INACTIVE";

export type CustomerType = "PERSON" | "COMPANY";

export type VehicleOwnershipType =
  | "OWN"
  | "THIRD_PARTY"
  | "SUBLEASED"
  | "CONSIGNMENT";

export type VehicleStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "RENTED"
  | "MAINTENANCE"
  | "UNAVAILABLE"
  | "ARCHIVED";

export type QuoteStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export type ReservationStatus =
  | "CONFIRMED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export type ContractStatus =
  | "PENDING"
  | "CLIENT_SIGNED"
  | "REPRESENTATIVE_SIGNED"
  | "COMPLETED"
  | "CANCELLED";

export type InspectionType = "CHECK_OUT" | "CHECK_IN";

export type ChecklistItemStatus =
  | "OK"
  | "DAMAGED"
  | "MISSING"
  | "NOT_APPLICABLE";

export type DamageType =
  | "SCRATCH"
  | "DENT"
  | "CRACK"
  | "PAINT"
  | "BROKEN"
  | "OTHER";

export type DamageSeverity = "LOW" | "MEDIUM" | "HIGH";

export type DamageView = "TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT";

export type FuelLevel =
  | "EMPTY"
  | "ONE_EIGHTH"
  | "QUARTER"
  | "THREE_EIGHTHS"
  | "HALF"
  | "FIVE_EIGHTHS"
  | "THREE_QUARTERS"
  | "SEVEN_EIGHTHS"
  | "FULL";

export type InspectionPhotoCategory =
  | "FRONT"
  | "REAR"
  | "LEFT"
  | "RIGHT"
  | "INTERIOR"
  | "DASHBOARD"
  | "WHEELS"
  | "DAMAGE"
  | "OTHER";

export type IncomeType =
  | "RENTAL"
  | "DEPOSIT"
  | "INSURANCE"
  | "EXTRA"
  | "OTHER";

/** @deprecated Use IncomeType — kept for gradual migration */
export type IncomeCategory = IncomeType;

export type DepositStatus =
  | "RECEIVED"
  | "HELD"
  | "RETURNED"
  | "APPLIED"
  | "PARTIALLY_APPLIED";

export type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";

export type ExpenseCategory =
  | "MAINTENANCE"
  | "FUEL"
  | "INSURANCE"
  | "STAFF"
  | "ADVERTISING"
  | "WASH"
  | "PARTS"
  | "COMMISSIONS"
  | "FINES"
  | "OTHER";

export type MaintenanceType =
  | "OIL"
  | "BRAKES"
  | "TIRES"
  | "ENGINE"
  | "TRANSMISSION"
  | "AC"
  | "ELECTRICAL"
  | "BODY"
  | "GENERAL"
  | "OTHER";

export type MaintenanceStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type SignerType = "CLIENT" | "REPRESENTATIVE";

export type DocumentSequenceType =
  | "WEB_REQUEST"
  | "QUOTE"
  | "RESERVATION"
  | "CONTRACT"
  | "INSPECTION"
  | "RECEIPT";

export type ContractPaymentStatus = "PENDING" | "PARTIAL" | "PAID";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  signature_url?: string | null;
  role_id: string | null;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  key: string;
  module: string;
  description: string | null;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  legal_name: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  currency: string;
  timezone: string;
  quote_terms: string | null;
  contract_terms: string | null;
  default_deposit: number;
  default_insurance: number;
  default_delivery_fee: number;
  policies: Json;
  updated_at: string;
}

export interface WebRequest {
  id: string;
  code: string;
  source: WebRequestSource;
  status: WebRequestStatus;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  vehicle_id: string | null;
  vehicle_category: string | null;
  pickup_location: string | null;
  return_location: string | null;
  notes: string | null;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  customer_type: CustomerType;
  first_name: string;
  last_name: string;
  company_name: string | null;
  nit: string | null;
  nrc: string | null;
  contact_person: string | null;
  identification: string | null;
  dui: string | null;
  passport: string | null;
  license_number: string | null;
  license_expiry: string | null;
  /** DB column: date_of_birth */
  date_of_birth: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  country: string | null;
  additional_driver_name: string | null;
  additional_driver_license: string | null;
  document_image_url: string | null;
  license_image_url: string | null;
  receiver_name: string | null;
  deliverer_name: string | null;
  notes: string | null;
  status: CustomerStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentReceipt {
  id: string;
  code: string;
  customer_id: string;
  contract_id: string | null;
  reservation_id: string | null;
  income_id: string | null;
  amount: number;
  payment_method: PaymentMethod;
  concept: string;
  balance_remaining: number;
  receipt_kind?: "PAYMENT" | "REFUND";
  notes: string | null;
  pdf_path: string | null;
  issued_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Vehicle {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  vin: string | null;
  chassis: string | null;
  engine: string | null;
  color: string | null;
  transmission: string | null;
  fuel_type: string | null;
  passengers: number | null;
  doors: number | null;
  luggage: number | null;
  air_conditioning: boolean;
  category: string | null;
  vehicle_type_id: string | null;
  ownership_type: VehicleOwnershipType;
  daily_rate: number;
  weekly_rate: number | null;
  deposit: number;
  public_description: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  sublease_daily_cost?: number | null;
  sublease_payee_name?: string | null;
  internal_notes: string | null;
  engine_oil: string | null;
  tire_info: string | null;
  current_mileage: number | null;
  status: VehicleStatus;
  published_on_web: boolean;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Landing / catalog vehicle type (rates + capacity, not a unit). */
export interface VehicleType {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  daily_rate: number;
  weekly_rate: number | null;
  passengers: number;
  luggage: number;
  doors: number;
  air_conditioning: boolean;
  transmission: string;
  features: string[];
  image_url: string | null;
  sort_order: number;
  published_on_web: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AccessoryCatalogItem {
  id: string;
  code: string;
  name_es: string;
  name_en: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type MileageHistorySource =
  | "MANUAL"
  | "CHECK_OUT"
  | "CHECK_IN"
  | "MAINTENANCE"
  | "OTHER";

export interface VehicleMileageHistory {
  id: string;
  vehicle_id: string;
  mileage: number;
  recorded_at: string;
  source: MileageHistorySource;
  inspection_id: string | null;
  contract_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VehicleImage {
  id: string;
  vehicle_id: string;
  url: string;
  public_id: string;
  position: number;
  is_primary: boolean;
  /** Cara del vehículo para contratos / mapa de daños. */
  view: DamageView | null;
  created_at: string;
}

export interface Quote {
  id: string;
  code: string;
  customer_id: string;
  /** Optional unit link — quotes may use catalog / custom lines only (RN-02). */
  vehicle_id: string | null;
  web_request_id: string | null;
  status: QuoteStatus;
  language: "es" | "en";
  start_at: string;
  end_at: string;
  rental_days: number;
  daily_rate: number;
  subtotal: number;
  insurance_amount: number;
  deposit_amount: number;
  delivery_fee: number;
  pickup_fee: number;
  discount_amount: number;
  /** Stored as percent 0–100 */
  discount_percent: number;
  other_charges: number;
  /** Stored as fraction 0–1 in DB; exposed as fraction here */
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  code: string;
  customer_id: string;
  vehicle_id: string;
  quote_id: string | null;
  status: ReservationStatus;
  start_at: string;
  end_at: string;
  pickup_location: string | null;
  return_location: string | null;
  /** Tipo/categoría comercial (texto libre o del vehículo). */
  vehicle_type: string | null;
  agreed_rate: number;
  deposit: number;
  insurance: number;
  total: number;
  /** Monto acordado en efectivo. */
  cash_amount: number;
  /** Monto correspondiente al pago con tarjeta. */
  card_amount: number;
  /** Costos o información adicional (monto). */
  additional_costs: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  code: string;
  reservation_id: string;
  customer_id: string;
  vehicle_id: string;
  status: ContractStatus;
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
  /** Spec §11.6 billing fields (present after v1.1 migration). */
  billed_days?: number | null;
  subtotal?: number;
  extra_charges?: number;
  damage_charges?: number;
  fuel_charges?: number;
  amount_paid?: number;
  balance_due?: number;
  complementary_amount?: number;
  payment_status?: ContractPaymentStatus;
  closed_at?: string | null;
  delivered_by_name?: string | null;
  received_by_name?: string | null;
  courtesy_hours?: number;
  courtesy_days?: number;
  actual_return_at?: string | null;
  grace_extra_days_waived?: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractSignature {
  id: string;
  contract_id: string;
  signer_type: SignerType;
  signed_by_name: string;
  signed_by_user_id: string | null;
  signature_path: string;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface Inspection {
  id: string;
  code: string;
  reservation_id: string;
  vehicle_id: string;
  customer_id: string;
  type: InspectionType;
  inspection_date: string;
  mileage: number | null;
  fuel_level: FuelLevel | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionChecklistItem {
  id: string;
  inspection_id: string;
  item_name: string;
  status: ChecklistItemStatus;
  notes: string | null;
  sort_order: number;
}

export interface InspectionDamageMark {
  id: string;
  inspection_id: string;
  view: DamageView;
  x: number;
  y: number;
  damage_type: DamageType;
  severity: DamageSeverity;
  description: string | null;
  photo_id: string | null;
  mark_number: number;
  created_at: string;
}

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  category: InspectionPhotoCategory;
  storage_path: string;
  file_name: string | null;
  caption: string | null;
  created_at: string;
}

export interface IncomeTransaction {
  id: string;
  type: IncomeType;
  amount: number;
  transaction_date: string;
  vehicle_id: string | null;
  reservation_id: string | null;
  contract_id: string | null;
  customer_id: string | null;
  payment_method: PaymentMethod;
  deposit_status: DepositStatus | null;
  reference: string | null;
  notes: string | null;
  /** Linked electronic payment receipt (abono), if any. */
  receipt_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExpenseTransaction {
  id: string;
  concept: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  vehicle_id: string | null;
  provider: string | null;
  receipt_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  type: MaintenanceType;
  description: string;
  maintenance_date: string;
  mileage: number | null;
  cost: number;
  workshop: string | null;
  next_date: string | null;
  next_mileage: number | null;
  status: MaintenanceStatus;
  receipt_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  alert_type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  severity: string;
  dedupe_key: string | null;
  is_active: boolean;
  is_read: boolean;
  due_at: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> &
          Pick<Profile, "id" | "first_name" | "last_name" | "email">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      roles: {
        Row: Role;
        Insert: Partial<Role> & Pick<Role, "name" | "slug">;
        Update: Partial<Role>;
        Relationships: [];
      };
      permissions: {
        Row: Permission;
        Insert: Partial<Permission> &
          Pick<Permission, "key" | "module">;
        Update: Partial<Permission>;
        Relationships: [];
      };
      role_permissions: {
        Row: { role_id: string; permission_id: string };
        Insert: { role_id: string; permission_id: string };
        Update: Partial<{ role_id: string; permission_id: string }>;
        Relationships: [];
      };
      user_permission_overrides: {
        Row: { user_id: string; permission_id: string; granted: boolean };
        Insert: {
          user_id: string;
          permission_id: string;
          granted: boolean;
        };
        Update: Partial<{
          user_id: string;
          permission_id: string;
          granted: boolean;
        }>;
        Relationships: [];
      };
      business_settings: {
        Row: BusinessSettings;
        Insert: Partial<BusinessSettings>;
        Update: Partial<BusinessSettings>;
        Relationships: [];
      };
      web_requests: {
        Row: WebRequest;
        Insert: Partial<WebRequest> &
          Pick<
            WebRequest,
            | "first_name"
            | "last_name"
            | "phone"
            | "pickup_date"
            | "pickup_time"
            | "return_date"
            | "return_time"
          >;
        Update: Partial<WebRequest>;
        Relationships: [];
      };
      customers: {
        Row: Customer;
        Insert: Partial<Customer> &
          Pick<Customer, "first_name" | "last_name" | "phone">;
        Update: Partial<Customer>;
        Relationships: [];
      };
      vehicles: {
        Row: Vehicle;
        Insert: Partial<Vehicle> &
          Pick<
            Vehicle,
            | "slug"
            | "brand"
            | "model"
            | "year"
            | "plate"
            | "daily_rate"
            | "deposit"
          >;
        Update: Partial<Vehicle>;
        Relationships: [];
      };
      vehicle_types: {
        Row: VehicleType;
        Insert: Partial<VehicleType> &
          Pick<VehicleType, "slug" | "name" | "daily_rate">;
        Update: Partial<VehicleType>;
        Relationships: [];
      };
      accessory_catalog: {
        Row: AccessoryCatalogItem;
        Insert: Partial<AccessoryCatalogItem> &
          Pick<AccessoryCatalogItem, "code" | "name_es">;
        Update: Partial<AccessoryCatalogItem>;
        Relationships: [];
      };
      vehicle_mileage_history: {
        Row: VehicleMileageHistory;
        Insert: Partial<VehicleMileageHistory> &
          Pick<VehicleMileageHistory, "vehicle_id" | "mileage">;
        Update: Partial<VehicleMileageHistory>;
        Relationships: [];
      };
      vehicle_images: {
        Row: VehicleImage;
        Insert: Partial<VehicleImage> &
          Pick<VehicleImage, "vehicle_id" | "url" | "public_id">;
        Update: Partial<VehicleImage>;
        Relationships: [];
      };
      quotes: {
        Row: Quote;
        Insert: Partial<Quote> &
          Pick<Quote, "customer_id" | "start_at" | "end_at" | "total">;
        Update: Partial<Quote>;
        Relationships: [];
      };
      reservations: {
        Row: Reservation;
        Insert: Partial<Reservation> &
          Pick<
            Reservation,
            | "customer_id"
            | "vehicle_id"
            | "start_at"
            | "end_at"
            | "agreed_rate"
            | "total"
          >;
        Update: Partial<Reservation>;
        Relationships: [];
      };
      contracts: {
        Row: Contract;
        Insert: Partial<Contract> &
          Pick<
            Contract,
            | "reservation_id"
            | "customer_id"
            | "vehicle_id"
            | "start_at"
            | "end_at"
            | "total"
          >;
        Update: Partial<Contract>;
        Relationships: [];
      };
      contract_signatures: {
        Row: ContractSignature;
        Insert: Partial<ContractSignature> &
          Pick<
            ContractSignature,
            | "contract_id"
            | "signer_type"
            | "signed_by_name"
            | "signature_path"
          >;
        Update: Partial<ContractSignature>;
        Relationships: [];
      };
      inspections: {
        Row: Inspection;
        Insert: Partial<Inspection> &
          Pick<
            Inspection,
            "reservation_id" | "vehicle_id" | "customer_id" | "type"
          >;
        Update: Partial<Inspection>;
        Relationships: [];
      };
      income_transactions: {
        Row: IncomeTransaction;
        Insert: Partial<IncomeTransaction> &
          Pick<IncomeTransaction, "type" | "amount" | "transaction_date">;
        Update: Partial<IncomeTransaction>;
        Relationships: [];
      };
      payment_receipts: {
        Row: PaymentReceipt;
        Insert: Partial<PaymentReceipt> &
          Pick<PaymentReceipt, "customer_id" | "amount">;
        Update: Partial<PaymentReceipt>;
        Relationships: [];
      };
      expense_transactions: {
        Row: ExpenseTransaction;
        Insert: Partial<ExpenseTransaction> &
          Pick<
            ExpenseTransaction,
            "concept" | "category" | "amount" | "expense_date"
          >;
        Update: Partial<ExpenseTransaction>;
        Relationships: [];
      };
      maintenance_records: {
        Row: MaintenanceRecord;
        Insert: Partial<MaintenanceRecord> &
          Pick<
            MaintenanceRecord,
            "vehicle_id" | "type" | "description" | "maintenance_date" | "cost"
          >;
        Update: Partial<MaintenanceRecord>;
        Relationships: [];
      };
      alerts: {
        Row: Alert;
        Insert: Partial<Alert> & Pick<Alert, "alert_type" | "title">;
        Update: Partial<Alert>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<AuditLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_permission: {
        Args: { p_user_id: string; p_permission_key: string };
        Returns: boolean;
      };
      get_user_permissions: {
        Args: { p_user_id: string };
        Returns: string[];
      };
      next_document_code: {
        Args: { p_sequence_type: DocumentSequenceType };
        Returns: string;
      };
    };
  };
};
