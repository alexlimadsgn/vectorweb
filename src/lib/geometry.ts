import { BaseShape, Transform } from '../types';

export type DragAction = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'resize-n' | 'resize-e' | 'resize-s' | 'resize-w' | 'rotate-nw' | 'rotate-ne' | 'rotate-sw' | 'rotate-se' | 'radius' | 'select-marquee' | 'none';

export const generateId = () => crypto.randomUUID();

export const getShapeBounds = (shape: BaseShape) => {
    let w = shape.width || 0;
    let h = shape.height || 0;
    return {
        x: w < 0 ? shape.x + w : shape.x,
        y: h < 0 ? shape.y + h : shape.y,
        width: Math.abs(w),
        height: Math.abs(h)
    };
};

export const getShapeCorners = (shape: BaseShape) => {
    const ax_offset = (shape.anchorX !== undefined ? shape.anchorX : 0.5) * shape.width;
    const ay_offset = (shape.anchorY !== undefined ? shape.anchorY : 0.5) * shape.height;
    
    const hw = shape.width / 2;
    const hh = shape.height / 2;
    const rad = (shape.rotation || 0) * Math.PI / 180;
    
    const ax = shape.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
    const ay = shape.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);

    const localCorners = [
        [-ax_offset, -ay_offset],
        [shape.width - ax_offset, -ay_offset],
        [shape.width - ax_offset, shape.height - ay_offset],
        [-ax_offset, shape.height - ay_offset]
    ];

    return localCorners.map(([lx, ly]) => {
        return {
            x: ax + lx * Math.cos(rad) - ly * Math.sin(rad),
            y: ay + lx * Math.sin(rad) + ly * Math.cos(rad)
        };
    });
};

