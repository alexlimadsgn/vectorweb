import { BaseShape, AnimatableProperty, Keyframe } from '../types';
import { getAnimatedShape } from './animationUtils';
import { getExportRegion } from './renderFrame';
import { hasTrim } from './strokeUtils';
import { getCornerRadii, roundedRectVertices } from './geometry';
import { getArcContours } from './arcUtils';

type Animations = Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>;
type Value = number | number[];

// The animation is sampled at this rate into linear keyframes, so every easing,
// spring and curved motion path plays back exactly as in the editor.
const FPS = 30;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

const hexToRgba = (color: string | undefined): number[] => {
  const hex = (color || '').replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4].map(i => r3(parseInt(hex.slice(i, i + 2), 16) / 255)).concat(1);
  }
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [0, 1, 2].map(i => r3(parseInt(hex[i] + hex[i], 16) / 255)).concat(1);
  }
  return [0, 0, 0, 1];
};

const same = (a: Value, b: Value) =>
  Array.isArray(a) && Array.isArray(b) ? a.every((v, i) => Math.abs(v - b[i]) < 1e-3) : Math.abs((a as number) - (b as number)) < 1e-3;

/**
 * Builds a Lottie property from per-frame samples: static when the value never
 * changes, otherwise linear keyframes (dropping samples that equal both neighbours).
 */
function prop(samples: Value[]): object {
  if (samples.every(v => same(v, samples[0]))) {
    return { a: 0, k: samples[0] };
  }
  const dims = Array.isArray(samples[0]) ? (samples[0] as number[]).length : 1;
  const linear = {
    o: { x: Array(dims).fill(0), y: Array(dims).fill(0) },
    i: { x: Array(dims).fill(1), y: Array(dims).fill(1) },
  };
  const k: object[] = [];
  samples.forEach((v, t) => {
    const isEdge = t === 0 || t === samples.length - 1;
    if (!isEdge && same(v, samples[t - 1]) && same(v, samples[t + 1])) return;
    const s = Array.isArray(v) ? v : [v];
    k.push(t === samples.length - 1 ? { t, s } : { t, s, ...linear });
  });
  return { a: 1, k };
}

const staticProp = (k: Value) => ({ a: 0, k });

const groupTransform = () => ({
  ty: 'tr',
  p: staticProp([0, 0]),
  a: staticProp([0, 0]),
  s: staticProp([100, 100]),
  r: staticProp(0),
  o: staticProp(100),
  sk: staticProp(0),
  sa: staticProp(0),
  nm: 'Transform',
});

/** Geometry at the shape's base size, in the box 0..w0 × 0..h0 (layer anchor maps it). */
function geometry(shape: BaseShape, w0: number, h0: number, radius: object): object | object[] | null {
  if ((shape.type === 'rectangle' || shape.type === 'frame' || shape.type === 'image') && shape.radii) {
    // Different radius per corner: Lottie's rect has a single radius, so emit a bezier path
    const v = roundedRectVertices(w0, h0, getCornerRadii({ ...shape, width: w0, height: h0 }));
    return {
      ty: 'sh', d: 1, nm: 'Retângulo',
      ks: staticProp({ c: true, v: v.map(p => [r3(p.x), r3(p.y)]), i: v.map(p => p.i.map(r3)), o: v.map(p => p.o.map(r3)) } as any),
    };
  }
  if (shape.type === 'rectangle' || shape.type === 'frame' || shape.type === 'image') {
    return { ty: 'rc', d: 1, nm: 'Retângulo', p: staticProp([r3(w0 / 2), r3(h0 / 2)]), s: staticProp([r3(Math.abs(w0)), r3(Math.abs(h0))]), r: radius };
  }
  if (shape.type === 'ellipse') {
    // Arc / pie / ring: one bezier path per contour (rings are filled even-odd)
    const contours = getArcContours(shape, w0, h0);
    if (contours) {
      return contours.map((v, n) => ({
        ty: 'sh', d: 1, nm: `Arco ${n + 1}`,
        ks: staticProp({ c: true, v: v.map(p => [r3(p.x), r3(p.y)]), i: v.map(p => p.i.map(r3)), o: v.map(p => p.o.map(r3)) } as any),
      }));
    }
    return { ty: 'el', d: 1, nm: 'Elipse', p: staticProp([r3(w0 / 2), r3(h0 / 2)]), s: staticProp([r3(Math.abs(w0)), r3(Math.abs(h0))]) };
  }
  if (shape.type === 'path' && shape.points && shape.points.length > 0) {
    // Points are normalized around the center; tangents are relative to their vertex
    const px = (v: number) => r3(v * w0 + w0 / 2);
    const py = (v: number) => r3(v * h0 + h0 / 2);
    const v = shape.points.map(p => [px(p.x), py(p.y)]);
    const i = shape.points.map(p => (p.cp1 ? [r3((p.cp1.x - p.x) * w0), r3((p.cp1.y - p.y) * h0)] : [0, 0]));
    const o = shape.points.map(p => (p.cp2 ? [r3((p.cp2.x - p.x) * w0), r3((p.cp2.y - p.y) * h0)] : [0, 0]));
    return { ty: 'sh', d: 1, nm: 'Caminho', ks: staticProp({ c: !!shape.closed, v, i, o } as any) };
  }
  return null;
}

const CAP = { butt: 1, round: 2, square: 3 } as const;
const JOIN = { miter: 1, round: 2, bevel: 3 } as const;

