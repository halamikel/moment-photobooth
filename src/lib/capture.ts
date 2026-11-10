export interface CaptureOptions {
  aspect: number;
  mirrored: boolean;
  outputWidth?: number;
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  options: CaptureOptions,
): string {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("The camera is still warming up.");
  }

  const outputWidth = options.outputWidth ?? 1280;
  const outputHeight = Math.round(outputWidth / options.aspect);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The camera canvas could not be created.");
  }

  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = options.aspect;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceAspect > targetAspect) {
    cropWidth = sourceHeight * targetAspect;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetAspect;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (options.mirrored) {
    context.translate(outputWidth, 0);
    context.scale(-1, 1);
  }

  context.drawImage(
    video,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return canvas.toDataURL("image/png");
}