export const getShapeWorldAABB = (shape: BaseShape) => {
    const corners = getShapeCorners(shape);
    let minX = corners[0].x;
    let maxX = corners[0].x;
    let minY = corners[0].y;
    let maxY = corners[0].y;
    for (let i = 1; i < corners.length; i++) {
        const p = corners[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    const pad = Math.max(10, (shape.strokeWidth || 0) / 2);
    return {
        minX: minX - pad,
        minY: minY - pad,
        maxX: maxX + pad,
        maxY: maxY + pad
    };
};

export const getGroupBounds = (shapes: BaseShape[]) => {
    if (shapes.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    shapes.forEach(s => {
        const corners = getShapeCorners(s);
        corners.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
    });
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        rotation: 0
    };
};

export const recalculateAllGroupBounds = (shapes: BaseShape[]): BaseShape[] => {
    const groupShapes = shapes.filter(s => s.type === 'group');
    if (groupShapes.length === 0) return shapes;

    let currentShapes = [...shapes];

    for (let pass = 0; pass < 3; pass++) {
        let changed = false;
        currentShapes = currentShapes.map(s => {
            if (s.type !== 'group') return s;

            const children = currentShapes.filter(child => child.groupId === s.id && child.id !== s.id);
            if (children.length === 0) {
                return s;
            }

            const bounds = getGroupBounds(children);
            if (
                s.x !== bounds.x ||
                s.y !== bounds.y ||
                s.width !== bounds.width ||
                s.height !== bounds.height
            ) {
                changed = true;
                return {
                    ...s,
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height
                };
            }
            return s;
        });

        if (!changed) break;
    }

    currentShapes = currentShapes.filter(s => {
        if (s.type === 'group') {
            const hasChildren = currentShapes.some(child => child.groupId === s.id && child.id !== s.id);
            return hasChildren;
        }
        return true;
    });

    return currentShapes;
};

export const detectHandleHit = (pos: {x: number, y: number}, shape: BaseShape, scale: number): DragAction => {
    
    const bounds = getShapeBounds(shape);
    const ax_offset = (shape.anchorX !== undefined ? shape.anchorX : 0.5) * shape.width;
    const ay_offset = (shape.anchorY !== undefined ? shape.anchorY : 0.5) * shape.height;
    
    const hw = shape.width / 2;
    const hh = shape.height / 2;
    const rad = (shape.rotation || 0) * Math.PI / 180;
    
    const ax = shape.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
    const ay = shape.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);
    
    const rx_local = (pos.x - ax) * Math.cos(-rad) - (pos.y - ay) * Math.sin(-rad);
    const ry_local = (pos.x - ax) * Math.sin(-rad) + (pos.y - ay) * Math.cos(-rad);
    
    const px = shape.x + rx_local + ax_offset;
    const py = shape.y + ry_local + ay_offset;

    const pad = 10 / scale;
    const outPad = 30 / scale;
    
    const isNW = Math.abs(px - bounds.x) <= pad && Math.abs(py - bounds.y) <= pad;
    const isNE = Math.abs(px - (bounds.x + bounds.width)) <= pad && Math.abs(py - bounds.y) <= pad;
    const isSW = Math.abs(px - bounds.x) <= pad && Math.abs(py - (bounds.y + bounds.height)) <= pad;
    const isSE = Math.abs(px - (bounds.x + bounds.width)) <= pad && Math.abs(py - (bounds.y + bounds.height)) <= pad;

    if (isNW) return 'resize-nw';
    if (isNE) return 'resize-ne';
    if (isSW) return 'resize-sw';
    if (isSE) return 'resize-se';

    const isN = Math.abs(py - bounds.y) <= pad && px > bounds.x + pad && px < bounds.x + bounds.width - pad;
    const isS = Math.abs(py - (bounds.y + bounds.height)) <= pad && px > bounds.x + pad && px < bounds.x + bounds.width - pad;
    const isW = Math.abs(px - bounds.x) <= pad && py > bounds.y + pad && py < bounds.y + bounds.height - pad;
    const isE = Math.abs(px - (bounds.x + bounds.width)) <= pad && py > bounds.y + pad && py < bounds.y + bounds.height - pad;

    if (isN) return 'resize-n';
    if (isS) return 'resize-s';
    if (isW) return 'resize-w';
    if (isE) return 'resize-e';

    const rNW = Math.abs(px - bounds.x) <= outPad && Math.abs(py - bounds.y) <= outPad && px <= bounds.x + pad && py <= bounds.y + pad;
    const rNE = Math.abs(px - (bounds.x + bounds.width)) <= outPad && Math.abs(py - bounds.y) <= outPad && px >= bounds.x + bounds.width - pad && py <= bounds.y + pad;
    const rSW = Math.abs(px - bounds.x) <= outPad && Math.abs(py - (bounds.y + bounds.height)) <= outPad && px <= bounds.x + pad && py >= bounds.y + bounds.height - pad;
    const rSE = Math.abs(px - (bounds.x + bounds.width)) <= outPad && Math.abs(py - (bounds.y + bounds.height)) <= outPad && px >= bounds.x + bounds.width - pad && py >= bounds.y + bounds.height - pad;

    if (rNW) return 'rotate-nw';
    if (rNE) return 'rotate-ne';
    if (rSW) return 'rotate-sw';
    if (rSE) return 'rotate-se';

    return 'none';
};

export const isPointInShape = (px: number, py: number, shape: BaseShape): boolean => {
    // Fast AABB pre-check to skip trigonometric matrix math for distant shapes
    const aabb = getShapeWorldAABB(shape);
    if (px < aabb.minX - 10 || px > aabb.maxX + 10 || py < aabb.minY - 10 || py > aabb.maxY + 10) {
        return false;
    }

    const bounds = getShapeBounds(shape);
    const ax_offset = (shape.anchorX !== undefined ? shape.anchorX : 0.5) * shape.width;
    const ay_offset = (shape.anchorY !== undefined ? shape.anchorY : 0.5) * shape.height;
    
    const hw = shape.width / 2;
    const hh = shape.height / 2;
    const rad = (shape.rotation || 0) * Math.PI / 180;
    
    const ax = shape.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
    const ay = shape.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);
    
    const rx_local = (px - ax) * Math.cos(-rad) - (py - ay) * Math.sin(-rad);
    const ry_local = (px - ax) * Math.sin(-rad) + (py - ay) * Math.cos(-rad);
    
    const rpx = shape.x + rx_local + ax_offset;
    const rpy = shape.y + ry_local + ay_offset;

    const pad = 6;
    
    if (shape.type === 'ellipse') {
       const rx = bounds.width / 2;
       const ry = bounds.height / 2;
       const hcx = bounds.x + rx;
       const hcy = bounds.y + ry;
       if (rx === 0 || ry === 0) return false;
       const dx = rpx - hcx;
       const dy = rpy - hcy;
       return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.2;
    }
    
    return rpx >= bounds.x - pad && rpx <= bounds.x + bounds.width + pad && 
           rpy >= bounds.y - pad && rpy <= bounds.y + bounds.height + pad;
};

// Canvas coords from screen coords
export const screenToCanvas = (
  clientX: number,
  clientY: number,
  transform: Transform
) => {
  return {
    x: (clientX - transform.x) / transform.scale,
    y: (clientY - transform.y) / transform.scale,
  };
};

export const canvasToScreen = (
  canvasX: number,
  canvasY: number,
  transform: Transform
) => {
  return {
    x: canvasX * transform.scale + transform.x,
    y: canvasY * transform.scale + transform.y,
  };
};
