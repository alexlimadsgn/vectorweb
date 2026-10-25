import { BaseShape, AnimatableProperty, Keyframe } from '../types';
import { getAnimatedShape } from './animationUtils';
import { getExportRegion } from './renderFrame';
import { hasTrim } from './strokeUtils';
import { getCornerRadii, roundedRectVertices } from './geometry';

type Animations = Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>;

// Animation is sampled at this rate into CSS keyframes, so easing, springs,
// curved motion paths and trim all match the editor exactly.
const SAMPLE_FPS = 30;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Geometry of the shape at its base (un-animated) size, drawn in the box 0..w0 × 0..h0. */
function geometryElement(shape: BaseShape, w0: number, h0: number, pathLength: string): string {
  const imgUrl = shape.imageUrl || (shape.type === 'image' ? shape.src : undefined);
  if (imgUrl) {
    return `<image href="${escapeAttr(imgUrl)}" width="${r3(w0)}" height="${r3(h0)}" preserveAspectRatio="none" />`;
  }
  if (shape.type === 'rectangle' || shape.type === 'frame') {
    const radii = getCornerRadii({ ...shape, width: w0, height: h0 });
    if (radii.every(r => r === radii[0])) {
      const rAttr = radii[0] > 0 ? ` rx="${r3(radii[0])}" ry="${r3(radii[0])}"` : '';
      return `<rect width="${r3(w0)}" height="${r3(h0)}"${rAttr}${pathLength} />`;
    }
    // Different radius per corner: draw as a path of Bézier arcs
    const v = roundedRectVertices(w0, h0, radii);
    let d = `M ${r3(v[0].x)} ${r3(v[0].y)}`;
    for (let k = 0; k < v.length; k++) {
      const a = v[k];
      const b = v[(k + 1) % v.length];
      d += ` C ${r3(a.x + a.o[0])} ${r3(a.y + a.o[1])}, ${r3(b.x + b.i[0])} ${r3(b.y + b.i[1])}, ${r3(b.x)} ${r3(b.y)}`;
    }
    return `<path d="${d} Z"${pathLength} />`;
  }
  if (shape.type === 'ellipse') {
    return `<ellipse cx="${r3(w0 / 2)}" cy="${r3(h0 / 2)}" rx="${r3(Math.abs(w0 / 2))}" ry="${r3(Math.abs(h0 / 2))}"${pathLength} />`;
  }
  if (shape.type === 'path' && shape.points && shape.points.length > 0) {
    // Points are normalized around the center
    const px = (v: number) => r3(v * w0 + w0 / 2);
    const py = (v: number) => r3(v * h0 + h0 / 2);
    const pts = shape.points;
    const seg = (prev: typeof pts[0], curr: typeof pts[0]) => {
      if (prev.cp2 || curr.cp1) {
        const c1 = prev.cp2 || prev;
        const c2 = curr.cp1 || curr;
        return ` C ${px(c1.x)} ${py(c1.y)}, ${px(c2.x)} ${py(c2.y)}, ${px(curr.x)} ${py(curr.y)}`;
      }
      return ` L ${px(curr.x)} ${py(curr.y)}`;
    };
    let d = `M ${px(pts[0].x)} ${py(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) d += seg(pts[i - 1], pts[i]);
    if (shape.closed && pts.length > 2) d += seg(pts[pts.length - 1], pts[0]) + ' Z';
    return `<path d="${d}"${pathLength} />`;
  }
  return '';
}

/** Transform mapping the base geometry box to the shape's state (position, anchor rotation, size). */
function transformFor(s: BaseShape, w0: number, h0: number): string {
  const hw = s.width / 2;
  const hh = s.height / 2;
  const axOff = (s.anchorX ?? 0.5) * s.width;
  const ayOff = (s.anchorY ?? 0.5) * s.height;
  const rad = (s.rotation || 0) * Math.PI / 180;
  const ax = s.x + hw + (axOff - hw) * Math.cos(rad) - (ayOff - hh) * Math.sin(rad);
  const ay = s.y + hh + (axOff - hw) * Math.sin(rad) + (ayOff - hh) * Math.cos(rad);
  const sx = w0 !== 0 ? s.width / w0 : 1;
  const sy = h0 !== 0 ? s.height / h0 : 1;
  let t = `translate(${r3(ax)}px, ${r3(ay)}px)`;
  if (s.rotation) t += ` rotate(${r3(s.rotation)}deg)`;
  t += ` translate(${r3(-axOff)}px, ${r3(-ayOff)}px)`;
  if (Math.abs(sx - 1) > 1e-4 || Math.abs(sy - 1) > 1e-4) t += ` scale(${r3(sx)}, ${r3(sy)})`;
  return t;
}

/** Paint-related CSS for a shape state (trim uses pathLength="100"). */
function paintFor(s: BaseShape, trimmed: boolean): Record<string, string> {
  const css: Record<string, string> = {
    opacity: String(r3(s.opacity)),
    fill: s.fill && s.fill !== 'transparent' ? s.fill : 'none',
    stroke: s.stroke && s.stroke !== 'transparent' && s.strokeWidth > 0 ? s.stroke : 'none',
    'stroke-width': String(r3(s.strokeWidth || 0)),
  };
  if (trimmed) {
    const start = Math.max(0, Math.min(100, s.trimStart ?? 0));
    const end = Math.max(0, Math.min(100, s.trimEnd ?? 100));
    const visible = Math.max(0, end - start);
    const offset = (((start + (s.trimOffset ?? 0)) % 100) + 100) % 100;
    css['stroke-dasharray'] = `${r3(visible)} ${r3(100 - visible + 0.001)}`;
    css['stroke-dashoffset'] = String(r3(-offset));
  }
  return css;
}

/**
 * Generates an animated SVG (CSS keyframes) and downloads it.
 */
export function exportAnimatedSvg(
  shapes: BaseShape[],
  animations: Animations,
  duration: number = 3.0,
  isLooping: boolean = true,
  selectedOnly: boolean = false,
  selectedIds: string[] = []
): void {
  let shapesToExport = shapes;
  if (selectedOnly && selectedIds.length > 0) {
    const exportIds = new Set(selectedIds);
    shapes.forEach((s) => {
      if (s.groupId && exportIds.has(s.groupId)) exportIds.add(s.id);
    });
    shapesToExport = shapes.filter((s) => exportIds.has(s.id));
  }
  shapesToExport = shapesToExport.filter(s => s.type !== 'group' && !s.hidden);
  if (shapesToExport.length === 0) return;

  const region = getExportRegion(shapesToExport);
  const frameCount = Math.max(1, Math.round(duration * SAMPLE_FPS));
  const iteration = isLooping ? 'infinite' : '1';

  let css = '';
  let body = '';

  shapesToExport.forEach((shape) => {
    const id = `vw-${shape.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const anims = animations[shape.id];
    const isAnimated = !!anims && Object.values(anims).some(kfs => kfs && kfs.length > 0);
    const w0 = shape.width || 1;
    const h0 = shape.height || 1;

    // Trim needs dash styling for the whole animation if it is used at any point
    const trimAnimated = !!(anims?.trimStart?.length || anims?.trimEnd?.length || anims?.trimOffset?.length);
    const trimmed = hasTrim(shape) || trimAnimated;
    const pathLength = trimmed ? ' pathLength="100"' : '';

    const geometry = geometryElement(shape, w0, h0, pathLength);
    if (!geometry) return;

    const base = getAnimatedShape(shape, 0, animations);
    const basePaint = paintFor(base, trimmed);

    const styleAttrs = [
      `transform: ${transformFor(base, w0, h0)}`,
      'transform-origin: 0 0',
      ...Object.entries(basePaint).map(([k, v]) => `${k}: ${v}`),
    ];
    if (!trimmed && shape.strokeDash && shape.strokeDash > 0) {
      styleAttrs.push(`stroke-dasharray: ${shape.strokeDash} ${shape.strokeGap ?? shape.strokeDash}`);
    }
    const cap = shape.strokeCap || (shape.type === 'path' ? 'round' : 'butt');
    const join = shape.strokeJoin || (shape.type === 'path' ? 'round' : 'miter');
    styleAttrs.push(`stroke-linecap: ${cap}`, `stroke-linejoin: ${join}`);
    if (shape.shadowColor && shape.shadowColor !== 'transparent') {
      const hex = shape.shadowColor.replace('#', '');
      const alpha = (shape.shadowOpacity ?? 100) / 100;
      const color = /^[0-9a-f]{6}$/i.test(hex)
        ? `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${alpha})`
        : shape.shadowColor;
      styleAttrs.push(`filter: drop-shadow(${shape.shadowX ?? 0}px ${shape.shadowY ?? 0}px ${(shape.shadowBlur ?? 0) / 2}px ${color})`);
    }

    if (isAnimated) {
      // Only emit properties that actually change, to keep the file small
      const samples = Array.from({ length: frameCount + 1 }, (_, i) => {
        const t = (i / frameCount) * duration;
        const s = getAnimatedShape(shape, t, animations);
        return { pct: (i / frameCount) * 100, transform: transformFor(s, w0, h0), paint: paintFor(s, trimmed) };
      });
      const changing = new Set<string>();
      if (samples.some(s => s.transform !== samples[0].transform)) changing.add('transform');
      Object.keys(basePaint).forEach(k => {
        if (samples.some(s => s.paint[k] !== samples[0].paint[k])) changing.add(k);
      });

      if (changing.size > 0) {
        css += `@keyframes ${id} {\n`;
        samples.forEach(s => {
          const decl: string[] = [];
          if (changing.has('transform')) decl.push(`transform: ${s.transform}`);
          changing.forEach(k => { if (k !== 'transform') decl.push(`${k}: ${s.paint[k]}`); });
          css += `  ${r3(s.pct)}% { ${decl.join('; ')} }\n`;
        });
        css += `}\n`;
        css += `#${id} { animation: ${id} ${duration}s linear ${iteration} both; }\n`;
      }
    }

    body += `  <g id="${id}" style="${escapeAttr(styleAttrs.join('; '))}">\n    ${geometry}\n  </g>\n`;
  });

  const w = r3(region.width);
  const h = r3(region.height);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r3(region.x)} ${r3(region.y)} ${w} ${h}" width="${w}" height="${h}">\n`;
  svg += `  <!-- Created with VectorWeb -->\n`;
  if (css) svg += `  <style>\n${css}  </style>\n`;
  svg += body;
  svg += `</svg>\n`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vectorweb-animado-${Date.now().toString(36)}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
