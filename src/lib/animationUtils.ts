import { gsap } from 'gsap';
import { BaseShape, AnimatableProperty, Keyframe, SpringConfig } from '../types';

// Utility to parse hex color to r, g, b
function parseColor(hex: string): { r: number; g: number; b: number } | null {
  if (hex === 'transparent' || !hex) return null;
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Utility to convert r, g, b to hex string
function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = ((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, '0');
  return `#${hex}`;
}

// Map standard CSS / user easing names to GSAP equivalents
export function normalizeEasingName(easing?: string): string {
  if (!easing) return 'power1.out';
  if (easing === 'cubic-bezier' || easing === 'spring') return 'power1.out'; // fallback for GSAP
  switch (easing) {
    case 'ease-in': return 'power2.in';
    case 'ease-out': return 'power2.out';
    case 'ease-in-out': return 'power2.inOut';
    case 'linear': return 'none';
    case 'bounce': return 'bounce.out';
    case 'elastic': return 'elastic.out(1, 0.3)';
    case 'back': return 'back.out(1.7)';
    // Preset names
    case 'smooth': return 'power2.inOut';
    case 'natural': return 'power1.inOut';
    case 'slow-down': return 'power3.out';
    case 'accelerate': return 'power3.in';
    case 'overshoot': return 'back.out(1.7)';
    default: return easing;
  }
}

// ─── CUBIC BEZIER ENGINE ──────────────────────────────────────────────────────
// Solves a cubic bezier at time t using Newton-Raphson iteration
function cubicBezierAt(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function cubicBezierDerivative(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

export function solveCubicBezier(x: number, x1: number, x2: number): number {
  // Find t from x using Newton-Raphson (x axis is time)
  let t = x;
  for (let i = 0; i < 8; i++) {
    const xGuess = cubicBezierAt(t, 0, x1, x2, 1);
    const dx = xGuess - x;
    if (Math.abs(dx) < 1e-6) break;
    const derivative = cubicBezierDerivative(t, 0, x1, x2, 1);
    if (Math.abs(derivative) < 1e-10) break;
    t -= dx / derivative;
    t = Math.max(0, Math.min(1, t));
  }
  return t;
}

export function applyBezierEasing(x: number, bz: [number, number, number, number]): number {
  const [x1, y1, x2, y2] = bz;
  const t = solveCubicBezier(x, x1, x2);
  return cubicBezierAt(t, 0, y1, y2, 1);
}

// ─── SPRING ENGINE ────────────────────────────────────────────────────────────
// Numerically simulates a damped spring for t ∈ [0, 1]
// Returns the position (0→1) at normalized time t
const SPRING_CACHE = new Map<string, Float32Array>();

export function simulateSpring(t: number, spring: SpringConfig): number {
  const { stiffness, damping, mass, velocity } = spring;
  const key = `${stiffness}_${damping}_${mass}_${velocity}`;

  let table = SPRING_CACHE.get(key);
  if (!table) {
    const STEPS = 512;
    table = new Float32Array(STEPS + 1);
    const dt = 0.016; // ~60fps
    const totalFrames = STEPS;
    let pos = 0, vel = velocity / 100;
    const k = stiffness;
    const d = damping;
    const m = Math.max(0.01, mass);
    for (let i = 0; i <= STEPS; i++) {
      table[i] = pos;
      const accel = (-k * (pos - 1) - d * vel) / m;
      vel += accel * dt;
      pos += vel * dt;
    }
    // Normalize so that the final value maps to 1.0
    const finalVal = table[STEPS];
    if (Math.abs(finalVal) > 0.001) {
      for (let i = 0; i <= STEPS; i++) table[i] /= Math.max(0.001, finalVal);
    }
    SPRING_CACHE.set(key, table);
  }

  const idx = Math.min(table.length - 2, Math.floor(t * (table.length - 1)));
  const frac = t * (table.length - 1) - idx;
  return table[idx] + (table[idx + 1] - table[idx]) * frac;
}

export const DEFAULT_SPRING: SpringConfig = { stiffness: 100, damping: 10, mass: 1, velocity: 0 };
export const DEFAULT_BEZIER: [number, number, number, number] = [0.42, 0, 0.58, 1];

/**
 * Generates clean standalone GSAP JavaScript / React code string
 */
export function generateGsapCode(
  shapes: BaseShape[],
  animations: Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>,
  duration: number = 3.0
): string {
  let code = `// GSAP Timeline Animation Code\nimport gsap from 'gsap';\n\n// Create GSAP Timeline\nconst tl = gsap.timeline({\n  repeat: -1,\n  defaults: { duration: ${duration} }\n});\n\n`;

  let hasAnims = false;

  shapes.forEach(shape => {
    const shapeAnims = animations[shape.id];
    if (!shapeAnims) return;
    const targetName = shape.name ? `#${shape.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : `#shape-${shape.id}`;
    
    (Object.keys(shapeAnims) as AnimatableProperty[]).forEach(prop => {
      const keyframes = shapeAnims[prop];
      if (!keyframes || keyframes.length < 2) return;
      hasAnims = true;
      const sorted = [...keyframes].sort((a, b) => a.time - b.time);
      for (let i = 0; i < sorted.length - 1; i++) {
        const k1 = sorted[i];
        const k2 = sorted[i + 1];
        const segDuration = Math.round((k2.time - k1.time) * 100) / 100;
        const ease = normalizeEasingName(k2.easing);
        const formattedVal = typeof k2.value === 'string' ? `'${k2.value}'` : k2.value;
        code += `tl.to("${targetName}", {\n  ${prop}: ${formattedVal},\n  duration: ${segDuration},\n  ease: "${ease}"\n}, ${k1.time});\n\n`;
      }
    });
  });

  if (!hasAnims) {
    code += `// Nenhuma animação gravada ainda nas camadas.\n// Adicione keyframes na Timeline para ver o código GSAP gerado.`;
  }

  return code;
}

// Apply easing curve — supports GSAP, cubic-bezier, and spring
function applyEasing(t: number, kf?: Keyframe): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const easing = kf?.easing;

  // Custom Bezier
  if (easing === 'cubic-bezier' && kf?.bezier) {
    return applyBezierEasing(t, kf.bezier);
  }

  // Spring simulation
  if (easing === 'spring') {
    const springConfig = kf?.spring || DEFAULT_SPRING;
    return simulateSpring(t, springConfig);
  }

  // GSAP easing
  try {
    const gsapEase = normalizeEasingName(easing);
    const parsed = gsap.parseEase(gsapEase);
    if (parsed) return parsed(t);
  } catch (_) {
    // ignore
  }

  return t; // linear fallback
}

/**
 * Creates a native GSAP timeline for playing and controlling keyframed animations
 */
export function buildGsapTimeline(
  shapes: BaseShape[],
  animations: Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>,
  duration: number = 3.0
): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true, duration });

  shapes.forEach(shape => {
    const shapeAnims = animations[shape.id];
    if (!shapeAnims) return;

    const dummyTarget = { ...shape };

    (Object.keys(shapeAnims) as AnimatableProperty[]).forEach(prop => {
      const keyframes = shapeAnims[prop];
      if (!keyframes || keyframes.length < 2) return;

      const sorted = [...keyframes].sort((a, b) => a.time - b.time);
      for (let i = 0; i < sorted.length - 1; i++) {
        const k1 = sorted[i];
        const k2 = sorted[i + 1];
        const segDuration = k2.time - k1.time;
        if (segDuration <= 0) continue;

        const ease = normalizeEasingName(k2.easing);
        tl.to(
          dummyTarget,
          {
            [prop]: k2.value,
            duration: segDuration,
            ease,
          },
          k1.time
        );
      }
    });
  });

  return tl;
}

