import type { Clip, SceneGraph } from "@/types";
import { drawQRCode } from "./qrGenerator";

/**
 * Get active clips at current playhead position sorted by Painter's Algorithm layer order.
 * Ensures video/background tracks are rendered FIRST and text/annotations/shapes/QR are rendered LAST (ON TOP).
 */
export function getSortedActiveClips(sceneGraph: SceneGraph | null | undefined, playhead: number): Clip[] {
  if (!sceneGraph || !sceneGraph.tracks) return [];

  const active: { clip: Clip; trackIndex: number }[] = [];

  sceneGraph.tracks.forEach((track, trackIndex) => {
    const matchingClips = track.clips.filter(
      (c) => playhead >= c.startTime && playhead <= c.endTime && c.asset?.type !== "audio"
    );
    matchingClips.forEach((clip) => {
      active.push({ clip, trackIndex });
    });
  });

  const getPriority = (c: Clip) => {
    const type = c.asset?.type;
    if (type === "video") return 10;
    if (type === "image") return 20;
    if (type === "slider") return 30;
    if (type === "shape") return 40;
    if (type === "qr") return 50;
    if (type === "text") return 60;
    return 30;
  };

  // Painter's Algorithm: Lower priority (Video: 10) drawn FIRST (Background),
  // Higher priority (Text: 60) drawn LAST (Foreground - ON TOP OF EVERYTHING).
  active.sort((a, b) => {
    const prioA = getPriority(a.clip);
    const prioB = getPriority(b.clip);

    if (prioA !== prioB) {
      return prioA - prioB;
    }

    return b.trackIndex - a.trackIndex;
  });

  return active.map((item) => item.clip);
}

export interface RenderContextMedia {
  videoElements?: Map<string, HTMLMediaElement | HTMLVideoElement>;
  imageElements?: Map<string, HTMLImageElement>;
}

