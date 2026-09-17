/** Plan Free/Hobby limits (authoritative for capacity UI). */
export const CAPACITY_LIMITS = {
  supabaseDbMb: 500,
  supabaseStorageGb: 1,
  supabaseEgressGb: 5,
  b2StorageGb: 10,
  b2EgressMultiplier: 3,
  vercelTransferGb: 100,
  vercelOriginGb: 10,
  vercelEdgeRequests: 1_000_000,
  cloudinaryCredits: 25,
  resendDay: 100,
  resendMonth: 3_000,
  inspectionRetentionDays: 90,
} as const;

/** Heuristics for projections (photos compressed ~900KB). */
export const CAPACITY_HEURISTICS = {
  dbMbPerRental: 0.15,
  b2MbPerRental: 12,
  emailsPerRental: 1.2,
} as const;

export type CapacityPlatformStatus =
  | "ok"
  | "warn"
  | "critical"
  | "unknown"
  | "not_configured";

export type CapacityMeter = {
  id: string;
  label: string;
  platform: string;
  used: number;
  limit: number;
  unit: string;
  pct: number | null;
  status: CapacityPlatformStatus;
  period: "cumulative" | "monthly" | "daily" | "info";
  detail: string;
  source: "live" | "estimated" | "plan" | "config";
};

export type CapacitySnapshot = {
  measuredAt: string;
  meters: CapacityMeter[];
  counts: Record<string, number>;
  tables: Array<{ name: string; mb: number }>;
  b2: {
    configured: boolean;
    objects: number;
    bytes: number;
    mb: number;
    byPrefix: Array<{ prefix: string; objects: number; mb: number }>;
    error?: string;
  };
  supabase: {
    dbMb: number | null;
    dbBytes: number | null;
    error?: string;
  };
  cloudinary: {
    configured: boolean;
    creditsUsed: number | null;
    creditsLimit: number;
    storageMb: number | null;
    bandwidthMb: number | null;
    transformations: number | null;
    error?: string;
  };
  services: {
    supabase: boolean;
    b2: boolean;
    cloudinary: boolean;
    resend: boolean;
    cron: boolean;
  };
  capacity: {
    rentalsLeftInDb: number | null;
    rentalsLeftInB2: number | null;
    maxRentalsPerMonthB2Steady: number | null;
    totalRentalsDbSupports: number;
    totalRentalsB2SupportsNoPurge: number;
  };
};
