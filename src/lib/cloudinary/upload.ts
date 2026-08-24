import { v2 as cloudinary } from "cloudinary";

import { env, isCloudinaryConfigured } from "@/lib/env";

export type CloudinaryErrorResult = {
  ok: false;
  message: string;
};

export type SignedUploadParamsResult =
  | {
      ok: true;
      cloudName: string;
      apiKey: string;
      timestamp: number;
      folder: string;
      signature: string;
      uploadPreset?: string;
    }
  | CloudinaryErrorResult;

export type UploadFromBufferResult =
  | {
      ok: true;
      url: string;
      publicId: string;
      secureUrl: string;
    }
  | CloudinaryErrorResult;

function configureCloudinary(): boolean {
  if (!isCloudinaryConfigured()) {
    return false;
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return true;
}

export function getSignedUploadParams(
  folder: string = "rent-a-car-pro/vehicles",
): SignedUploadParamsResult {
  if (!isCloudinaryConfigured()) {
    return {
      ok: false,
      message: "Cloudinary no está configurado.",
    };
  }

  configureCloudinary();

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    env.CLOUDINARY_API_SECRET!,
  );

  return {
    ok: true,
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    apiKey: env.CLOUDINARY_API_KEY!,
    timestamp,
    folder,
    signature,
  };
}

export async function uploadImageFromBuffer(
  buffer: Buffer,
  options?: {
    folder?: string;
    publicId?: string;
    tags?: string[];
  },
): Promise<UploadFromBufferResult> {
  if (!isCloudinaryConfigured()) {
    return {
      ok: false,
      message: "Cloudinary no está configurado.",
    };
  }

  configureCloudinary();

  try {
    const result = await new Promise<{
      secure_url: string;
      public_id: string;
      url: string;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options?.folder ?? "rent-a-car-pro/vehicles",
          public_id: options?.publicId,
          tags: options?.tags,
          resource_type: "image",
        },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error ?? new Error("Upload failed"));
            return;
          }
          resolve(uploadResult);
        },
      );

      uploadStream.end(buffer);
    });

    return {
      ok: true,
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo subir la imagen a Cloudinary.";
    return { ok: false, message };
  }
}

export async function deleteCloudinaryAsset(
  publicId: string,
): Promise<{ ok: true } | CloudinaryErrorResult> {
  if (!isCloudinaryConfigured()) {
    return {
      ok: false,
      message: "Cloudinary no está configurado.",
    };
  }

  configureCloudinary();

  try {
    await cloudinary.uploader.destroy(publicId);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo eliminar la imagen de Cloudinary.";
    return { ok: false, message };
  }
}
