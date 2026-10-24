import { BaseShape, AnimatableProperty, Keyframe } from '../types';
import { getAnimatedShape } from './animationUtils';
import { applyStrokeStyle, applyShadow } from './strokeUtils';

type Animations = Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>;

export interface ExportRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  background: string;
}

/** Export area: the first visible frame, or the bounding box of every visible shape. */
export function getExportRegion(shapes: BaseShape[]): ExportRegion {
  const frame = shapes.find(s => s.type === 'frame' && !s.hidden);
  if (frame) {
    return {
      x: Math.min(frame.x, frame.x + frame.width),
      y: Math.min(frame.y, frame.y + frame.height),
      width: Math.abs(frame.width) || 800,
      height: Math.abs(frame.height) || 600,
      background: frame.fill && frame.fill !== 'transparent' ? frame.fill : '#FFFFFF',
    };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  shapes.forEach(s => {
    if (s.type === 'group' || s.hidden) return;
    minX = Math.min(minX, s.x, s.x + s.width);
    minY = Math.min(minY, s.y, s.y + s.height);
    maxX = Math.max(maxX, s.x, s.x + s.width);
    maxY = Math.max(maxY, s.y, s.y + s.height);
  });
  if (minX === Infinity) return { x: 0, y: 0, width: 800, height: 600, background: '#FFFFFF' };
  return { x: minX, y: minY, width: Math.max(16, maxX - minX), height: Math.max(16, maxY - minY), background: '#FFFFFF' };
}

/** Loads every image used by the scene so frames never render with a missing bitmap. */
export async function preloadImages(shapes: BaseShape[]): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  const urls = new Set(shapes.map(s => s.imageUrl || (s.type === 'image' ? s.src : undefined)).filter(Boolean) as string[]);
  await Promise.all([...urls].map(url => new Promise<void>(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { map.set(url, img); resolve(); };
    img.onerror = () => resolve();
    img.src = url;
  })));
  return map;
}

function tracePath(ctx: CanvasRenderingContext2D, shape: BaseShape, offX: number, offY: number) {
  const pts = shape.points!;
  const tx = (v: number) => v * shape.width + offX;
  const ty = (v: number) => v * shape.height + offY;
  ctx.beginPath();
  ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
  const segment = (prev: typeof pts[0], curr: typeof pts[0]) => {
    if (prev.cp2 || curr.cp1) {
      const c1 = prev.cp2 || prev;
      const c2 = curr.cp1 || curr;
      ctx.bezierCurveTo(tx(c1.x), ty(c1.y), tx(c2.x), ty(c2.y), tx(curr.x), ty(curr.y));
    } else {
      ctx.lineTo(tx(curr.x), ty(curr.y));
    }
  };
  for (let i = 1; i < pts.length; i++) segment(pts[i - 1], pts[i]);
  if (shape.closed && pts.length > 2) {
    segment(pts[pts.length - 1], pts[0]);
    ctx.closePath();
  }
}

/**
 * Draws the scene at `time` into ctx, mapping the export region onto a canvas
 * of size region * scale. Mirrors the editor's transform model (rotation around anchor).
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  shapes: BaseShape[],
  animations: Animations,
  time: number,
  region: ExportRegion,
  scale: number,
  images: Map<string, HTMLImageElement>
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = region.background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(-region.x, -region.y);

  shapes.forEach(raw => {
    if (raw.hidden || raw.type === 'group' || raw.type === 'frame') return;
    const shape = getAnimatedShape(raw, time, animations);
    if (shape.opacity <= 0) return;

    const hw = shape.width / 2;
    const hh = shape.height / 2;
    const axOff = (shape.anchorX ?? 0.5) * shape.width;
    const ayOff = (shape.anchorY ?? 0.5) * shape.height;
    const rad = (shape.rotation || 0) * Math.PI / 180;
    const ax = shape.x + hw + (axOff - hw) * Math.cos(rad) - (ayOff - hh) * Math.sin(rad);
    const ay = shape.y + hh + (axOff - hw) * Math.sin(rad) + (ayOff - hh) * Math.cos(rad);

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(rad);
    ctx.globalAlpha = Math.max(0, Math.min(1, shape.opacity));
    ctx.fillStyle = shape.fill;
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = shape.strokeWidth;

    applyShadow(ctx, shape, scale);
    const strokeVisible = applyStrokeStyle(ctx, shape);
    const hasFill = shape.fill && shape.fill !== 'transparent';
    const hasStroke = strokeVisible && shape.strokeWidth > 0 && shape.stroke && shape.stroke !== 'transparent';
    const imgUrl = shape.imageUrl || (shape.type === 'image' ? shape.src : undefined);

    if (shape.type === 'rectangle' || shape.type === 'image') {
      ctx.beginPath();
      const r = Math.max(0, Math.min(shape.radius || 0, Math.abs(shape.width) / 2, Math.abs(shape.height) / 2));
      if (r > 0) ctx.roundRect(-axOff, -ayOff, shape.width, shape.height, r);
      else ctx.rect(-axOff, -ayOff, shape.width, shape.height);
      const img = imgUrl ? images.get(imgUrl) : undefined;
      if (img) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(img, -axOff, -ayOff, shape.width, shape.height);
        ctx.restore();
      } else if (hasFill) {
        ctx.fill();
      }
      if (hasStroke) ctx.stroke();
    } else if (shape.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(hw - axOff, hh - ayOff, Math.abs(hw), Math.abs(hh), 0, 0, Math.PI * 2);
      if (hasFill) ctx.fill();
      if (hasStroke) ctx.stroke();
    } else if (shape.type === 'path' && shape.points && shape.points.length > 0) {
      tracePath(ctx, shape, hw - axOff, hh - ayOff);
      if (hasFill) ctx.fill();
      if (hasStroke) ctx.stroke();
    }
    ctx.restore();
  });

  ctx.restore();
}
