import { BaseShape } from '../types';

/** Bézier vertex: position plus in/out tangents relative to it (same layout Lottie uses). */
export interface ArcVertex {
  x: number;
  y: number;
  i: [number, number];
  o: [number, number];
}

const DEG = Math.PI / 180;

export const arcParams = (shape: BaseShape) => ({
  start: shape.arcStart ?? 0,                                   // degrees, clockwise from 3 o'clock
  sweep: Math.max(-100, Math.min(100, shape.arcSweep ?? 100)),  // % of a full turn (negative = counter-clockwise)
  ratio: Math.max(0, Math.min(99, shape.arcRatio ?? 0)),        // inner radius, % of the outer one
});

/** True when the ellipse is a plain full ellipse (no sweep cut and no hole). */
export const isPlainEllipse = (shape: BaseShape) => {
  const { sweep, ratio } = arcParams(shape);
  return Math.abs(sweep) >= 100 && ratio <= 0;
};

/** Open elliptical arc as cubic Bézier vertices (≤90° per segment). */
function arcVertices(cx: number, cy: number, rx: number, ry: number, a0: number, sweepRad: number): ArcVertex[] {
  const n = Math.max(1, Math.ceil(Math.abs(sweepRad) / (Math.PI / 2) - 1e-9));
  const d = sweepRad / n;
  const k = (4 / 3) * Math.tan(d / 4);
  const verts: ArcVertex[] = [];
  for (let j = 0; j <= n; j++) {
    const a = a0 + j * d;
    const tx = -rx * Math.sin(a) * k;
    const ty = ry * Math.cos(a) * k;
    verts.push({
      x: cx + rx * Math.cos(a),
      y: cy + ry * Math.sin(a),
      i: j > 0 ? [-tx, -ty] : [0, 0],
      o: j < n ? [tx, ty] : [0, 0],
    });
  }
  return verts;
}

/** Closes a full-turn arc: drop the duplicated end vertex and carry its in-tangent to the start. */
const closeLoop = (v: ArcVertex[]) => {
  const last = v.pop()!;
  v[0] = { ...v[0], i: last.i };
  return v;
};

/**
 * Closed contours of an ellipse arc / pie / ring inside the box 0..w × 0..h.
 * Returns null for a plain ellipse. Rings (full sweep with a hole) have two
 * contours and must be filled with the even-odd rule.
 */
export function getArcContours(shape: BaseShape, w: number, h: number): ArcVertex[][] | null {
  if (isPlainEllipse(shape)) return null;
  const { start, sweep, ratio } = arcParams(shape);
  const cx = w / 2, cy = h / 2, rx = Math.abs(w / 2), ry = Math.abs(h / 2);
  const r = ratio / 100;
  const a0 = start * DEG;
  const s = (sweep / 100) * 2 * Math.PI;

  if (Math.abs(sweep) >= 100) {
    // Full ring: outer loop plus inner loop in the opposite direction
    const outer = closeLoop(arcVertices(cx, cy, rx, ry, a0, 2 * Math.PI));
    const inner = closeLoop(arcVertices(cx, cy, rx * r, ry * r, a0 + 2 * Math.PI, -2 * Math.PI));
    return [outer, inner];
  }
  if (Math.abs(s) < 1e-6) return [];

  const outer = arcVertices(cx, cy, rx, ry, a0, s);
  const back: ArcVertex[] = r > 0
    ? arcVertices(cx, cy, rx * r, ry * r, a0 + s, -s)
    : [{ x: cx, y: cy, i: [0, 0], o: [0, 0] }];
  return [[...outer, ...back]];
}

/** Adds the contours to a canvas path (offset moves the box origin). */
export function traceArcContours(p: CanvasRenderingContext2D | Path2D, contours: ArcVertex[][], offX = 0, offY = 0) {
  contours.forEach(c => {
    if (c.length === 0) return;
    p.moveTo(c[0].x + offX, c[0].y + offY);
    for (let k = 0; k < c.length; k++) {
      const a = c[k];
      const b = c[(k + 1) % c.length];
      p.bezierCurveTo(a.x + a.o[0] + offX, a.y + a.o[1] + offY, b.x + b.i[0] + offX, b.y + b.i[1] + offY, b.x + offX, b.y + offY);
    }
    p.closePath();
  });
}

/** SVG path data for the contours. */
export function arcContoursToSvgPath(contours: ArcVertex[][], fmt: (n: number) => number = n => n): string {
  return contours.map(c => {
    if (c.length === 0) return '';
    let d = `M ${fmt(c[0].x)} ${fmt(c[0].y)}`;
    for (let k = 0; k < c.length; k++) {
      const a = c[k];
      const b = c[(k + 1) % c.length];
      d += ` C ${fmt(a.x + a.o[0])} ${fmt(a.y + a.o[1])}, ${fmt(b.x + b.i[0])} ${fmt(b.y + b.i[1])}, ${fmt(b.x)} ${fmt(b.y)}`;
    }
    return d + ' Z';
  }).join(' ');
}

/** Approximate outline length of the contours (for trim paths). */
export function arcContoursLength(contours: ArcVertex[][]): number {
  let len = 0;
  contours.forEach(c => {
    for (let k = 0; k < c.length; k++) {
      const a = c[k];
      const b = c[(k + 1) % c.length];
      const p = [a.x, a.y, a.x + a.o[0], a.y + a.o[1], b.x + b.i[0], b.y + b.i[1], b.x, b.y];
      let px = p[0], py = p[1];
      for (let t = 1; t <= 12; t++) {
        const u = t / 12, m = 1 - u;
        const x = m * m * m * p[0] + 3 * m * m * u * p[2] + 3 * m * u * u * p[4] + u * u * u * p[6];
        const y = m * m * m * p[1] + 3 * m * m * u * p[3] + 3 * m * u * u * p[5] + u * u * u * p[7];
        len += Math.hypot(x - px, y - py);
        px = x; py = y;
      }
    }
  });
  return len;
}
