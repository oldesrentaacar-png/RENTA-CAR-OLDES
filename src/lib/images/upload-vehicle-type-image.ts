"use client";

import { compressImageFile, isBlobFile } from "@/lib/images/compress-image";

type SignedUploadParams = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

/**
 * Compresses locally and uploads straight to Cloudinary (bypasses Vercel body limit).
 */
export async function uploadImageViaSignedCloudinary(
  file: File,
  getParams: () => Promise<
    | { success: true; data: SignedUploadParams }
    | { success: false; error: string }
  >,
): Promise<string> {
  const compressed = await compressImageFile(file, {
    maxWidth: 1600,
    maxHeight: 1600,
    maxBytes: 1_200_000,
  });

  const paramsResult = await getParams();
  if (!paramsResult.success) {
    throw new Error(paramsResult.error);
  }

  const { cloudName, apiKey, timestamp, folder, signature } = paramsResult.data;
  const body = new FormData();
  body.append("file", compressed);
  body.append("api_key", apiKey);
  body.append("timestamp", String(timestamp));
  body.append("signature", signature);
  body.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body },
  );

  const payload = (await response.json().catch(() => null)) as {
    secure_url?: string;
    error?: { message?: string };
  } | null;

  if (!response.ok || !payload?.secure_url) {
    throw new Error(
      payload?.error?.message ||
        "No se pudo subir la imagen a Cloudinary. Intente con una foto más liviana.",
    );
  }

  return payload.secure_url;
}

export async function prepareVehicleTypeImageFormData(
  formData: FormData,
  localFile: File | null,
  getParams: () => Promise<
    | { success: true; data: SignedUploadParams }
    | { success: false; error: string }
  >,
): Promise<void> {
  const fromForm = formData.get("imageFile");
  const file =
    localFile && localFile.size > 0
      ? localFile
      : isBlobFile(fromForm)
        ? fromForm
        : null;

  // Never send the binary through the Server Action (Vercel ~4.5MB limit).
  formData.delete("imageFile");

  if (!file) return;

  const url = await uploadImageViaSignedCloudinary(file, getParams);
  formData.set("imageUrl", url);
  formData.set("imageUrlCleared", "0");
}