export function buildLottie(shapes: BaseShape[], animations: Animations, duration: number) {
  const visible = shapes.filter(s => s.type !== 'group' && !s.hidden);
  const region = getExportRegion(visible);
  const totalFrames = Math.max(1, Math.round(duration * FPS));

  const layers = visible.map((shape, index) => {
    const w0 = shape.width || 1;
    const h0 = shape.height || 1;
    const frames = Array.from({ length: totalFrames + 1 }, (_, f) => getAnimatedShape(shape, (f / totalFrames) * duration, animations));

    // Layer transform: translate(anchor in world) · rotate · scale · translate(-anchor in base box)
    const position = frames.map(s => {
      const hw = s.width / 2;
      const hh = s.height / 2;
      const axOff = (s.anchorX ?? 0.5) * s.width;
      const ayOff = (s.anchorY ?? 0.5) * s.height;
      const rad = (s.rotation || 0) * Math.PI / 180;
      const ax = s.x + hw + (axOff - hw) * Math.cos(rad) - (ayOff - hh) * Math.sin(rad);
      const ay = s.y + hh + (axOff - hw) * Math.sin(rad) + (ayOff - hh) * Math.cos(rad);
      return [r3(ax - region.x), r3(ay - region.y)];
    });
    const scale = frames.map(s => [r3((s.width / w0) * 100), r3((s.height / h0) * 100)]);
    const rotation = frames.map(s => r3(s.rotation || 0));
    const opacity = frames.map(s => r3(Math.max(0, Math.min(1, s.opacity)) * 100));

    const radius = prop(frames.map(s => r3(Math.min(s.radius || 0, Math.abs(w0) / 2, Math.abs(h0) / 2))));
    const geo = geometry(shape, w0, h0, radius);
    if (!geo) return null;
    const geoItems = Array.isArray(geo) ? geo : [geo];

    const fills = frames.map(s => s.fill);
    const hasFill = fills.some(f => f && f !== 'transparent');
    const strokes = frames.map(s => (s.stroke && s.stroke !== 'transparent' && s.strokeWidth > 0 ? s.stroke : null));
    const hasStroke = strokes.some(Boolean);

    const anims = animations[shape.id];
    const trimmed = hasTrim(shape) || !!(anims?.trimStart?.length || anims?.trimEnd?.length || anims?.trimOffset?.length);

    const groups: object[] = [];

    if (hasStroke) {
      const items: object[] = [...geoItems];
      if (trimmed) {
        items.push({
          ty: 'tm',
          nm: 'Trim',
          m: 1,
          s: prop(frames.map(s => r3(Math.max(0, Math.min(100, s.trimStart ?? 0))))),
          e: prop(frames.map(s => r3(Math.max(0, Math.min(100, s.trimEnd ?? 100))))),
          o: prop(frames.map(s => r3((s.trimOffset ?? 0) * 3.6))), // % → degrees
        });
      }
      const dash = shape.strokeDash || 0;
      items.push({
        ty: 'st',
        nm: 'Contorno',
        c: prop(strokes.map((c, f) => hexToRgba(c || frames[f].stroke))),
        o: prop(strokes.map(c => (c ? 100 : 0))),
        w: prop(frames.map(s => r3(s.strokeWidth || 0))),
        lc: CAP[shape.strokeCap || (shape.type === 'path' ? 'round' : 'butt')],
        lj: JOIN[shape.strokeJoin || (shape.type === 'path' ? 'round' : 'miter')],
        ml: 4,
        ...(dash > 0 && !trimmed
          ? { d: [
              { n: 'd', nm: 'dash', v: staticProp(dash) },
              { n: 'g', nm: 'gap', v: staticProp(shape.strokeGap ?? dash) },
              { n: 'o', nm: 'offset', v: staticProp(0) },
            ] }
          : {}),
      });
      items.push(groupTransform());
      groups.push({ ty: 'gr', nm: 'Contorno', it: items });
    }

    // Fill lives in its own group so trim only cuts the stroke (as in the editor)
    if (hasFill) {
      groups.push({
        ty: 'gr',
        nm: 'Preenchimento',
        it: [
          ...geoItems,
          {
            ty: 'fl',
            nm: 'Preenchimento',
            c: prop(fills.map(f => hexToRgba(f && f !== 'transparent' ? f : '#000000'))),
            o: prop(fills.map(f => (f && f !== 'transparent' ? 100 : 0))),
            r: geoItems.length > 1 ? 2 : 1, // even-odd for rings
          },
          groupTransform(),
        ],
      });
    }

    if (groups.length === 0) return null;

    return {
      ddd: 0,
      ind: index + 1,
      ty: 4,
      nm: shape.name || `${shape.type} ${shape.id.slice(0, 4)}`,
      sr: 1,
      ks: {
        o: prop(opacity),
        r: prop(rotation),
        p: prop(position),
        a: staticProp([r3((shape.anchorX ?? 0.5) * w0), r3((shape.anchorY ?? 0.5) * h0)]),
        s: prop(scale),
      },
      ao: 0,
      shapes: groups,
      ip: 0,
      op: totalFrames,
      st: 0,
      bm: 0,
    };
  }).filter(Boolean) as object[];

  // Lottie draws the first layer on top; the editor draws the last shape on top
  layers.reverse().forEach((layer: any, i) => { layer.ind = i + 1; });

  return {
    v: '5.7.4',
    fr: FPS,
    ip: 0,
    op: totalFrames,
    w: Math.round(region.width),
    h: Math.round(region.height),
    nm: 'VectorWeb',
    ddd: 0,
    assets: [],
    layers,
    meta: { g: 'VectorWeb' },
  };
}

export function exportLottie(shapes: BaseShape[], animations: Animations, duration: number) {
  const json = JSON.stringify(buildLottie(shapes, animations, duration));
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vectorweb-lottie-${Date.now().toString(36)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
