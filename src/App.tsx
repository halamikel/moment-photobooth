import { useEffect, useState } from "react";
import { FRAME_COUNTS } from "../shared/contracts";
import { createSession, finalizeSession } from "./lib/api";
import type {
  BoothConfig,
  BoothScreen,
  CompositionSettings,
  PublishedBooth,
} from "./types";
import { CaptureScreen } from "./components/CaptureScreen";
import { HomeScreen } from "./components/HomeScreen";
import { ResultScreen } from "./components/ResultScreen";
import { SharePage } from "./components/SharePage";
import { StickerEditor } from "./components/StickerEditor";
import { layoutFor } from "./lib/layouts";

const DEFAULT_CONFIG: BoothConfig = {
  layout: "classic",
  timer: 5,
  frame: "cream",
  caption: "",
  showDate: true,
};

function shareTokenFromPath(): string | null {
  const match = /^\/share\/([^/]+)\/?$/.exec(window.location.pathname);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function emptyFrames(layout: BoothConfig["layout"]): Array<string | null> {
  return Array.from({ length: FRAME_COUNTS[layout] }, () => null);
}

function PhotoboothApp() {
  const [screen, setScreen] = useState<BoothScreen>("home");
  const [config, setConfig] = useState<BoothConfig>(DEFAULT_CONFIG);
  const [frames, setFrames] = useState<Array<string | null>>(
    emptyFrames(DEFAULT_CONFIG.layout),
  );
  const [published, setPublished] = useState<PublishedBooth | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const startBooth = () => {
    setFrames(emptyFrames(config.layout));
    setPublished(null);
    setScreen("capture");
  };

  const captureFrame = (index: number, dataUrl: string) => {
    setFrames((current) =>
      current.map((frame, frameIndex) => (frameIndex === index ? dataUrl : frame)),
    );
  };

  const resetFrames = () => {
    setFrames(emptyFrames(config.layout));
  };

  const continueToEditor = () => {
    if (frames.some((frame) => frame === null)) return;
    setScreen("decorate");
  };

  const developStrip = async (
    stripDataUrl: string,
    settings: CompositionSettings,
  ): Promise<void> => {
    const capturedFrames = frames.filter((frame): frame is string => frame !== null);
    if (capturedFrames.length !== FRAME_COUNTS[config.layout]) {
      throw new Error("A frame is missing. Return to the shoot and retake it.");
    }

    const sessionConfig: BoothConfig = {
      ...config,
      frame: settings.frame,
      caption: settings.caption,
      showDate: settings.showDate,
    };

    const created = await createSession(sessionConfig);
    const finalized = await finalizeSession(
      created.session.id,
      created.accessToken,
      stripDataUrl,
      capturedFrames,
    );

    setPublished({
      session: finalized.session,
      accessToken: created.accessToken,
      media: finalized.media,
      stripDataUrl,
    });
    setScreen("result");
  };

  const startOver = () => {
    setConfig(DEFAULT_CONFIG);
    setFrames(emptyFrames(DEFAULT_CONFIG.layout));
    setPublished(null);
    setScreen("home");
  };

  if (screen === "capture") {
    return (
      <CaptureScreen
        layout={layoutFor(config.layout)}
        timer={config.timer}
        frames={frames}
        onCapture={captureFrame}
        onReset={resetFrames}
        onBack={() => setScreen("home")}
        onContinue={continueToEditor}
      />
    );
  }

  if (screen === "decorate") {
    const capturedFrames = frames.filter((frame): frame is string => frame !== null);
    return (
      <StickerEditor
        config={config}
        frames={capturedFrames}
        onConfigChange={setConfig}
        onBack={() => setScreen("capture")}
        onDevelop={developStrip}
      />
    );
  }

  if (screen === "result" && published) {
    return <ResultScreen published={published} onStartOver={startOver} />;
  }

  return (
    <HomeScreen
      config={config}
      onConfigChange={setConfig}
      onStart={startBooth}
    />
  );
}

export default function App() {
  const shareToken = shareTokenFromPath();
  if (shareToken) {
    return <SharePage token={shareToken} />;
  }

  return <PhotoboothApp />;
}
