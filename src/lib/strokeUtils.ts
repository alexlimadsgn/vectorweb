import { BaseShape, PathPoint } from '../types';
import { getCornerRadii } from './geometry';
import { getArcContours, arcContoursLength } from './arcUtils';

const cubicLength = (
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
  steps = 16
) => {
  let len = 0;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
    const y = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
    len += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return len;
};

/** Total stroke length of a shape in world units (used to map trim % to dash lengths). */
export function getStrokeLength(shape: BaseShape): number {
  const w = Math.abs(shape.width);
  const h = Math.abs(shape.height);
  if (shape.type === 'rectangle' || shape.type === 'frame' || shape.type === 'image') {
    // Each rounded corner replaces 2r of straight edge with a quarter arc
    const corners = getCornerRadii(shape).reduce((sum, r) => sum + (2 - Math.PI / 2) * r, 0);
    return 2 * (w + h) - corners;
  }
  if (shape.type === 'ellipse') {
    const contours = getArcContours(shape, shape.width, shape.height);
    if (contours) return arcContoursLength(contours);
    const a = w / 2;
    const b = h / 2;
    // Ramanujan's approximation
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  }
  if (shape.type === 'path' && shape.points && shape.points.length > 1) {
    const pts = shape.points;
    const sx = shape.width;
    const sy = shape.height;
    const seg = (p: PathPoint, q: PathPoint) => {
      const c1 = p.cp2 || p;
      const c2 = q.cp1 || q;
      return cubicLength(p.x * sx, p.y * sy, c1.x * sx, c1.y * sy, c2.x * sx, c2.y * sy, q.x * sx, q.y * sy);
    };
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += seg(pts[i - 1], pts[i]);
    if (shape.closed && pts.length > 2) len += seg(pts[pts.length - 1], pts[0]);
    return len;
  }
  return 0;
}

export const hasTrim = (shape: BaseShape) =>
  (shape.trimStart ?? 0) > 0 || (shape.trimEnd ?? 100) < 100 || (shape.trimOffset ?? 0) !== 0;

/**
 * Applies line cap/join, dash pattern and trim path to ctx.
 * Returns false when the trim hides the whole stroke (caller should skip stroking).
 */
export function applyStrokeStyle(ctx: CanvasRenderingContext2D, shape: BaseShape): boolean {
  ctx.lineCap = shape.strokeCap || (shape.type === 'path' ? 'round' : 'butt');
  ctx.lineJoin = shape.strokeJoin || (shape.type === 'path' ? 'round' : 'miter');

  if (hasTrim(shape)) {
    const length = getStrokeLength(shape);
    const start = Math.max(0, Math.min(100, shape.trimStart ?? 0));
    const end = Math.max(0, Math.min(100, shape.trimEnd ?? 100));
    const visible = (Math.max(0, end - start) / 100) * length;
    if (visible <= 0.01) return false;
    if (visible >= length - 0.01) {
      ctx.setLineDash([]);
      return true;
    }
    // One dash cycle = full length, so the offset wraps around closed shapes naturally
    const offset = (((start + (shape.trimOffset ?? 0)) % 100) + 100) % 100;
    ctx.setLineDash([visible, length - visible]);
    ctx.lineDashOffset = -(offset / 100) * length;
    return true;
  }

  const dash = shape.strokeDash || 0;
  if (dash > 0) {
    ctx.setLineDash([dash, shape.strokeGap ?? dash]);
    ctx.lineDashOffset = 0;
  } else {
    ctx.setLineDash([]);
  }
  return true;
}

/** Drop shadow; `pxScale` converts world units to device pixels (shadows ignore the ctx transform). */
export function applyShadow(ctx: CanvasRenderingContext2D, shape: BaseShape, pxScale: number) {
  if (!shape.shadowColor || shape.shadowColor === 'transparent') return;
  const alpha = Math.max(0, Math.min(100, shape.shadowOpacity ?? 100)) / 100;
  const hex = shape.shadowColor.replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else {
    ctx.shadowColor = shape.shadowColor;
  }
  ctx.shadowBlur = (shape.shadowBlur ?? 0) * pxScale;
  ctx.shadowOffsetX = (shape.shadowX ?? 0) * pxScale;
  ctx.shadowOffsetY = (shape.shadowY ?? 0) * pxScale;
}
