export type ToolType = 'select' | 'frame' | 'rectangle' | 'ellipse' | 'pen' | 'bezier' | 'hand';

export type ShapeType = 'frame' | 'rectangle' | 'ellipse' | 'path' | 'group' | 'image';

export type AnimatableProperty = 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'fill' | 'radius'
  | 'stroke' | 'strokeWidth' | 'trimStart' | 'trimEnd' | 'trimOffset';

export interface PathPoint {
  x: number;
  y: number;
  cp1?: { x: number; y: number }; // Control point 1 (handleIn / incoming curve)
  cp2?: { x: number; y: number }; // Control point 2 (handleOut / outgoing curve)
  pointType?: 'corner' | 'smooth' | 'symmetric';
}

export interface SpringConfig {
  stiffness: number;  // 1–500, default 100
  damping: number;    // 0–100, default 10
  mass: number;       // 0.1–10, default 1
  velocity: number;   // 0–100, default 0
}

export interface Keyframe {
  id: string;
  time: number; // in seconds
  value: any; // number or string
  easing?: string; // GSAP ease name, 'cubic-bezier', 'spring', 'linear', etc.
  bezier?: [number, number, number, number]; // [x1, y1, x2, y2] for cubic-bezier
  spring?: SpringConfig;
  // Motion path: quadratic control point (x/y space) curving the segment that ends at this x keyframe
  motionCp?: { x: number; y: number };
}

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  points?: PathPoint[]; // For paths (simple or Bézier)
  closed?: boolean;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  groupId?: string;
  childrenIds?: string[];
  anchor?: string;
  anchorX?: number;
  anchorY?: number;
  editAnchorManual?: boolean;
  radius?: number;
  // Per-corner radii [top-left, top-right, bottom-right, bottom-left]; overrides `radius` when set
  radii?: [number, number, number, number];
  // Stroke style
  strokeCap?: 'butt' | 'round' | 'square';
  strokeJoin?: 'miter' | 'round' | 'bevel';
  strokeDash?: number; // dash length, 0 = solid
  strokeGap?: number;
  // Trim path, in % of the stroke length (0–100); offset shifts the visible window
  trimStart?: number;
  trimEnd?: number;
  trimOffset?: number;
  // Drop shadow
  shadowColor?: string;
  shadowOpacity?: number; // 0–100
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
  rx?: number;
  d?: string;
  src?: string;
  imageUrl?: string;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