/**
 * Interpolate value between two keyframes at specified time
 */
export function interpolateKeyframeValue(
  k1: Keyframe,
  k2: Keyframe,
  time: number
): any {
  if (time <= k1.time) return k1.value;
  if (time >= k2.time) return k2.value;

  const rawT = (time - k1.time) / (k2.time - k1.time);
  const t = applyEasing(rawT, k2);

  // Color interpolation
  if (typeof k1.value === 'string' && typeof k2.value === 'string') {
    const c1 = parseColor(k1.value);
    const c2 = parseColor(k2.value);
    if (c1 && c2) {
      const r = c1.r + (c2.r - c1.r) * t;
      const g = c1.g + (c2.g - c1.g) * t;
      const b = c1.b + (c2.b - c1.b) * t;
      return toHex(r, g, b);
    }
    return t < 0.5 ? k1.value : k2.value;
  }

  // Numeric interpolation
  const v1 = Number(k1.value) || 0;
  const v2 = Number(k2.value) || 0;
  return v1 + (v2 - v1) * t;
}

/**
 * Get property value at a specific time given track keyframes
 */
export function getPropertyValueAtTime(
  keyframes: Keyframe[],
  time: number,
  fallbackValue: any
): any {
  if (!keyframes || keyframes.length === 0) return fallbackValue;

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  for (let i = 0; i < sorted.length - 1; i++) {
    const k1 = sorted[i];
    const k2 = sorted[i + 1];
    if (time >= k1.time && time <= k2.time) {
      return interpolateKeyframeValue(k1, k2, time);
    }
  }

  return fallbackValue;
}

