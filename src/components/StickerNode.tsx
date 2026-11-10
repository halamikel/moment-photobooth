import { Maximize2, RotateCw } from "lucide-react";
import {
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import type { PlacedSticker } from "../types";
import { clamp } from "../lib/utils";
import {
  stickerColors,
  type StickerDefinition,
} from "../lib/stickers";
import type { FrameTheme } from "../lib/themes";
import { cn } from "../lib/utils";

type InteractionMode = "drag" | "resize" | "rotate";

interface Interaction {
  mode: InteractionMode;
  pointerId: number;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialScale: number;
  initialRotation: number;
  centerX: number;
  centerY: number;
  initialDistance: number;
  initialAngle: number;
}

interface StickerNodeProps {
  sticker: PlacedSticker;
  definition: StickerDefinition;
  theme: FrameTheme;
  selected: boolean;
  previewWidth: number;
  containerRef: RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onChange: (patch: Partial<PlacedSticker>) => void;
}

export function StickerNode({
  sticker,
  definition,
  theme,
  selected,
  previewWidth,
  containerRef,
  onSelect,
  onChange,
}: StickerNodeProps) {
  const interactionRef = useRef<Interaction | null>(null);
  const fontSize = definition.baseSize * previewWidth * sticker.scale;
  const colors = stickerColors(definition, theme);

  const beginInteraction = (
    mode: InteractionMode,
    event: PointerEvent<HTMLElement>,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    onSelect();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + sticker.x * rect.width;
    const centerY = rect.top + sticker.y * rect.height;
    const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
    const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);

    interactionRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: sticker.x,
      initialY: sticker.y,
      initialScale: sticker.scale,
      initialRotation: sticker.rotation,
      centerX,
      centerY,
      initialDistance: Math.max(distance, 8),
      initialAngle: angle,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    event.preventDefault();

    if (interaction.mode === "drag") {
      const nextX = clamp(
        interaction.initialX + (event.clientX - interaction.startX) / rect.width,
        0.04,
        0.96,
      );
      const nextY = clamp(
        interaction.initialY + (event.clientY - interaction.startY) / rect.height,
        0.04,
        0.96,
      );
      onChange({ x: nextX, y: nextY });
      return;
    }

    if (interaction.mode === "resize") {
      const distance = Math.hypot(
        event.clientX - interaction.centerX,
        event.clientY - interaction.centerY,
      );
      onChange({
        scale: clamp(
          interaction.initialScale * (distance / interaction.initialDistance),
          0.35,
          4,
        ),
      });
      return;
    }

    const angle = Math.atan2(
      event.clientY - interaction.centerY,
      event.clientX - interaction.centerX,
    );
    const degrees = ((angle - interaction.initialAngle) * 180) / Math.PI;
    const rotation =
      (((interaction.initialRotation + degrees + 180) % 360) + 360) % 360 - 180;
    onChange({ rotation: Math.round(rotation) });
  };

  const endInteraction = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    interactionRef.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
      return;
    }

    const step = event.shiftKey ? 0.04 : 0.01;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onChange({ x: clamp(sticker.x - step, 0.04, 0.96) });
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onChange({ x: clamp(sticker.x + step, 0.04, 0.96) });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onChange({ y: clamp(sticker.y - step, 0.04, 0.96) });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      onChange({ y: clamp(sticker.y + step, 0.04, 0.96) });
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${definition.label} sticker. Drag to move, or use arrow keys.`}
      onPointerDown={(event) => beginInteraction("drag", event)}
      onPointerMove={handlePointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      onKeyDown={handleKeyDown}
      className={cn(
        "absolute touch-none select-none outline-none",
        selected ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
      style={{
        left: `${sticker.x * 100}%`,
        top: `${sticker.y * 100}%`,
        zIndex: sticker.zIndex,
        transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
      }}
    >
      {definition.kind === "emoji" ? (
        <span
          className="block whitespace-nowrap leading-none"
          style={{
            fontSize,
            filter: "drop-shadow(0 3px 4px rgba(0, 0, 0, 0.2))",
          }}
        >
          {definition.glyph}
        </span>
      ) : (
        <span
          className="block whitespace-nowrap font-bold leading-none"
          style={{
            fontSize,
            color: colors.color,
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderStyle: "solid",
            borderWidth: definition.variant === "outline" ? 2 : 0,
            borderRadius: 999,
            padding: `${fontSize * 0.3}px ${fontSize * 0.55}px`,
            letterSpacing: `${fontSize * 0.04}px`,
            boxShadow:
              definition.variant === "outline"
                ? "none"
                : "0 3px 8px rgba(0, 0, 0, 0.16)",
          }}
        >
          {definition.glyph}
        </span>
      )}

      {selected && (
        <>
          <span className="pointer-events-none absolute -inset-2 rounded-2xl border border-dashed border-ink/55" />
          <button
            type="button"
            aria-label="Resize sticker"
            onPointerDown={(event) => beginInteraction("resize", event)}
            className="absolute -bottom-3 -right-3 grid h-6 w-6 cursor-nwse-resize place-items-center rounded-full border border-ink/30 bg-paper text-ink shadow-sm"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Rotate sticker"
            onPointerDown={(event) => beginInteraction("rotate", event)}
            className="absolute -top-9 left-1/2 grid h-6 w-6 -translate-x-1/2 cursor-grab place-items-center rounded-full border border-ink/30 bg-paper text-ink shadow-sm"
          >
            <RotateCw className="h-3 w-3" />
          </button>
          <span className="pointer-events-none absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-ink/40" />
        </>
      )}
    </div>
  );
}
