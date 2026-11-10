export const ALLOWED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg"] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

export function isAllowedImageMimeType(value: string): value is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME_TYPES.some((mime) => mime === value);
}

export function sniffImageMimeType(buffer: Buffer): AllowedImageMimeType | null {
  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "image/png";
  }

  if (buffer.length >= JPEG_SIGNATURE.length && buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) {
    return "image/jpeg";
  }

  return null;
}

export function extensionForMimeType(mimeType: AllowedImageMimeType): "png" | "jpg" {
  return mimeType === "image/png" ? "png" : "jpg";
}