/**
 * Evaluates a shape at time `time` by applying all keyframe tracks
 */
export function getAnimatedShape(
  shape: BaseShape,
  time: number,
  animations: Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>
): BaseShape {
  const shapeAnims = animations[shape.id];
  if (!shapeAnims) return shape;

  let hasAnyKeyframe = false;
  const animatedProps: Partial<BaseShape> = {};
  const props: AnimatableProperty[] = ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'fill', 'radius', 'stroke', 'strokeWidth', 'trimStart', 'trimEnd', 'trimOffset', 'arcStart', 'arcSweep', 'arcRatio'];

  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    const kfs = shapeAnims[p];
    if (kfs && kfs.length > 0) {
      hasAnyKeyframe = true;
      const origVal = (shape as any)[p];
      (animatedProps as any)[p] = getPropertyValueAtTime(kfs, time, origVal);
    }
  }

  if (!hasAnyKeyframe) return shape;

  const curved = getCurvedMotionPosition(shapeAnims.x, shapeAnims.y, time);
  if (curved) {
    animatedProps.x = curved.x;
    animatedProps.y = curved.y;
  }

  return {
    ...shape,
    ...animatedProps,
  };
}

const sameTime = (a: number, b: number) => Math.abs(a - b) < 0.02;

/**
 * If `time` falls inside an x/y segment whose end keyframe carries a motion
 * control point, returns the position along that quadratic curve (eased with the x track's easing).
 */
export function getCurvedMotionPosition(
  xKfs: Keyframe[] | undefined,
  yKfs: Keyframe[] | undefined,
  time: number
): { x: number; y: number } | null {
  if (!xKfs || !yKfs || xKfs.length < 2 || yKfs.length < 2) return null;
  const xs = [...xKfs].sort((a, b) => a.time - b.time);
  for (let i = 0; i < xs.length - 1; i++) {
    const k1 = xs[i];
    const k2 = xs[i + 1];
    if (time < k1.time || time > k2.time || !k2.motionCp) continue;
    const y1 = yKfs.find(k => sameTime(k.time, k1.time));
    const y2 = yKfs.find(k => sameTime(k.time, k2.time));
    if (!y1 || !y2) return null;
    const span = k2.time - k1.time;
    const t = span > 0 ? applyEasing((time - k1.time) / span, k2) : 1;
    const mt = 1 - t;
    const c = k2.motionCp;
    return {
      x: mt * mt * Number(k1.value) + 2 * mt * t * c.x + t * t * Number(k2.value),
      y: mt * mt * Number(y1.value) + 2 * mt * t * c.y + t * t * Number(y2.value),
    };
  }
  return null;
}

