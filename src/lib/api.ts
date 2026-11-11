import { upload } from "@vercel/blob/client";
import type {
  ApiErrorBody,
  CreateSessionResponse,
  CreateShareResponse,
  FinalizeResponse,
  ShareResponse,
} from "../../shared/contracts";
import type { BoothConfig } from "../types";

export class ApiError extends Error {
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(status: number, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body: unknown = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      errorBody?.error ?? "Something went wrong. Please try again.",
      errorBody?.details,
    );
  }

  return body as T;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(path, {
      ...options,
      credentials: "omit",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });
    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "The request timed out. Please try again.");
    }
    throw new ApiError(0, "The booth could not reach the server. Please try again.");
  } finally {
    window.clearTimeout(timeout);
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match || !match[1] || !match[2]) {
    throw new ApiError(400, "A captured image could not be prepared for upload.");
  }

  const mimeType = match[1];
  const binary = window.atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function fileExtensionForMime(mimeType: string): string {
  return mimeType === "image/jpeg" ? "jpg" : "png";
}

export async function createSession(config: BoothConfig): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      layout: config.layout,
      frame: config.frame,
      caption: config.caption.trim(),
    }),
  });
}

async function uploadImage(
  sessionId: number,
  accessToken: string,
  blob: Blob,
): Promise<string> {
  const extension = fileExtensionForMime(blob.type);
  const pathname = `media/${sessionId}/${crypto.randomUUID()}.${extension}`;

  try {
    const result = await upload(pathname, blob, {
      access: "private",
      handleUploadUrl: "/api/blob-upload",
      headers: { Authorization: `Bearer ${accessToken}` },
      contentType: blob.type,
    });
    return result.pathname;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "A captured image could not be uploaded. Please try again.");
  }
}

export async function finalizeSession(
  sessionId: number,
  accessToken: string,
  stripDataUrl: string,
  frames: string[],
): Promise<FinalizeResponse> {
  const strip = await uploadImage(sessionId, accessToken, dataUrlToBlob(stripDataUrl));

  const frameKeys: string[] = [];
  for (const frame of frames) {
    frameKeys.push(await uploadImage(sessionId, accessToken, dataUrlToBlob(frame)));
  }

  return request<FinalizeResponse>(
    `/api/sessions/${sessionId}/finalize`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ strip, frames: frameKeys }),
    },
    60_000,
  );
}

export async function createShare(
  sessionId: number,
  accessToken: string,
): Promise<CreateShareResponse> {
  return request<CreateShareResponse>(`/api/sessions/${sessionId}/share`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getShare(token: string): Promise<ShareResponse> {
  return request<ShareResponse>(`/api/shares/${encodeURIComponent(token)}`);
}
