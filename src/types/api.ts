export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function apiError(
  message: string,
  options?: { code?: string; details?: unknown },
): ApiError {
  return {
    success: false,
    error: {
      message,
      code: options?.code,
      details: options?.details,
    },
  };
}

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** @deprecated Prefer PublicVehicleTypeResponse — public landing shows types + rates only. */
export type PublicVehicleResponse = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  category: string | null;
  transmission: string | null;
  passengers: number | null;
  luggage: number | null;
  airConditioning: boolean;
  dailyRate: number;
  publicDescription: string | null;
  images: Array<{
    url: string;
    isPrimary: boolean;
    position: number;
  }>;
};

/** Public fleet card: vehicle type + commercial rates (no unit inventory). */
export type PublicVehicleTypeResponse = {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  dailyRate: number;
  weeklyRate: number | null;
  passengers: number;
  luggage: number;
  doors: number;
  airConditioning: boolean;
  transmission: string | null;
  features: string[];
  imageUrl: string | null;
  sortOrder: number;
};

export type PublicRequestResponse = {
  requestCode: string;
};
