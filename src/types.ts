import type {
  FrameId,
  LayoutId,
  MediaSummary,
  SessionSummary,
  TimerSeconds,
} from "../shared/contracts";
import type { FilterId } from "./lib/filters";

export interface BoothConfig {
  layout: LayoutId;
  timer: TimerSeconds;
  frame: FrameId;
  caption: string;
  showDate: boolean;
}

export interface PhotoAdjustments {
  brightness: number;
  contrast: number;
}

export interface PlacedSticker {
  id: string;
  definitionId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
}

export interface CompositionSettings {
  filterId: FilterId;
  adjustments: PhotoAdjustments;
  stickers: PlacedSticker[];
  caption: string;
  showDate: boolean;
  frame: FrameId;
}

export interface PublishedBooth {
  session: SessionSummary;
  accessToken: string;
  media: MediaSummary[];
  stripDataUrl: string;
}

export type BoothScreen = "home" | "capture" | "decorate" | "result";