export interface MotionNode {
  time: number;
  x: number;
  y: number;
}

export interface MotionSegment {
  from: MotionNode;
  to: MotionNode;
  cp: { x: number; y: number } | null; // null = straight
}

/** Position keyframe nodes (union of x/y keyframe times) and the segments between them. */
export function getMotionPathNodes(
  shape: BaseShape,
  animations: Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>
): { nodes: MotionNode[]; segments: MotionSegment[] } | null {
  const anims = animations[shape.id];
  const xKfs = anims?.x || [];
  const yKfs = anims?.y || [];
  if (xKfs.length + yKfs.length === 0) return null;

  const times: number[] = [];
  [...xKfs, ...yKfs].forEach(k => {
    if (!times.some(t => sameTime(t, k.time))) times.push(k.time);
  });
  times.sort((a, b) => a - b);
  if (times.length < 2) return null;

  const nodes = times.map(time => {
    const s = getAnimatedShape(shape, time, animations);
    return { time, x: s.x, y: s.y };
  });
  const segments = nodes.slice(1).map((to, i) => {
    const xEnd = xKfs.find(k => sameTime(k.time, to.time));
    return { from: nodes[i], to, cp: xEnd?.motionCp || null };
  });
  return { nodes, segments };
}

/**
 * Generates preset keyframe animations for a shape
 */