export function drawClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  media: RenderContextMedia = {}
) {
  if (!clip || currentTime < clip.startTime || currentTime > clip.endTime) return;

  const elapsed = currentTime - clip.startTime;

  // 1. Transform Defaults
  const transform = clip.transform || {};
  const posX = (transform.x ?? 0) + canvasWidth / 2;
  const posY = (transform.y ?? 0) + canvasHeight / 2;
  const scale = transform.scale ?? 1.0;
  const rotationRad = ((transform.rotation ?? 0) * Math.PI) / 180;
  let baseOpacity = transform.opacity ?? 1.0;

  // 2. Animations (Fade, Slide, Zoom, Bounce)
  let animOffsetX = 0;
  let animOffsetY = 0;
  let animScale = 1.0;

  const animation = clip.animation;
  if (animation && animation.type) {
    const animDur = animation.duration || 0.6;
    if (animation.type === "fade_in") {
      const p = Math.min(1, Math.max(0, elapsed / animDur));
      baseOpacity *= p;
    } else if (animation.type === "fade_out") {
      const remaining = clip.endTime - currentTime;
      const p = Math.min(1, Math.max(0, remaining / animDur));
      baseOpacity *= p;
    } else if (animation.type === "slide_left") {
      const p = Math.min(1, Math.max(0, elapsed / animDur));
      animOffsetX = (1 - p) * -300;
    } else if (animation.type === "slide_right") {
      const p = Math.min(1, Math.max(0, elapsed / animDur));
      animOffsetX = (1 - p) * 300;
    } else if (animation.type === "zoom_in") {
      const p = Math.min(1, Math.max(0, elapsed / animDur));
      animScale = 0.2 + 0.8 * p;
    } else if (animation.type === "zoom_out") {
      const p = Math.min(1, Math.max(0, elapsed / animDur));
      animScale = 1.5 - 0.5 * p;
    } else if (animation.type === "bounce") {
      const p = Math.min(1, Math.max(0, elapsed / animDur));
      animOffsetY = -Math.abs(Math.sin(p * Math.PI * 2)) * 40 * (1 - p);
    }
  }

  if (baseOpacity <= 0) return;

  ctx.save();
  ctx.globalAlpha = baseOpacity;
  ctx.translate(posX + animOffsetX, posY + animOffsetY);
  ctx.rotate(rotationRad);
  ctx.scale(scale * animScale, scale * animScale);

  const assetType = clip.asset?.type || "video";
  const content = clip.asset?.content;

  // ─── A. TEXT ELEMENT ──────────────────────────────────────────────────
  if (assetType === "text") {
    const styles = clip.textStyles || {};
    const textStr = styles.content || content || "Title Goes There";
    const fontSize = styles.fontSize || 36;
    const fontFamily = styles.fontFamily || "Inter";
    const fontWeight = styles.fontWeight || "Bold";
    const fontStyle = styles.fontStyle || "normal";
    const color = styles.color || "#ffffff";
    const align = styles.align || "center";
    const bgColor = styles.backgroundColor;
    const bgPadding = styles.backgroundPadding || 12;
    const borderRadius = styles.borderRadius || 8;

    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(textStr);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.2;

    // Draw Background Box if present
    if (bgColor) {
      ctx.fillStyle = bgColor;
      const boxW = textWidth + bgPadding * 2;
      const boxH = textHeight + bgPadding * 2;
      let boxX = -boxW / 2;
      if (align === "left") boxX = -bgPadding;
      if (align === "right") boxX = -textWidth - bgPadding;
      const boxY = -boxH / 2;

      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(boxX, boxY, boxW, boxH, borderRadius);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();
    }

    // Draw Stroke if present
    if (styles.strokeColor && styles.strokeWidth) {
      ctx.strokeStyle = styles.strokeColor;
      ctx.lineWidth = styles.strokeWidth;
      ctx.strokeText(textStr, 0, 0);
    }

    // Draw Text Fill
    ctx.fillStyle = color;
    ctx.fillText(textStr, 0, 0);
  }

  // ─── B. QR CODE ELEMENT ────────────────────────────────────────────────
  else if (assetType === "qr" || (assetType === "image" && content === "QR Code")) {
    const qrStyles = clip.qrStyles || {};
    const qrText = qrStyles.qrContent || content || "https://example.com";
    const fg = qrStyles.foregroundColor || "#000000";
    const bg = qrStyles.backgroundColor || "#ffffff";
    const width = transform.width || 180;
    const height = transform.height || 180;

    drawQRCode(ctx, qrText, -width / 2, -height / 2, width, height, fg, bg);
  }

  // ─── C. SHAPE ELEMENT ──────────────────────────────────────────────────
  else if (assetType === "shape" || (assetType === "image" && ["Rectangle", "Ellipses", "Triangle", "Star", "Line"].includes(content || ""))) {
    const shapeStyles = clip.shapeStyles || {};
    const shapeType = shapeStyles.shapeType || (content as any) || "Rectangle";
    const fill = shapeStyles.fillColor || "#38bdf8";
    const stroke = shapeStyles.strokeColor;
    const strokeW = shapeStyles.strokeWidth || 0;
    const radius = shapeStyles.borderRadius || 8;
    const width = transform.width || 200;
    const height = transform.height || 150;

    const halfW = width / 2;
    const halfH = height / 2;

    ctx.fillStyle = fill;
    if (stroke && strokeW > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeW;
    }

    ctx.beginPath();
    if (shapeType === "Rectangle" || shapeType === "rectangle") {
      if (typeof ctx.roundRect === "function" && radius > 0) {
        ctx.roundRect(-halfW, -halfH, width, height, radius);
      } else {
        ctx.rect(-halfW, -halfH, width, height);
      }
    } else if (shapeType === "Ellipses" || shapeType === "ellipse" || shapeType === "circle") {
      ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
    } else if (shapeType === "Triangle" || shapeType === "triangle") {
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, halfH);
      ctx.lineTo(-halfW, halfH);
      ctx.closePath();
    } else if (shapeType === "Star" || shapeType === "star") {
      const spikes = 5;
      const outerRadius = Math.min(halfW, halfH);
      const innerRadius = outerRadius / 2.2;
      let rot = (Math.PI / 2) * 3;
      let step = Math.PI / spikes;
      ctx.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(Math.cos(rot) * outerRadius, Math.sin(rot) * outerRadius);
        rot += step;
        ctx.lineTo(Math.cos(rot) * innerRadius, Math.sin(rot) * innerRadius);
        rot += step;
      }
      ctx.closePath();
    } else if (shapeType === "Line" || shapeType === "line") {
      ctx.strokeStyle = stroke || fill || "#38bdf8";
      ctx.lineWidth = strokeW > 0 ? strokeW : 4;
      ctx.moveTo(-halfW, 0);
      ctx.lineTo(halfW, 0);
      ctx.stroke();
    }

    if (shapeType !== "Line" && shapeType !== "line") {
      ctx.fill();
      if (stroke && strokeW > 0) {
        ctx.stroke();
      }
    }
  }

  // ─── D. SLIDER / SLIDESHOW WIDGET ──────────────────────────────────────
  else if (assetType === "slider" || (assetType === "image" && content === "Slider Widget")) {
    const sliderStyles = clip.sliderStyles || {};
    const images = sliderStyles.images && sliderStyles.images.length > 0
      ? sliderStyles.images
      : ["/assets/images/Image.png", "/assets/images/Create Template.png"];

    const slideDuration = sliderStyles.slideDuration || 2.5;
    const totalSlides = images.length;
    const currentSlideIdx = Math.floor(elapsed / slideDuration) % totalSlides;

    const width = transform.width || 360;
    const height = transform.height || 220;

    // Draw Slider Frame Box
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(-width / 2, -height / 2, width, height, 12);
    } else {
      ctx.rect(-width / 2, -height / 2, width, height);
    }
    ctx.fill();

    // Draw Slide Number Label & Card Graphic
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Slide ${currentSlideIdx + 1} / ${totalSlides}`, 0, 0);
  }

  // ─── E. VIDEO & IMAGE CLIPS ────────────────────────────────────────────
  else if (assetType === "video" || assetType === "image") {
    let sourceMedia: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null = null;
    let naturalWidth = 960;
    let naturalHeight = 540;

    if (assetType === "video" && media.videoElements) {
      const vid = (media.videoElements.get(clip.id) || media.videoElements.get(clip.assetId)) as HTMLVideoElement | undefined;
      if (vid && vid instanceof HTMLVideoElement && vid.videoWidth > 0) {
        sourceMedia = vid;
        naturalWidth = vid.videoWidth;
        naturalHeight = vid.videoHeight;
      }
    } else if (assetType === "image" && media.imageElements) {
      const img = media.imageElements.get(clip.id) || media.imageElements.get(clip.assetId);
      if (img && img.complete && img.width > 0) {
        sourceMedia = img;
        naturalWidth = img.width;
        naturalHeight = img.height;
      }
    }

    const fitWidth = transform.width || canvasWidth;
    const fitHeight = transform.height || canvasHeight;

    if (sourceMedia) {
      const scaleFit = Math.min(fitWidth / naturalWidth, fitHeight / naturalHeight);
      const dw = naturalWidth * scaleFit;
      const dh = naturalHeight * scaleFit;

      ctx.drawImage(sourceMedia, -dw / 2, -dh / 2, dw, dh);
    }
  }

  ctx.restore();
}
