import { BaseShape, AnimatableProperty, Keyframe } from '../types';
import { getPropertyValueAtTime } from './animationUtils';

/**
 * Generates an animated SVG string and downloads it.
 */
export function exportAnimatedSvg(
  shapes: BaseShape[],
  animations: Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>,
  duration: number = 3.0,
  isLooping: boolean = true,
  selectedOnly: boolean = false,
  selectedIds: string[] = []
): void {
  let shapesToExport = shapes;
  if (selectedOnly && selectedIds.length > 0) {
    const exportIds = [...selectedIds];
    shapes.forEach((s) => {
      if (s.groupId && selectedIds.includes(s.groupId)) {
        exportIds.push(s.id);
      }
    });
    shapesToExport = shapes.filter((s) => exportIds.includes(s.id));
  }

  if (shapesToExport.length === 0) return;

  // Check if a Frame exists to serve as the SVG page/container
  const frame = shapesToExport.find(s => s.type === 'frame');
  let minX = 0, minY = 0, width = 800, height = 600;

  if (frame) {
    minX = frame.x;
    minY = frame.y;
    width = Math.abs(frame.width) || 800;
    height = Math.abs(frame.height) || 600;
  } else {
    // Compute bounding box
    let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
    shapesToExport.forEach((s) => {
      if (s.type === 'group') return;
      const x1 = s.x;
      const y1 = s.y;
      const x2 = x1 + Math.abs(s.width);
      const y2 = y1 + Math.abs(s.height);
      if (x1 < bMinX) bMinX = x1;
      if (y1 < bMinY) bMinY = y1;
      if (x2 > bMaxX) bMaxX = x2;
      if (y2 > bMaxY) bMaxY = x2;
    });
    if (bMinX !== Infinity) {
      minX = bMinX;
      minY = bMinY;
      width = Math.max(100, bMaxX - bMinX);
      height = Math.max(100, bMaxY - bMinY);
    }
  }

  const viewL = `${minX} ${minY} ${width} ${height}`;

  const repeatCount = isLooping ? 'indefinite' : '1';

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewL}" width="${width}" height="${height}">\n`;
  svgContent += `  <style>\n`;
  svgContent += `    /* VectorWeb Animated Export */\n`;

  // Build CSS @keyframes for each shape that has animated properties
  shapesToExport.forEach((shape) => {
    if (shape.type === 'group' || shape.hidden) return;
    const shapeAnims = animations[shape.id];
    if (!shapeAnims) return;

    const shapeCssId = `vw-shape-${shape.id}`;
    
    // Check if we have keyframes
    const hasAnims = Object.values(shapeAnims).some((kfs) => kfs && kfs.length > 0);
    if (!hasAnims) return;

    // Collect all time steps across properties
    const timeSet = new Set<number>([0, duration]);
    Object.values(shapeAnims).forEach((kfs) => {
      kfs?.forEach((kf) => timeSet.add(kf.time));
    });
    const timeSteps = Array.from(timeSet).sort((a, b) => a - b);

    svgContent += `    @keyframes anim-${shapeCssId} {\n`;
    timeSteps.forEach((time) => {
      const pct = Math.min(100, Math.max(0, Math.round((time / duration) * 100)));
      
      const posX = getPropertyValueAtTime(shapeAnims.x || [], time, shape.x);
      const posY = getPropertyValueAtTime(shapeAnims.y || [], time, shape.y);
      const rot = getPropertyValueAtTime(shapeAnims.rotation || [], time, shape.rotation || 0);
      const w = getPropertyValueAtTime(shapeAnims.width || [], time, shape.width);
      const h = getPropertyValueAtTime(shapeAnims.height || [], time, shape.height);
      const op = getPropertyValueAtTime(shapeAnims.opacity || [], time, shape.opacity);
      const fillVal = getPropertyValueAtTime(shapeAnims.fill || [], time, shape.fill);

      const cx = Math.abs(w) / 2;
      const cy = Math.abs(h) / 2;

      svgContent += `      ${pct}% {\n`;
      svgContent += `        transform: translate(${posX}px, ${posY}px) rotate(${rot}deg);\n`;
      svgContent += `        transform-origin: ${cx}px ${cy}px;\n`;
      svgContent += `        opacity: ${op};\n`;
      if (fillVal && fillVal !== 'transparent') {
        svgContent += `        fill: ${fillVal};\n`;
      }
      svgContent += `      }\n`;
    });
    svgContent += `    }\n`;

    svgContent += `    #${shapeCssId} {\n`;
    svgContent += `      animation: anim-${shapeCssId} ${duration}s ${isLooping ? 'infinite' : '1'} linear;\n`;
    svgContent += `    }\n`;
  });

  svgContent += `  </style>\n\n`;

  // Render SVG Elements
  shapesToExport.forEach((shape) => {
    if (shape.type === 'group' || shape.hidden) return;

    const shapeCssId = `vw-shape-${shape.id}`;
    const shapeAnims = animations[shape.id];
    
    let attrs = `id="${shapeCssId}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" opacity="${shape.opacity}"`;

    const svgWidth = Math.abs(shape.width || 0);
    const svgHeight = Math.abs(shape.height || 0);
    const svgX = shape.width < 0 ? shape.x + shape.width : shape.x;
    const svgY = shape.height < 0 ? shape.y + shape.height : shape.y;

    let transform = `translate(${svgX}, ${svgY})`;
    if (shape.rotation) {
      transform += ` rotate(${shape.rotation}, ${svgWidth / 2}, ${svgHeight / 2})`;
    }
    attrs += ` transform="${transform}"`;

    let elementStr = '';

    if (shape.type === 'rectangle' || shape.type === 'frame') {
      const radAttr = shape.radius ? ` rx="${shape.radius}" ry="${shape.radius}"` : '';
      if (shape.imageUrl) {
        elementStr = `<image href="${shape.imageUrl}" width="${svgWidth}" height="${svgHeight}" ${attrs} />`;
      } else {
        elementStr = `<rect width="${svgWidth}" height="${svgHeight}"${radAttr} ${attrs}>`;
      }
    } else if (shape.type === 'ellipse') {
      const rx = svgWidth / 2;
      const ry = svgHeight / 2;
      elementStr = `<ellipse cx="${rx}" cy="${ry}" rx="${rx}" ry="${ry}" ${attrs}>`;
    } else if (shape.type === 'path' && shape.points && shape.points.length > 0) {
      let d = `M ${shape.points[0].x * svgWidth} ${shape.points[0].y * svgHeight}`;
      for (let i = 1; i < shape.points.length; i++) {
        const prev = shape.points[i - 1];
        const curr = shape.points[i];
        const endX = curr.x * svgWidth;
        const endY = curr.y * svgHeight;

        if (prev.cp2 || curr.cp1) {
          const cp1x = (prev.cp2 ? prev.cp2.x : prev.x) * svgWidth;
          const cp1y = (prev.cp2 ? prev.cp2.y : prev.y) * svgHeight;
          const cp2x = (curr.cp1 ? curr.cp1.x : curr.x) * svgWidth;
          const cp2y = (curr.cp1 ? curr.cp1.y : curr.y) * svgHeight;
          d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
        } else {
          d += ` L ${endX} ${endY}`;
        }
      }
      if (shape.closed) {
        d += ' Z';
      }
      elementStr = `<path d="${d}" ${attrs}>`;
    }

    // Add SMIL fallback animations inside the tag for maximum compatibility across browsers & SVG renderers
    if (shapeAnims && elementStr.endsWith('>')) {
      const smilList: string[] = [];

      if (shapeAnims.opacity && shapeAnims.opacity.length > 1) {
        const sorted = [...shapeAnims.opacity].sort((a, b) => a.time - b.time);
        const values = sorted.map((k) => k.value).join(';');
        const keyTimes = sorted.map((k) => (k.time / duration).toFixed(3)).join(';');
        smilList.push(`\n    <animate attributeName="opacity" values="${values}" keyTimes="${keyTimes}" dur="${duration}s" repeatCount="${repeatCount}" />`);
      }

      if (shapeAnims.fill && shapeAnims.fill.length > 1) {
        const sorted = [...shapeAnims.fill].sort((a, b) => a.time - b.time);
        const values = sorted.map((k) => k.value).join(';');
        const keyTimes = sorted.map((k) => (k.time / duration).toFixed(3)).join(';');
        smilList.push(`\n    <animate attributeName="fill" values="${values}" keyTimes="${keyTimes}" dur="${duration}s" repeatCount="${repeatCount}" />`);
      }

      if (smilList.length > 0) {
        const tagType = (shape.type === 'rectangle' || shape.type === 'frame') ? 'rect' : shape.type === 'ellipse' ? 'ellipse' : 'path';
        svgContent += `  ${elementStr}${smilList.join('')}\n  </${tagType}>\n`;
      } else {
        const tagType = (shape.type === 'rectangle' || shape.type === 'frame') ? 'rect' : shape.type === 'ellipse' ? 'ellipse' : 'path';
        svgContent += `  ${elementStr}</${tagType}>\n`;
      }
    } else {
      svgContent += `  ${elementStr}\n`;
    }
  });

  svgContent += `</svg>`;

  // Trigger browser download
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `animated-vector-${Date.now().toString(36)}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
