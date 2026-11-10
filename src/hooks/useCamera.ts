import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "error";

function cameraErrorMessage(error: unknown): string {
  if (!window.isSecureContext) {
    return "Camera access needs HTTPS or localhost. Open the booth on a secure connection.";
  }

  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera permission was declined. Allow camera access in your browser to enter the booth.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera was found. Connect a webcam and try again.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "The camera is being used by another app. Close it and try again.";
    }
    if (error.name === "OverconstrainedError") {
      return "This camera does not support the requested video mode.";
    }
  }

  return "The camera could not start. Please try again.";
}

export function useCamera() {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mirrored, setMirrored] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("This browser does not support camera capture.");
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus("requesting");
    setError(null);

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });

      if (requestIdRef.current !== requestId) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = nextStream;
      setStream(nextStream);
      setStatus("ready");
    } catch (captureError) {
      if (requestIdRef.current !== requestId) return;
      setStatus("error");
      setError(cameraErrorMessage(captureError));
    }
  }, []);

  useEffect(() => stop, [stop]);

  return {
    status,
    error,
    stream,
    mirrored,
    setMirrored,
    start,
    stop,
  };
}
