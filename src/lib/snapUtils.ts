import { BaseShape } from '../types';

export interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
  dotX: number;
  dotY: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: AlignmentGuide[];
}

const SNAP_THRESHOLD_PX = 7;

/**
 * Computes magnetic snapping for moving shapes against other shapes.
 * Supports alignment by edges (Top, Center, Bottom / Left, Center, Right) and Tangents (touching edges).
 */
export function calculateMoveSnap(
  proposedX: number,
  proposedY: number,
  width: number,
  height: number,
  allShapes: BaseShape[],
  movingIds: string[],
  zoomScale: number
): SnapResult {
  const threshold = SNAP_THRESHOLD_PX / zoomScale;
  const guides: AlignmentGuide[] = [];

  let snappedX = proposedX;
  let snappedY = proposedY;

  const targetLeft = proposedX;
  const targetCenterX = proposedX + width / 2;
  const targetRight = proposedX + width;

  const targetTop = proposedY;
  const targetCenterY = proposedY + height / 2;
  const targetBottom = proposedY + height;

  // Collect candidate snap lines from all other non-moving shapes
  const candidateVerticalLines: Array<{ x: number; minY: number; maxY: number; sourceY: number }> = [];
  const candidateHorizontalLines: Array<{ y: number; minX: number; maxX: number; sourceX: number }> = [];

  allShapes.forEach(shape => {
    if (shape.hidden || shape.type === 'group' || movingIds.includes(shape.id)) return;

    const sLeft = shape.x;
    const sCenterX = shape.x + shape.width / 2;
    const sRight = shape.x + shape.width;

    const sTop = shape.y;
    const sCenterY = shape.y + shape.height / 2;
    const sBottom = shape.y + shape.height;

    const minY = Math.min(targetTop, sTop) - 20;
    const maxY = Math.max(targetBottom, sBottom) + 20;

    // Vertical lines (Left, Center, Right, and Tangents)
    candidateVerticalLines.push(
      { x: sLeft, minY, maxY, sourceY: sCenterY },
      { x: sCenterX, minY, maxY, sourceY: sCenterY },
      { x: sRight, minY, maxY, sourceY: sCenterY }
    );

    const minX = Math.min(targetLeft, sLeft) - 20;
    const maxX = Math.max(targetRight, sRight) + 20;

    // Horizontal lines (Top, Center, Bottom, and Tangents)
    candidateHorizontalLines.push(
      { y: sTop, minX, maxX, sourceX: sCenterX },
      { y: sCenterY, minX, maxX, sourceX: sCenterX },
      { y: sBottom, minX, maxX, sourceX: sCenterX }
    );
  });

  // Vertical Snapping (X-axis)
  const targetXPoints = [
    { name: 'left', offset: 0 },
    { name: 'center', offset: width / 2 },
    { name: 'right', offset: width }
  ];

  let minVDiff = threshold;
  let bestVGuide: AlignmentGuide | null = null;
  let bestVSnapX = proposedX;

  targetXPoints.forEach(({ offset }) => {
    const currentX = proposedX + offset;

    candidateVerticalLines.forEach(line => {
      const diff = Math.abs(currentX - line.x);
      if (diff <= minVDiff) {
        minVDiff = diff;
        bestVSnapX = line.x - offset;
        bestVGuide = {
          type: 'vertical',
          position: line.x,
          start: line.minY,
          end: line.maxY,
          dotX: line.x,
          dotY: (line.minY + line.maxY) / 2
        };
      }
    });
  });

  if (bestVGuide) {
    snappedX = bestVSnapX;
    guides.push(bestVGuide);
  }

  // Horizontal Snapping (Y-axis)
  const targetYPoints = [
    { name: 'top', offset: 0 },
    { name: 'center', offset: height / 2 },
    { name: 'bottom', offset: height }
  ];

  let minHDiff = threshold;
  let bestHGuide: AlignmentGuide | null = null;
  let bestHSnapY = proposedY;

  targetYPoints.forEach(({ offset }) => {
    const currentY = proposedY + offset;

    candidateHorizontalLines.forEach(line => {
      const diff = Math.abs(currentY - line.y);
      if (diff <= minHDiff) {
        minHDiff = diff;
        bestHSnapY = line.y - offset;
        bestHGuide = {
          type: 'horizontal',
          position: line.y,
          start: line.minX,
          end: line.maxX,
          dotX: (line.minX + line.maxX) / 2,
          dotY: line.y
        };
      }
    });
  });

  if (bestHGuide) {
    snappedY = bestHSnapY;
    guides.push(bestHGuide);
  }

  return {
    x: Math.round(snappedX * 100) / 100,
    y: Math.round(snappedY * 100) / 100,
    guides
  };
}
