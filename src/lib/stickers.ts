import type { PlacedSticker } from "../types";
import type { FrameTheme } from "./themes";

export type StickerVariant = "ink" | "accent" | "outline";

export interface StickerDefinition {
  id: string;
  label: string;
  glyph: string;
  kind: "emoji" | "stamp";
  variant?: StickerVariant;
  baseSize: number;
}

export interface StickerGroup {
  id: string;
  label: string;
  items: StickerDefinition[];
}

function emoji(id: string, label: string, glyph: string, baseSize = 0.075): StickerDefinition {
  return { id, label, glyph, kind: "emoji", baseSize };
}

function stamp(
  id: string,
  label: string,
  glyph: string,
  variant: StickerVariant = "ink",
  baseSize = 0.052,
): StickerDefinition {
  return { id, label, glyph, kind: "stamp", variant, baseSize };
}

export const STICKER_GROUPS: StickerGroup[] = [
  {
    id: "love",
    label: "Love",
    items: [
      emoji("heart-pink", "Pink heart", "💗"),
      emoji("heart-sparkle", "Sparkle heart", "💖"),
      emoji("heart-arrow", "Cupid heart", "💘"),
      emoji("love-letter", "Love letter", "💌"),
      emoji("kiss", "Kiss", "💋"),
      stamp("xoxo", "XOXO", "XOXO", "ink"),
      stamp("love", "LOVE", "LOVE", "accent"),
    ],
  },
  {
    id: "sparkle",
    label: "Sparkle",
    items: [
      emoji("sparkles", "Sparkles", "✨"),
      emoji("star-gold", "Gold star", "🌟"),
      emoji("star", "Star", "⭐"),
      emoji("dizzy", "Dizzy", "💫"),
      emoji("star-plain", "Little star", "★", 0.065),
      emoji("sparkle-plain", "Little sparkle", "✧", 0.07),
      stamp("moment", "MOMENT", "MOMENT", "outline", 0.048),
    ],
  },
  {
    id: "cute",
    label: "Cute",
    items: [
      emoji("bunny", "Bunny", "🐰"),
      emoji("ribbon", "Ribbon", "🎀"),
      emoji("blossom", "Blossom", "🌸"),
      emoji("cherry", "Cherry", "🍒"),
      emoji("bear", "Bear", "🧸"),
      emoji("cloud", "Cloud", "☁️"),
      emoji("chick", "Chick", "🐣"),
    ],
  },
  {
    id: "kpop",
    label: "K-pop",
    items: [
      stamp("cute", "CUTE", "CUTE", "accent", 0.052),
      stamp("four-cut", "4CUT", "4CUT", "ink", 0.05),
      stamp("selfie", "SELFIE", "SELFIE", "outline", 0.044),
      stamp("omg", "OMG", "OMG", "accent", 0.05),
      stamp("kiss-stamp", "KISS", "KISS", "ink", 0.05),
      stamp("seoul", "SEOUL", "SEOUL", "outline", 0.048),
      stamp("iconic", "ICONIC", "ICONIC", "accent", 0.044),
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    items: [
      emoji("outline-heart", "Outline heart", "♡", 0.08),
      emoji("flower-symbol", "Flower", "✿", 0.07),
      emoji("moon", "Moon", "☾", 0.075),
      emoji("music", "Music", "♪", 0.075),
      emoji("infinity", "Infinity", "∞", 0.07),
      emoji("smile", "Smile", "☺", 0.07),
    ],
  },
];

const stickerMap = new Map<string, StickerDefinition>(
  STICKER_GROUPS.flatMap((group) => group.items).map((item) => [item.id, item]),
);

export function getStickerDefinition(id: string): StickerDefinition | undefined {
  return stickerMap.get(id);
}

export interface StickerColors {
  background: string;
  color: string;
  border: string;
}

export function stickerColors(
  definition: StickerDefinition,
  theme: FrameTheme,
): StickerColors {
  if (definition.variant === "accent") {
    return { background: theme.accent, color: theme.ink, border: theme.accent };
  }

  if (definition.variant === "outline") {
    return { background: "transparent", color: theme.ink, border: theme.ink };
  }

  return { background: theme.ink, color: theme.paper, border: theme.ink };
}

const EMOJI_FONT =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';
const STAMP_FONT = '"DM Sans", "Noto Sans KR", sans-serif';

export function drawStickers(
  ctx: CanvasRenderingContext2D,
  stickers: PlacedSticker[],
  layoutWidth: number,
  layoutHeight: number,
  theme: FrameTheme,
  scale: number,
): void {
  const ordered = [...stickers].sort((left, right) => left.zIndex - right.zIndex);

  for (const sticker of ordered) {
    const definition = getStickerDefinition(sticker.definitionId);
    if (!definition) continue;

    const centerX = sticker.x * layoutWidth * scale;
    const centerY = sticker.y * layoutHeight * scale;
    const fontSize = definition.baseSize * layoutWidth * scale * sticker.scale;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((sticker.rotation * Math.PI) / 180);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (definition.kind === "emoji") {
      ctx.font = `${fontSize}px ${EMOJI_FONT}`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
      ctx.shadowBlur = fontSize * 0.14;
      ctx.shadowOffsetY = fontSize * 0.05;
      ctx.fillText(definition.glyph, 0, 0);
    } else {
      const colors = stickerColors(definition, theme);
      const text = definition.glyph;
      ctx.font = `700 ${fontSize}px ${STAMP_FONT}`;
      const metrics = ctx.measureText(text);
      const paddingX = fontSize * 0.55;
      const paddingY = fontSize * 0.3;
      const width = metrics.width + paddingX * 2;
      const height = fontSize + paddingY * 2;
      const radius = height / 2;

      ctx.beginPath();
      ctx.roundRect(-width / 2, -height / 2, width, height, radius);
      if (colors.background !== "transparent") {
        ctx.fillStyle = colors.background;
        ctx.fill();
      }
      if (colors.border !== "transparent") {
        ctx.lineWidth = Math.max(1.5, fontSize * 0.045);
        ctx.strokeStyle = colors.border;
        ctx.stroke();
      }

      ctx.fillStyle = colors.color;
      ctx.fillText(text, 0, fontSize * 0.02);
    }

    ctx.restore();
  }
}
