import type { LayoutId } from "../../shared/contracts";
import type { CompositionSettings } from "../types";
import { buildFilterString, PHOTO_FILTERS } from "./filters";
import { layoutFor, type LayoutSpec, type PhotoSlot } from "./layouts";
import { drawStickers } from "./stickers";
import { themeFor, type FrameTheme } from "./themes";

const imageCache = new Map<string, Promise<HTMLImageElement>>();
let grainTile: HTMLCanvasElement | null = null;

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

function loadImage(source: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(source);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A captured photo could not be loaded."));
    image.src = source;
  });

  imageCache.set(source, promise);
  return promise;
}

function getGrainTile(): HTMLCanvasElement {
  if (grainTile) return grainTile;

  const tile = document.createElement("canvas");
  tile.width = 160;
  tile.height = 160;
  const context = tile.getContext("2d");
  if (!context) return tile;

  const imageData = context.createImageData(tile.width, tile.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const value = 90 + Math.floor(Math.random() * 140);
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
    imageData.data[index + 3] = 70 + Math.floor(Math.random() * 100);
  }
  context.putImageData(imageData, 0, 0);
  grainTile = tile;
  return tile;
}

function fillGrain(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number,
): void {
  if (opacity <= 0) return;
  const pattern = context.createPattern(getGrainTile(), "repeat");
  if (!pattern) return;

  context.save();
  context.globalAlpha = opacity;
  context.globalCompositeOperation = "soft-light";
  context.fillStyle = pattern;
  context.fillRect(x, y, width, height);
  context.restore();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  slot: PhotoSlot,
): void {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const slotRatio = slot.width / slot.height;

  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > slotRatio) {
    sourceWidth = image.naturalHeight * slotRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / slotRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    slot.x,
    slot.y,
    slot.width,
    slot.height,
  );
}

function paintBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: FrameTheme,
): void {
  if (!theme.gradient) {
    context.fillStyle = theme.paper;
    context.fillRect(0, 0, width, height);
    return;
  }

  const radians = (theme.gradient.angle * Math.PI) / 180;
  const distance = Math.max(width, height);
  const startX = width / 2 - (Math.cos(radians) * distance) / 2;
  const startY = height / 2 - (Math.sin(radians) * distance) / 2;
  const endX = width / 2 + (Math.cos(radians) * distance) / 2;
  const endY = height / 2 + (Math.sin(radians) * distance) / 2;
  const gradient = context.createLinearGradient(startX, startY, endX, endY);
  gradient.addColorStop(0, theme.gradient.from);
  gradient.addColorStop(1, theme.gradient.to);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function paintHeader(
  context: CanvasRenderingContext2D,
  layout: LayoutSpec,
  theme: FrameTheme,
  scale: number,
): void {
  const width = layout.width * scale;

  context.textBaseline = "alphabetic";
  context.fillStyle = theme.ink;

  if (layout.id === "classic") {
    context.textAlign = "center";
    context.font = `400 ${52 * scale}px "Instrument Serif", Georgia, serif`;
    context.fillText("MOMENT", width / 2, 74 * scale);

    context.fillStyle = theme.softInk;
    context.font = `500 ${12 * scale}px "Noto Sans KR", "DM Sans", sans-serif`;
    context.fillText("모먼트  ·  KOREAN PHOTO BOOTH", width / 2, 112 * scale);

    context.fillStyle = theme.accent;
    context.font = `400 ${22 * scale}px "DM Sans", sans-serif`;
    context.fillText("✦", width / 2 - 168 * scale, 74 * scale);
    context.fillText("✦", width / 2 + 168 * scale, 74 * scale);
    return;
  }

  if (layout.id === "grid") {
    context.textAlign = "left";
    context.font = `400 ${48 * scale}px "Instrument Serif", Georgia, serif`;
    context.fillText("MOMENT", 80 * scale, 74 * scale);

    context.fillStyle = theme.softInk;
    context.font = `500 ${12 * scale}px "Noto Sans KR", "DM Sans", sans-serif`;
    context.fillText("모먼트  ·  FOUR CUT STUDIO", 82 * scale, 104 * scale);

    context.textAlign = "right";
    context.fillStyle = theme.softInk;
    context.font = `500 ${12 * scale}px "DM Mono", monospace`;
    context.fillText("SEOUL, KR  /  EST. 2026", (layout.width - 80) * scale, 74 * scale);
    return;
  }

  context.textAlign = "left";
  context.font = `400 ${46 * scale}px "Instrument Serif", Georgia, serif`;
  context.fillText("MOMENT", 80 * scale, 76 * scale);

  context.textAlign = "right";
  context.fillStyle = theme.softInk;
  context.font = `500 ${12 * scale}px "DM Mono", monospace`;
  context.fillText("STUDIO POSTCARD  ·  모먼트", (layout.width - 80) * scale, 76 * scale);
}

function paintFooter(
  context: CanvasRenderingContext2D,
  layout: LayoutSpec,
  theme: FrameTheme,
  scale: number,
  caption: string,
  showDate: boolean,
): void {
  const width = layout.width * scale;
  const now = new Date();
  const dateLabel = `${MONTHS[now.getMonth()]} ${String(now.getDate()).padStart(2, "0")} ${now.getFullYear()}`;
  const captionLabel = caption.trim();

  context.strokeStyle = theme.line;
  context.lineWidth = Math.max(1, 1.5 * scale);
  context.textBaseline = "alphabetic";

  if (layout.id === "classic") {
    context.beginPath();
    context.moveTo(90 * scale, 2212 * scale);
    context.lineTo(width - 90 * scale, 2212 * scale);
    context.stroke();

    context.textAlign = "center";
    if (showDate) {
      context.fillStyle = theme.softInk;
      context.font = `500 ${13 * scale}px "DM Mono", monospace`;
      context.fillText(dateLabel, width / 2, 2254 * scale);
    }
    if (captionLabel) {
      context.fillStyle = theme.ink;
      context.font = `italic 400 ${21 * scale}px "Instrument Serif", Georgia, serif`;
      context.fillText(captionLabel, width / 2, 2294 * scale);
    }
    return;
  }

  if (layout.id === "grid") {
    context.beginPath();
    context.moveTo(80 * scale, 1374 * scale);
    context.lineTo(width - 80 * scale, 1374 * scale);
    context.stroke();

    context.textAlign = "left";
    if (showDate) {
      context.fillStyle = theme.softInk;
      context.font = `500 ${13 * scale}px "DM Mono", monospace`;
      context.fillText(dateLabel, 80 * scale, 1416 * scale);
    }
    if (captionLabel) {
      context.fillStyle = theme.ink;
      context.font = `italic 400 ${22 * scale}px "Instrument Serif", Georgia, serif`;
      context.fillText(captionLabel, 80 * scale, 1448 * scale);
    }

    context.textAlign = "right";
    context.fillStyle = theme.accent;
    context.font = `400 ${18 * scale}px "DM Sans", sans-serif`;
    context.fillText("✦", (layout.width - 82) * scale, 1420 * scale);
    return;
  }

  context.beginPath();
  context.moveTo(80 * scale, 1056 * scale);
  context.lineTo(width - 80 * scale, 1056 * scale);
  context.stroke();

  context.textAlign = "left";
  if (showDate) {
    context.fillStyle = theme.softInk;
    context.font = `500 ${13 * scale}px "DM Mono", monospace`;
    context.fillText(dateLabel, 80 * scale, 1104 * scale);
  }

  context.textAlign = "right";
  if (captionLabel) {
    context.fillStyle = theme.ink;
    context.font = `italic 400 ${24 * scale}px "Instrument Serif", Georgia, serif`;
    context.fillText(captionLabel, width - 80 * scale, 1104 * scale);
  }
}

function drawPhotoSlot(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  slot: PhotoSlot,
  radius: number,
  theme: FrameTheme,
  settings: CompositionSettings,
  scale: number,
): void {
  context.save();
  context.shadowColor = theme.shadow;
  context.shadowBlur = 22 * scale;
  context.shadowOffsetY = 8 * scale;
  context.fillStyle = theme.paper;
  roundedRect(context, slot.x, slot.y, slot.width, slot.height, radius);
  context.fill();
  context.restore();

  context.save();
  roundedRect(context, slot.x, slot.y, slot.width, slot.height, radius);
  context.clip();

  if (image) {
    context.filter = buildFilterString(
      settings.filterId,
      settings.adjustments.brightness,
      settings.adjustments.contrast,
    );
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawImageCover(context, image, slot);
    context.filter = "none";
  } else {
    const placeholder = context.createLinearGradient(
      slot.x,
      slot.y,
      slot.x + slot.width,
      slot.y + slot.height,
    );
    placeholder.addColorStop(0, "#EADFD0");
    placeholder.addColorStop(1, "#D7C3AF");
    context.fillStyle = placeholder;
    context.fillRect(slot.x, slot.y, slot.width, slot.height);
    context.fillStyle = "rgba(255, 255, 255, 0.75)";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `italic 400 ${26 * scale}px "Instrument Serif", Georgia, serif`;
    context.fillText("a moment in progress", slot.x + slot.width / 2, slot.y + slot.height / 2);
  }

  const filter = PHOTO_FILTERS[settings.filterId];
  if (filter.glow > 0) {
    context.fillStyle = `rgba(255, 247, 238, ${filter.glow})`;
    context.fillRect(slot.x, slot.y, slot.width, slot.height);
  }

  fillGrain(context, slot.x, slot.y, slot.width, slot.height, filter.grain);
  context.restore();

  context.save();
  roundedRect(context, slot.x, slot.y, slot.width, slot.height, radius);
  context.strokeStyle = theme.slotStroke;
  context.lineWidth = Math.max(1, 2 * scale);
  context.stroke();
  context.restore();
}

export interface ComposeOptions {
  width?: number;
}

export async function composeStrip(
  frames: string[],
  layoutId: LayoutId,
  settings: CompositionSettings,
  options: ComposeOptions = {},
): Promise<HTMLCanvasElement> {
  const layout = layoutFor(layoutId);
  const theme = themeFor(settings.frame);
  const targetWidth = options.width ?? layout.width;
  const scale = targetWidth / layout.width;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The photo canvas could not be created.");
  }

  if ("fonts" in document) {
    await document.fonts.ready;
  }

  const images = await Promise.all(
    frames.map(async (source) => {
      try {
        return await loadImage(source);
      } catch {
        return undefined;
      }
    }),
  );

  paintBackground(context, canvas.width, canvas.height, theme);
  fillGrain(context, 0, 0, canvas.width, canvas.height, 0.018);

  context.strokeStyle = theme.line;
  context.lineWidth = Math.max(1, 1.4 * scale);
  context.strokeRect(26 * scale, 26 * scale, canvas.width - 52 * scale, canvas.height - 52 * scale);

  paintHeader(context, layout, theme, scale);

  layout.slots.forEach((rawSlot, index) => {
    const slot: PhotoSlot = {
      x: rawSlot.x * scale,
      y: rawSlot.y * scale,
      width: rawSlot.width * scale,
      height: rawSlot.height * scale,
    };
    drawPhotoSlot(
      context,
      images[index],
      slot,
      layout.slotRadius * scale,
      theme,
      settings,
      scale,
    );
  });

  paintFooter(context, layout, theme, scale, settings.caption, settings.showDate);

  drawStickers(
    context,
    settings.stickers,
    layout.width,
    layout.height,
    theme,
    scale,
  );

  return canvas;
}

export function formatStampDate(date = new Date()): string {
  return `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")} ${date.getFullYear()}`;
}

export function composeStripDataUrl(
  frames: string[],
  layoutId: LayoutId,
  settings: CompositionSettings,
): Promise<string> {
  return composeStrip(frames, layoutId, settings).then((canvas) =>
    canvas.toDataURL("image/png"),
  );
}
