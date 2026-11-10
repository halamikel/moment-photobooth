export const LAYOUT_IDS = ["classic", "grid", "postcard"] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const FRAME_IDS = [
  "cream",
  "blush",
  "noir",
  "porcelain",
  "sky",
  "lilac",
  "sunset",
] as const;
export type FrameId = (typeof FRAME_IDS)[number];

export const TIMER_OPTIONS = [3, 5, 10] as const;
export type TimerSeconds = (typeof TIMER_OPTIONS)[number];

export const FRAME_COUNTS: Record<LayoutId, number> = {
  classic: 4,
  grid: 4,
  postcard: 1,
};

export const LAYOUT_LABELS: Record<LayoutId, string> = {
  classic: "Classic 4-cut",
  grid: "2 × 2 grid",
  postcard: "Studio postcard",
};

export const LAYOUT_KOREAN_LABELS: Record<LayoutId, string> = {
  classic: "네컷",
  grid: "네컷 그리드",
  postcard: "스튜디오 엽서",
};

export const FRAME_LABELS: Record<FrameId, string> = {
  cream: "Butter cream",
  blush: "Peach blush",
  noir: "Midnight noir",
  porcelain: "Porcelain white",
  sky: "Powder sky",
  lilac: "Soft lilac",
  sunset: "Peach sunset",
};

export const MEDIA_KINDS = ["frame", "strip"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface SessionConfig {
  layout: LayoutId;
  frame: FrameId;
  caption: string;
}

export interface SessionSummary {
  id: number;
  layout: LayoutId;
  frame: FrameId;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  finalizedAt: string | null;
}

export interface MediaSummary {
  id: number;
  kind: MediaKind;
  position: number;
  url: string;
  downloadUrl: string;
}

export interface CreateSessionResponse {
  session: SessionSummary;
  accessToken: string;
}

export interface SessionResponse {
  session: SessionSummary;
  media: MediaSummary[];
}

export interface FinalizeResponse extends SessionResponse {
  message: string;
}

export interface CreateShareResponse {
  token: string;
  expiresAt: string;
  path: string;
}

export interface ShareResponse {
  layout: LayoutId;
  frame: FrameId;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  media: MediaSummary[];
}

export interface ApiErrorBody {
  error: string;
  details?: Record<string, string[]>;
}
