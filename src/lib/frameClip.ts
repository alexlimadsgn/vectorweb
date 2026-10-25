import { BaseShape, AnimatableProperty, Keyframe } from '../types';
import { getAnimatedShape } from './animationUtils';
import { getCornerRadii, hasCornerRadius } from './geometry';

type Animations = Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>;

/** Frames default to clipping their content, like in Figma. */
export const framesClip = (frame: BaseShape) => frame.type === 'frame' && frame.clipContent !== false;

/**
 * Intersects the current clip with every ancestor frame that clips its content,
 * so children are cut at the frame bounds (respecting rotation and corner radius).
 * Call between ctx.save() and ctx.restore().
 */
export function clipToAncestorFrames(
  ctx: CanvasRenderingContext2D,
  shape: BaseShape,
  shapes: BaseShape[],
  time: number,
  animations: Animations
) {
  let parentId = shape.groupId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const raw = shapes.find(s => s.id === parentId);
    if (!raw) break;
    if (framesClip(raw)) {
      const f = getAnimatedShape(raw, time, animations);
      const hw = f.width / 2;
      const hh = f.height / 2;
      const axOff = (f.anchorX ?? 0.5) * f.width;
      const ayOff = (f.anchorY ?? 0.5) * f.height;
      const rad = (f.rotation || 0) * Math.PI / 180;
      const ax = f.x + hw + (axOff - hw) * Math.cos(rad) - (ayOff - hh) * Math.sin(rad);
      const ay = f.y + hh + (axOff - hw) * Math.sin(rad) + (ayOff - hh) * Math.cos(rad);

      ctx.translate(ax, ay);
      ctx.rotate(rad);
      ctx.beginPath();
      const radii = getCornerRadii(f);
      if (hasCornerRadius(radii)) ctx.roundRect(-axOff, -ayOff, f.width, f.height, radii);
      else ctx.rect(-axOff, -ayOff, f.width, f.height);
      ctx.clip();
      ctx.rotate(-rad);
      ctx.translate(-ax, -ay);
    }
    parentId = raw.groupId;
  }
}
