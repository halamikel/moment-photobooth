import type { FrameId } from "../../shared/contracts";

export interface ThemeGradient {
  from: string;
  to: string;
  angle: number;
}

export interface FrameTheme {
  id: FrameId;
  label: string;
  koreanLabel: string;
  paper: string;
  ink: string;
  softInk: string;
  accent: string;
  line: string;
  slotStroke: string;
  shadow: string;
  cssBackground: string;
  gradient: ThemeGradient | null;
  dark: boolean;
}

export const FRAME_THEMES: Record<FrameId, FrameTheme> = {
  cream: {
    id: "cream",
    label: "Butter cream",
    koreanLabel: "버터 크림",
    paper: "#F8F0E2",
    ink: "#2B2520",
    softInk: "#82766A",
    accent: "#D69C8D",
    line: "rgba(43, 37, 32, 0.16)",
    slotStroke: "rgba(43, 37, 32, 0.14)",
    shadow: "rgba(81, 57, 40, 0.28)",
    cssBackground: "#F8F0E2",
    gradient: null,
    dark: false,
  },
  blush: {
    id: "blush",
    label: "Peach blush",
    koreanLabel: "피치 블러시",
    paper: "#F8DFDA",
    ink: "#442D2A",
    softInk: "#8B6761",
    accent: "#BD6E63",
    line: "rgba(68, 45, 42, 0.15)",
    slotStroke: "rgba(68, 45, 42, 0.13)",
    shadow: "rgba(104, 58, 52, 0.26)",
    cssBackground: "#F8DFDA",
    gradient: null,
    dark: false,
  },
  noir: {
    id: "noir",
    label: "Midnight noir",
    koreanLabel: "미드나잇 누아르",
    paper: "#171514",
    ink: "#F7F0E4",
    softInk: "#A9A098",
    accent: "#D9A69D",
    line: "rgba(247, 240, 228, 0.2)",
    slotStroke: "rgba(247, 240, 228, 0.16)",
    shadow: "rgba(0, 0, 0, 0.55)",
    cssBackground: "#171514",
    gradient: null,
    dark: true,
  },
  porcelain: {
    id: "porcelain",
    label: "Porcelain white",
    koreanLabel: "포슬린 화이트",
    paper: "#FFFDF9",
    ink: "#211E1A",
    softInk: "#7B7369",
    accent: "#B49D87",
    line: "rgba(33, 30, 26, 0.13)",
    slotStroke: "rgba(33, 30, 26, 0.12)",
    shadow: "rgba(63, 48, 34, 0.22)",
    cssBackground: "#FFFDF9",
    gradient: null,
    dark: false,
  },
  sky: {
    id: "sky",
    label: "Powder sky",
    koreanLabel: "파우더 스카이",
    paper: "#DCEFF6",
    ink: "#22343C",
    softInk: "#607983",
    accent: "#7EAABB",
    line: "rgba(34, 52, 60, 0.14)",
    slotStroke: "rgba(34, 52, 60, 0.12)",
    shadow: "rgba(50, 82, 96, 0.24)",
    cssBackground: "linear-gradient(150deg, #E6F5FA 0%, #C6E0EB 100%)",
    gradient: { from: "#E6F5FA", to: "#C6E0EB", angle: 150 },
    dark: false,
  },
  lilac: {
    id: "lilac",
    label: "Soft lilac",
    koreanLabel: "소프트 라일락",
    paper: "#EDE6F7",
    ink: "#322A40",
    softInk: "#776C89",
    accent: "#A28DBE",
    line: "rgba(50, 42, 64, 0.14)",
    slotStroke: "rgba(50, 42, 64, 0.12)",
    shadow: "rgba(73, 57, 94, 0.25)",
    cssBackground: "linear-gradient(145deg, #F2ECFA 0%, #D8CDEC 100%)",
    gradient: { from: "#F2ECFA", to: "#D8CDEC", angle: 145 },
    dark: false,
  },
  sunset: {
    id: "sunset",
    label: "Peach sunset",
    koreanLabel: "피치 선셋",
    paper: "#FCE3D2",
    ink: "#442722",
    softInk: "#916A60",
    accent: "#DD8F7D",
    line: "rgba(68, 39, 34, 0.14)",
    slotStroke: "rgba(68, 39, 34, 0.12)",
    shadow: "rgba(109, 63, 48, 0.26)",
    cssBackground: "linear-gradient(155deg, #FFEBDD 0%, #F3BDB7 100%)",
    gradient: { from: "#FFEBDD", to: "#F3BDB7", angle: 155 },
    dark: false,
  },
};

export function themeFor(id: FrameId): FrameTheme {
  return FRAME_THEMES[id];
}
