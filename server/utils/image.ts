export const ALLOWED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg"] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export function isAllowedImageMimeType(value: string): value is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME_TYPES.some((mime) => mime === value);
}
