import { PathPoint } from '../types';

type Pt = { x: number; y: number };

const distToSegment = (p: Pt, a: Pt, b: Pt) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/** Ramer–Douglas–Peucker simplification of a freehand polyline. */
export function simplifyPoints(points: Pt[], tolerance: number): Pt[] {
  if (points.length <= 2) return points.slice();
  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= tolerance) return [first, last];
  const left = simplifyPoints(points.slice(0, index + 1), tolerance);
  const right = simplifyPoints(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/**
 * Converts a polyline into smooth cubic Bézier nodes (Catmull-Rom → Bézier),
 * so freehand strokes render as fluid curves instead of jagged segments.
 */
export function smoothToBezier(points: Pt[], closed: boolean, tension = 1 / 6): PathPoint[] {
  const n = points.length;
  if (n < 3) return points.map(p => ({ x: p.x, y: p.y }));
  return points.map((p, i) => {
    const prev = closed ? points[(i - 1 + n) % n] : points[Math.max(0, i - 1)];
    const next = closed ? points[(i + 1) % n] : points[Math.min(n - 1, i + 1)];
    const tx = (next.x - prev.x) * tension;
    const ty = (next.y - prev.y) * tension;
    const isEndpoint = !closed && (i === 0 || i === n - 1);
    return {
      x: p.x,
      y: p.y,
      cp1: isEndpoint && i === 0 ? undefined : { x: p.x - tx, y: p.y - ty },
      cp2: isEndpoint && i === n - 1 ? undefined : { x: p.x + tx, y: p.y + ty },
      pointType: 'smooth' as const,
    };
  });
}
