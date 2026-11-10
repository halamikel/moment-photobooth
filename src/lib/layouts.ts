import type { LayoutId } from "../../shared/contracts";

export interface PhotoSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutSpec {
  id: LayoutId;
  width: number;
  height: number;
  frameCount: number;
  photoAspect: number;
  slots: PhotoSlot[];
  slotRadius: number;
  previewWidth: number;
}

const CLASSIC_SLOT_WIDTH = 720;
const CLASSIC_SLOT_HEIGHT = 480;
const CLASSIC_X = 90;
const CLASSIC_GAP = 28;
const CLASSIC_START_Y = 170;

const classicSlots: PhotoSlot[] = Array.from({ length: 4 }, (_, index) => ({
  x: CLASSIC_X,
  y: CLASSIC_START_Y + index * (CLASSIC_SLOT_HEIGHT + CLASSIC_GAP),
  width: CLASSIC_SLOT_WIDTH,
  height: CLASSIC_SLOT_HEIGHT,
}));

const GRID_SIZE = 588;
const GRID_X = 80;
const GRID_Y = 150;
const GRID_GAP = 24;

const gridSlots: PhotoSlot[] = [
  { x: GRID_X, y: GRID_Y, width: GRID_SIZE, height: GRID_SIZE },
  { x: GRID_X + GRID_SIZE + GRID_GAP, y: GRID_Y, width: GRID_SIZE, height: GRID_SIZE },
  {
    x: GRID_X,
    y: GRID_Y + GRID_SIZE + GRID_GAP,
    width: GRID_SIZE,
    height: GRID_SIZE,
  },
  {
    x: GRID_X + GRID_SIZE + GRID_GAP,
    y: GRID_Y + GRID_SIZE + GRID_GAP,
    width: GRID_SIZE,
    height: GRID_SIZE,
  },
];

export const LAYOUTS: Record<LayoutId, LayoutSpec> = {
  classic: {
    id: "classic",
    width: 900,
    height: 2344,
    frameCount: 4,
    photoAspect: CLASSIC_SLOT_WIDTH / CLASSIC_SLOT_HEIGHT,
    slots: classicSlots,
    slotRadius: 16,
    previewWidth: 290,
  },
  grid: {
    id: "grid",
    width: 1360,
    height: 1500,
    frameCount: 4,
    photoAspect: 1,
    slots: gridSlots,
    slotRadius: 18,
    previewWidth: 480,
  },
  postcard: {
    id: "postcard",
    width: 1600,
    height: 1200,
    frameCount: 1,
    photoAspect: 1.6,
    slots: [{ x: 80, y: 120, width: 1440, height: 900 }],
    slotRadius: 10,
    previewWidth: 620,
  },
};

export function layoutFor(id: LayoutId): LayoutSpec {
  return LAYOUTS[id];
}
