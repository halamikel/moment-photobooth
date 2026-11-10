export const FILTER_IDS = [
  "original",
  "studio-glow",
  "vintage-mono",
  "warm-pastel",
  "bright-pop",
  "film-grain",
] as const;

export type FilterId = (typeof FILTER_IDS)[number];

export interface PhotoFilter {
  id: FilterId;
  label: string;
  description: string;
  brightness: number;
  contrast: number;
  saturate: number;
  sepia: number;
  grayscale: number;
  grain: number;
  glow: number;
}

export const PHOTO_FILTERS: Record<FilterId, PhotoFilter> = {
  original: {
    id: "original",
    label: "True tone",
    description: "Clean and natural",
    brightness: 1,
    contrast: 1,
    saturate: 1,
    sepia: 0,
    grayscale: 0,
    grain: 0,
    glow: 0,
  },
  "studio-glow": {
    id: "studio-glow",
    label: "K-studio glow",
    description: "Soft light, dewy skin",
    brightness: 1.075,
    contrast: 0.94,
    saturate: 1.07,
    sepia: 0.03,
    grayscale: 0,
    grain: 0,
    glow: 0.09,
  },
  "vintage-mono": {
    id: "vintage-mono",
    label: "Vintage mono",
    description: "Editorial black & white",
    brightness: 0.98,
    contrast: 1.14,
    saturate: 0,
    sepia: 0.04,
    grayscale: 1,
    grain: 0.06,
    glow: 0,
  },
  "warm-pastel": {
    id: "warm-pastel",
    label: "Warm pastel",
    description: "Peachy film softness",
    brightness: 1.06,
    contrast: 0.9,
    saturate: 0.88,
    sepia: 0.18,
    grayscale: 0,
    grain: 0.02,
    glow: 0.04,
  },
  "bright-pop": {
    id: "bright-pop",
    label: "Bright pop",
    description: "Crisp K-pop color",
    brightness: 1.1,
    contrast: 1.12,
    saturate: 1.24,
    sepia: 0,
    grayscale: 0,
    grain: 0,
    glow: 0,
  },
  "film-grain": {
    id: "film-grain",
    label: "Film grain",
    description: "Analogue texture",
    brightness: 1.01,
    contrast: 1.04,
    saturate: 0.92,
    sepia: 0.06,
    grayscale: 0,
    grain: 0.13,
    glow: 0,
  },
};

export const FILTER_OPTIONS = FILTER_IDS.map((id) => PHOTO_FILTERS[id]);

export function buildFilterString(
  filterId: FilterId,
  brightness: number,
  contrast: number,
): string {
  const filter = PHOTO_FILTERS[filterId];
  const brightnessFactor = (filter.brightness * brightness) / 100;
  const contrastFactor = (filter.contrast * contrast) / 100;

  return [
    `brightness(${brightnessFactor.toFixed(3)})`,
    `contrast(${contrastFactor.toFixed(3)})`,
    `saturate(${filter.saturate.toFixed(3)})`,
    `sepia(${filter.sepia.toFixed(3)})`,
    `grayscale(${filter.grayscale.toFixed(3)})`,
  ].join(" ");
}