export function generatePresetKeyframes(
  shape: BaseShape,
  preset: string,
  duration: number = 3.0
): Partial<Record<AnimatableProperty, Keyframe[]>> {
  const result: Partial<Record<AnimatableProperty, Keyframe[]>> = {};

  const makeKf = (time: number, value: any, easing: any = 'ease-in-out'): Keyframe => ({
    id: Math.random().toString(36).substring(2, 9),
    time: Math.round(time * 100) / 100,
    value,
    easing,
  });

  const pDuration = Math.min(1, duration);
  const opacity = shape.opacity;
  const rotation = shape.rotation || 0;

  // Scales width/height around the shape center (x/y compensate) so it never grows from a corner
  const scaleAt = (steps: [number, number, string][]) => {
    result.width = steps.map(([t, f, e]) => makeKf(t, shape.width * f, e));
    result.height = steps.map(([t, f, e]) => makeKf(t, shape.height * f, e));
    result.x = steps.map(([t, f, e]) => makeKf(t, shape.x + (shape.width * (1 - f)) / 2, e));
    result.y = steps.map(([t, f, e]) => makeKf(t, shape.y + (shape.height * (1 - f)) / 2, e));
  };
  const fade = (from: number, to: number, end: number, easing = 'power2.out', start = 0) => {
    result.opacity = [makeKf(start, from, easing), makeKf(end, to, easing)];
  };

  switch (preset.toLowerCase()) {
    // ---- Entrada ----
    case 'fade':
    case 'fade in':
      fade(0, opacity, pDuration, 'power1.inOut');
      break;

    case 'slide':
    case 'slide right':
      result.x = [makeKf(0, shape.x - 160, 'expo.out'), makeKf(pDuration, shape.x, 'expo.out')];
      fade(0, opacity, pDuration * 0.6);
      break;

    case 'rise':
    case 'slide up':
      result.y = [makeKf(0, shape.y + 120, 'expo.out'), makeKf(pDuration, shape.y, 'expo.out')];
      fade(0, opacity, pDuration * 0.6);
      break;

    case 'grow':
    case 'scale up':
      scaleAt([[0, 0, 'power3.out'], [pDuration, 1, 'power3.out']]);
      fade(0, opacity, pDuration * 0.5);
      break;

    case 'pop':
    case 'elastic':
      scaleAt([[0, 0.2, 'elastic.out(1, 0.4)'], [pDuration * 1.2, 1, 'elastic.out(1, 0.4)']]);
      fade(0, opacity, pDuration * 0.3);
      break;

    case 'zoom':
      scaleAt([[0, 2.2, 'expo.out'], [pDuration, 1, 'expo.out']]);
      fade(0, opacity, pDuration * 0.5);
      break;

    case 'bounce':
    case 'drop':
      result.y = [makeKf(0, shape.y - 180, 'bounce.out'), makeKf(pDuration * 1.2, shape.y, 'bounce.out')];
      fade(0, opacity, pDuration * 0.3);
      break;

    case 'spin in':
      result.rotation = [makeKf(0, rotation - 180, 'back.out(1.7)'), makeKf(pDuration, rotation, 'back.out(1.7)')];
      scaleAt([[0, 0, 'back.out(1.7)'], [pDuration, 1, 'back.out(1.7)']]);
      break;

    // ---- Ênfase ----
    case 'pulse':
      scaleAt([[0, 1, 'sine.inOut'], [pDuration / 2, 1.15, 'sine.inOut'], [pDuration, 1, 'sine.inOut']]);
      break;

    case 'twist':
    case 'wiggle':
      result.rotation = [
        makeKf(0, rotation, 'sine.inOut'),
        makeKf(pDuration * 0.2, rotation - 12, 'sine.inOut'),
        makeKf(pDuration * 0.4, rotation + 10, 'sine.inOut'),
        makeKf(pDuration * 0.6, rotation - 6, 'sine.inOut'),
        makeKf(pDuration * 0.8, rotation + 3, 'sine.inOut'),
        makeKf(pDuration, rotation, 'sine.inOut'),
      ];
      break;

    case 'spin':
      result.rotation = [makeKf(0, rotation, 'linear'), makeKf(duration, rotation + 360, 'linear')];
      break;

    case 'float':
      result.y = [
        makeKf(0, shape.y, 'sine.inOut'),
        makeKf(duration / 2, shape.y - 24, 'sine.inOut'),
        makeKf(duration, shape.y, 'sine.inOut'),
      ];
      break;

    // ---- Traço (trim path) ----
    case 'draw':
      result.trimStart = [makeKf(0, 0, 'linear')];
      result.trimEnd = [makeKf(0, 0, 'power2.inOut'), makeKf(Math.min(1.5, duration), 100, 'power2.inOut')];
      break;

    case 'erase': {
      const start = Math.max(0, duration - Math.min(1.5, duration));
      result.trimEnd = [makeKf(0, 100, 'linear')];
      result.trimStart = [makeKf(start, 0, 'power2.inOut'), makeKf(duration, 100, 'power2.inOut')];
      break;
    }

    case 'draw erase': {
      const half = duration / 2;
      result.trimEnd = [makeKf(0, 0, 'power2.inOut'), makeKf(half, 100, 'power2.inOut')];
      result.trimStart = [makeKf(half * 0.6, 0, 'power2.inOut'), makeKf(duration, 100, 'power2.inOut')];
      break;
    }

    case 'travel':
      result.trimStart = [makeKf(0, 0, 'linear')];
      result.trimEnd = [makeKf(0, 25, 'linear')];
      result.trimOffset = [makeKf(0, 0, 'linear'), makeKf(duration, 100, 'linear')];
      break;

    // ---- Saída ----
    case 'fade out': {
      const start = Math.max(0, duration - pDuration);
      fade(opacity, 0, duration, 'power1.inOut', start);
      break;
    }

    case 'shrink':
    case 'scale out': {
      const start = Math.max(0, duration - pDuration);
      scaleAt([[start, 1, 'power3.in'], [duration, 0, 'power3.in']]);
      fade(opacity, 0, duration, 'power2.in', start);
      break;
    }

    case 'slide out': {
      const start = Math.max(0, duration - pDuration);
      result.x = [makeKf(start, shape.x, 'expo.in'), makeKf(duration, shape.x + 160, 'expo.in')];
      fade(opacity, 0, duration, 'power2.in', start);
      break;
    }

    default:
      break;
  }

  return result;
}
