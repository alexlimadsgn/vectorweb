import { create } from 'zustand';
import { BaseShape, ToolType, Transform, AnimatableProperty, Keyframe } from '../types';
import { getShapeBounds, getGroupBounds, recalculateAllGroupBounds } from '../lib/geometry';
import { generatePresetKeyframes, getAnimatedShape } from '../lib/animationUtils';

interface ViewportState {
  transform: Transform;
}

interface EditorState {
  past: BaseShape[][];
  future: BaseShape[][];
  shapes: BaseShape[];
  selectedIds: string[];
  hoveredId: string | null;
  activeTool: ToolType;
  viewport: ViewportState;

  showRulers: boolean;
  showWireframe: boolean;
  copiedShapes: BaseShape[];

  // Path Node Editing State
  isEditingPathNodes: boolean;
  selectedNodeIndex: number | null;
  selectedHandleType: 'point' | 'cp1' | 'cp2' | null;
  setEditingPathNodes: (editing: boolean) => void;
  setSelectedNode: (index: number | null, handleType?: 'point' | 'cp1' | 'cp2' | null) => void;

  // Animation Timeline State
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  isLooping: boolean;
  autoKeyframeEnabled: boolean;
  showTimeline: boolean;
  timelineHeight: number;
  animations: Record<string, Partial<Record<AnimatableProperty, Keyframe[]>>>;

  // Actions
  toggleAutoKeyframe: () => void;

  // Actions
  setTool: (tool: ToolType) => void;
  setViewportTransform: (transform: Transform) => void;
  selectShape: (id: string | null, multi?: boolean, forceIndividual?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  setHovered: (id: string | null) => void;
  addShape: (shape: BaseShape) => void;
  removeShape: (id: string) => void;
  updateShape: (id: string, partial: Partial<BaseShape>) => void;
  updateShapes: (updates: { id: string; partial: Partial<BaseShape> }[]) => void;
  removeSelected: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo100: () => void;
  zoomToFit: () => void;
  zoomToSelection: () => void;
  reorderShape: (id: string, index: number) => void;
  moveLayer: (dragId: string, targetId: string | null, position: 'above' | 'below' | 'inside') => void;
  renameShape: (id: string, name: string) => void;
  toggleLock: (id: string) => void;
  toggleVisibility: (id: string) => void;
  groupShapes: () => void;
  ungroupShapes: () => void;

  selectAll: () => void;
  toggleRulers: () => void;
  toggleWireframe: () => void;
  snapEnabled: boolean;
  toggleSnap: () => void;
  bringToFront: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  sendToBack: () => void;
  duplicateSelected: () => void;
  cutSelected: () => void;
  copySelected: () => void;
  pasteCopied: () => void;
  convertToPath: () => void;
  reorientPath: () => void;
  clearDocument: () => void;

  // Animation Actions
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsLooping: (loop: boolean) => void;
  toggleTimeline: () => void;
  setTimelineHeight: (height: number) => void;
  addOrUpdateKeyframe: (shapeId: string, property: AnimatableProperty, time?: number, value?: any) => void;
  deleteKeyframe: (shapeId: string, property: AnimatableProperty, keyframeId: string) => void;
  moveKeyframe: (shapeId: string, property: AnimatableProperty, keyframeId: string, newTime: number) => void;
  shiftShapeKeyframes: (shapeId: string, timeDelta: number) => void;
  updateKeyframeEasing: (shapeId: string, property: AnimatableProperty, keyframeId: string, easing: string, bezier?: [number, number, number, number], spring?: import('../types').SpringConfig) => void;
  applyPresetAnimation: (shapeId: string, presetName: string) => void;
  clearAnimationForShape: (shapeId: string) => void;
  keyframeAllSelected: () => void;
  showMotionPath: boolean;
  toggleMotionPath: () => void;
  setMotionNode: (shapeId: string, time: number, x: number, y: number) => void;
  setMotionControl: (shapeId: string, fromTime: number, toTime: number, cp: { x: number; y: number } | null) => void;
}

export const useStore = create<EditorState>((set, get) => ({
  past: [],
  future: [],
  shapes: [],
  selectedIds: [],
  hoveredId: null,
  activeTool: 'select',
  viewport: { transform: { x: 0, y: 0, scale: 1 } },
  showRulers: false,
  showWireframe: false,
  snapEnabled: true,
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  copiedShapes: [],

  // Path Node Editing Initial State
  isEditingPathNodes: false,
  selectedNodeIndex: null,
  selectedHandleType: null,
  setEditingPathNodes: (editing) => set({ isEditingPathNodes: editing, selectedNodeIndex: null, selectedHandleType: null }),
  setSelectedNode: (index, handleType = 'point') => set({ selectedNodeIndex: index, selectedHandleType: handleType }),

  // Animation initial state
  isPlaying: false,
  currentTime: 0.0,
  duration: 3.0,
  playbackSpeed: 1.0,
  isLooping: true,
  autoKeyframeEnabled: true,
  showTimeline: false,
  timelineHeight: 260,
  animations: {},
  showMotionPath: true,
  toggleMotionPath: () => set((state) => ({ showMotionPath: !state.showMotionPath })),

  // Moves a motion-path node: writes x/y keyframes at that time
  setMotionNode: (shapeId, time, x, y) => {
    get().addOrUpdateKeyframe(shapeId, 'x', time, x);
    get().addOrUpdateKeyframe(shapeId, 'y', time, y);
  },

  // Curves (or straightens, cp = null) the motion segment between two keyframe times
  setMotionControl: (shapeId, fromTime, toTime, cp) => {
    const shape = get().shapes.find(s => s.id === shapeId);
    if (!shape) return;
    if (cp) {
      // Both tracks need keyframes at both ends for the curve to apply
      const at = (t: number) => getAnimatedShape(shape, t, get().animations);
      const start = at(fromTime);
      const end = at(toTime);
      get().addOrUpdateKeyframe(shapeId, 'x', fromTime, start.x);
      get().addOrUpdateKeyframe(shapeId, 'y', fromTime, start.y);
      get().addOrUpdateKeyframe(shapeId, 'x', toTime, end.x);
      get().addOrUpdateKeyframe(shapeId, 'y', toTime, end.y);
    }
    set((state) => {
      const anims = state.animations[shapeId];
      if (!anims?.x) return state;
      const x = anims.x.map(k => Math.abs(k.time - toTime) < 0.02 ? { ...k, motionCp: cp || undefined } : k);
      return { animations: { ...state.animations, [shapeId]: { ...anims, x } } };
    });
  },

  toggleAutoKeyframe: () => set((state) => ({ autoKeyframeEnabled: !state.autoKeyframeEnabled })),

  setIsPlaying: (playing) => set((state) => ({
    isPlaying: playing,
    currentTime: (playing && state.currentTime >= state.duration - 0.01) ? 0 : state.currentTime
  })),
  setCurrentTime: (time) => set((state) => ({ currentTime: Math.max(0, Math.min(state.duration, Math.round(time * 100) / 100)) })),
  setDuration: (duration) => set((state) => ({ duration: Math.max(0.5, Math.min(60, duration)), currentTime: Math.min(state.currentTime, duration) })),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setIsLooping: (loop) => set({ isLooping: loop }),
  toggleTimeline: () => set((state) => ({ showTimeline: !state.showTimeline })),
  setTimelineHeight: (height) => set({ timelineHeight: height }),

  addOrUpdateKeyframe: (shapeId, property, targetTime, value) => set((state) => {
    const time = targetTime !== undefined ? targetTime : state.currentTime;
    const shape = state.shapes.find(s => s.id === shapeId);
    if (!shape) return state;

    const animShape = getAnimatedShape(shape, time, state.animations);
    const val = value !== undefined ? value : (animShape as any)[property];
    const shapeAnims = state.animations[shapeId] || {};
    const propKfs = shapeAnims[property] ? [...shapeAnims[property]!] : [];

    // Check if keyframe exists at time
    const existingIndex = propKfs.findIndex(k => Math.abs(k.time - time) < 0.02);
    if (existingIndex >= 0) {
      propKfs[existingIndex] = { ...propKfs[existingIndex], value: val };
    } else {
      propKfs.push({
        id: Math.random().toString(36).substring(2, 9),
        time: Math.round(time * 100) / 100,
        value: val,
        easing: 'ease-in-out'
      });
    }

    propKfs.sort((a, b) => a.time - b.time);

    return {
      animations: {
        ...state.animations,
        [shapeId]: {
          ...shapeAnims,
          [property]: propKfs
        }
      }
    };
  }),

  deleteKeyframe: (shapeId, property, keyframeId) => set((state) => {
    const shapeAnims = state.animations[shapeId];
    if (!shapeAnims || !shapeAnims[property]) return state;

    const newKfs = shapeAnims[property]!.filter(k => k.id !== keyframeId);
    return {
      animations: {
        ...state.animations,
        [shapeId]: {
          ...shapeAnims,
          [property]: newKfs
        }
      }
    };
  }),

  moveKeyframe: (shapeId, property, keyframeId, newTime) => set((state) => {
    const shapeAnims = state.animations[shapeId];
    if (!shapeAnims || !shapeAnims[property]) return state;

    const clampedTime = Math.max(0, Math.min(state.duration, Math.round(newTime * 100) / 100));
    const newKfs = shapeAnims[property]!.map(k => k.id === keyframeId ? { ...k, time: clampedTime } : k);
    newKfs.sort((a, b) => a.time - b.time);

    return {
      animations: {
        ...state.animations,
        [shapeId]: {
          ...shapeAnims,
          [property]: newKfs
        }
      }
    };
  }),

  shiftShapeKeyframes: (shapeId, timeDelta) => set((state) => {
    const shapeAnims = state.animations[shapeId];
    if (!shapeAnims) return state;

    let minKfTime = Infinity;
    Object.values(shapeAnims).forEach(kfs => {
      kfs?.forEach(kf => {
        if (kf.time < minKfTime) minKfTime = kf.time;
      });
    });

    if (minKfTime === Infinity) return state;

    const effectiveDelta = Math.max(-minKfTime, timeDelta);
    if (Math.abs(effectiveDelta) < 0.001) return state;

    const newShapeAnims = { ...shapeAnims };
    (Object.keys(newShapeAnims) as AnimatableProperty[]).forEach(prop => {
      const kfs = newShapeAnims[prop];
      if (kfs && kfs.length > 0) {
        const shifted = kfs.map(kf => ({
          ...kf,
          time: Math.max(0, Math.min(state.duration, Math.round((kf.time + effectiveDelta) * 100) / 100))
        }));
        shifted.sort((a, b) => a.time - b.time);
        newShapeAnims[prop] = shifted;
      }
    });

    return {
      animations: {
        ...state.animations,
        [shapeId]: newShapeAnims
      }
    };
  }),

  updateKeyframeEasing: (shapeId, property, keyframeId, easing, bezier, spring) => set((state) => {
    const shapeAnims = state.animations[shapeId];
    if (!shapeAnims || !shapeAnims[property]) return state;

    const newKfs = shapeAnims[property]!.map(k => {
      if (k.id !== keyframeId) return k;
      const updated: typeof k = { ...k, easing };
      if (bezier) updated.bezier = bezier;
      else delete (updated as any).bezier;
      if (spring) updated.spring = spring;
      else delete (updated as any).spring;
      return updated;
    });
    return {
      animations: {
        ...state.animations,
        [shapeId]: {
          ...shapeAnims,
          [property]: newKfs
        }
      }
    };
  }),

  applyPresetAnimation: (shapeId, presetName) => set((state) => {
    const shape = state.shapes.find(s => s.id === shapeId);
    if (!shape) return state;

    const presetKfs = generatePresetKeyframes(shape, presetName, state.duration);
    const currentShapeAnims = state.animations[shapeId] || {};

    return {
      currentTime: 0,
      isPlaying: true,
      animations: {
        ...state.animations,
        [shapeId]: {
          ...currentShapeAnims,
          ...presetKfs
        }
      }
    };
  }),

  clearAnimationForShape: (shapeId) => set((state) => {
    const newAnims = { ...state.animations };
    delete newAnims[shapeId];
    return { animations: newAnims };
  }),

  keyframeAllSelected: () => {
    const state = get();
    state.selectedIds.forEach(id => {
      const shape = state.shapes.find(s => s.id === id);
      if (shape) {
        state.addOrUpdateKeyframe(id, 'x', state.currentTime, shape.x);
        state.addOrUpdateKeyframe(id, 'y', state.currentTime, shape.y);
        state.addOrUpdateKeyframe(id, 'width', state.currentTime, shape.width);
        state.addOrUpdateKeyframe(id, 'height', state.currentTime, shape.height);
        state.addOrUpdateKeyframe(id, 'rotation', state.currentTime, shape.rotation || 0);
        state.addOrUpdateKeyframe(id, 'opacity', state.currentTime, shape.opacity);
        if (shape.fill !== 'transparent') {
          state.addOrUpdateKeyframe(id, 'fill', state.currentTime, shape.fill);
        }
      }
    });
  },


  toggleRulers: () => set((state) => ({ showRulers: !state.showRulers })),
  toggleWireframe: () => set((state) => ({ showWireframe: !state.showWireframe })),

  setTool: (tool) => set((state) => ({
    activeTool: tool,
    isEditingPathNodes: (tool === 'select' || tool === 'bezier') ? state.isEditingPathNodes : false,
    selectedNodeIndex: (tool === 'select' || tool === 'bezier') ? state.selectedNodeIndex : null,
    selectedHandleType: (tool === 'select' || tool === 'bezier') ? state.selectedHandleType : null
  })),
  setViewportTransform: (transform) => set({ viewport: { transform } }),
  
  selectShape: (id, multi = false, forceIndividual = false) => set((state) => {
    if (!id) return { selectedIds: [] };

    let targetId = id;
    const shape = state.shapes.find(s => s.id === id);
    if (shape && shape.groupId && !forceIndividual) {
        targetId = shape.groupId;
    }

    if (multi) {
      if (state.selectedIds.includes(targetId)) {
        return { selectedIds: state.selectedIds.filter(selectedId => selectedId !== targetId) };
      }
      return { selectedIds: [...state.selectedIds, targetId] };
    }
    return { selectedIds: [targetId] };
  }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  selectAll: () => set((state) => ({
    selectedIds: state.shapes.filter(s => !s.hidden && s.type !== 'group').map(s => s.id)
  })),

  setHovered: (id) => set({ hoveredId: id }),

  reorderShape: (id, index) => set((state) => {
    const shapeIndex = state.shapes.findIndex(s => s.id === id);
    if (shapeIndex < 0) return state;
    const newShapes = [...state.shapes];
    const [shape] = newShapes.splice(shapeIndex, 1);
    newShapes.splice(index, 0, shape);
    return { shapes: newShapes };
  }),

  // Layer-panel drag & drop. 'above'/'below' are visual (list is top = front-most).
  moveLayer: (dragId, targetId, position) => {
    const state = get();
    const isDescendant = (id: string | undefined, ancestorId: string): boolean => {
      let current = state.shapes.find(s => s.id === id);
      while (current?.groupId) {
        if (current.groupId === ancestorId) return true;
        current = state.shapes.find(s => s.id === current!.groupId);
      }
      return false;
    };
    if (dragId === targetId || (targetId && isDescendant(targetId, dragId))) return;

    // Move the dragged layer together with its children (parent stays below children)
    const block = state.shapes.filter(s => s.id === dragId || isDescendant(s.id, dragId));
    block.sort((a, b) => (a.id === dragId ? -1 : b.id === dragId ? 1 : 0));
    const blockIds = new Set(block.map(s => s.id));
    const remaining = state.shapes.filter(s => !blockIds.has(s.id));

    let insertAt: number;
    let newGroupId: string | undefined;
    if (!targetId) {
      insertAt = 0; // empty space at the bottom of the list = back-most
      newGroupId = undefined;
    } else {
      const target = remaining.find(s => s.id === targetId);
      if (!target) return;
      const targetIdx = remaining.indexOf(target);
      const lastDescendantIdx = remaining.reduce((acc, s, i) => (isDescendant(s.id, targetId) ? i : acc), targetIdx);
      if (position === 'inside') {
        newGroupId = target.id;
        insertAt = lastDescendantIdx + 1;
      } else {
        newGroupId = target.groupId;
        insertAt = position === 'above' ? lastDescendantIdx + 1 : targetIdx;
      }
    }

    get().pushHistory();
    block[0] = { ...block[0], groupId: newGroupId };
    remaining.splice(insertAt, 0, ...block);
    set({ shapes: recalculateAllGroupBounds(remaining) });
  },

  renameShape: (id, name) => {
    const trimmed = name.trim();
    get().pushHistory();
    set((state) => ({
      shapes: state.shapes.map(s => s.id === id ? { ...s, name: trimmed || undefined } : s)
    }));
  },

  toggleLock: (id) => set((state) => ({
    shapes: state.shapes.map(s => s.id === id ? { ...s, locked: !s.locked } : s)
  })),

  toggleVisibility: (id) => set((state) => ({
    shapes: state.shapes.map(s => s.id === id ? { ...s, hidden: !s.hidden } : s),
    selectedIds: state.selectedIds.filter(selectedId => selectedId !== id || !state.shapes.find(s => s.id === id)?.hidden)
  })),

  groupShapes: () => set((state) => {
    if (state.selectedIds.length < 2) return state;

    const groupShapeId = Math.random().toString(36).substring(2, 9);
    const selectedFullShapes = state.shapes.filter(s => state.selectedIds.includes(s.id));
    const bounds = getGroupBounds(selectedFullShapes);
    
    const newGroup: BaseShape = {
      id: groupShapeId,
      type: 'group',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      rotation: 0,
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      opacity: 1
    };

    let newShapes = state.shapes.map(s => {
      if (state.selectedIds.includes(s.id)) {
        return { ...s, groupId: groupShapeId };
      }
      return s;
    });
    
    newShapes.push(newGroup);
    newShapes = recalculateAllGroupBounds(newShapes);

    return { 
      shapes: newShapes,
      selectedIds: [groupShapeId]
    };
  }),

  ungroupShapes: () => set((state) => {
    if (state.selectedIds.length === 0) return state;
    
    const idsToSelect: string[] = [];
    let newShapes = state.shapes.map(s => {
      if (s.groupId && state.selectedIds.includes(s.groupId)) {
        idsToSelect.push(s.id);
        const { groupId, ...rest } = s;
        return rest as BaseShape;
      }
      return s;
    });
    
    // Remove group wrappers
    newShapes = newShapes.filter(s => !(s.type === 'group' && state.selectedIds.includes(s.id)));

    if (idsToSelect.length === 0) return state;
    newShapes = recalculateAllGroupBounds(newShapes);

    return {
      shapes: newShapes,
      selectedIds: idsToSelect
    };
  }),

  pushHistory: () => set((state) => {
    const newPast = [...state.past, state.shapes];
    if (newPast.length > 50) newPast.shift(); // Max history 50
    return { past: newPast, future: [] };
  }),

  addShape: (shape) => {
    get().pushHistory();
    set((state) => {
      let newShapes: BaseShape[] = [];
      if (shape.type === 'frame') {
        const fx = Math.min(shape.x, shape.x + shape.width);
        const fy = Math.min(shape.y, shape.y + shape.height);
        const fw = Math.abs(shape.width);
        const fh = Math.abs(shape.height);

        const updatedShapes = state.shapes.map(s => {
          if (s.id === shape.id || s.type === 'frame') return s;
          const cx = s.x + s.width / 2;
          const cy = s.y + s.height / 2;
          if (cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh) {
            return { ...s, groupId: shape.id };
          }
          return s;
        });

        newShapes = [shape, ...updatedShapes];
      } else {
        newShapes = [...state.shapes, shape];
      }
      newShapes = recalculateAllGroupBounds(newShapes);
      return { shapes: newShapes, selectedIds: [shape.id] };
    });
  },

  removeShape: (id) => set((state) => {
    let newShapes = state.shapes.filter(s => s.id !== id && s.groupId !== id);
    newShapes = recalculateAllGroupBounds(newShapes);
    return {
      shapes: newShapes,
      selectedIds: state.selectedIds.filter(selectedId => selectedId !== id),
      hoveredId: state.hoveredId === id ? null : state.hoveredId,
    };
  }),

  updateShape: (id, partial) => set((state) => {
    const shape = state.shapes.find(s => s.id === id);
    if (!shape) return state;

    let newShapes = state.shapes.map((s) => (s.id === id ? { ...s, ...partial } : s));
    newShapes = recalculateAllGroupBounds(newShapes);

    // Check if shape has animations
    const shapeAnims = state.animations[id];
    if (!shapeAnims) {
      return { shapes: newShapes };
    }

    const updatedAnims = { ...shapeAnims };
    let hasAnimChanges = false;
    const animatableProps: AnimatableProperty[] = ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'fill', 'radius'];

    animatableProps.forEach((prop) => {
      if (prop in partial && partial[prop as keyof Partial<BaseShape>] !== undefined) {
        const propKfs = updatedAnims[prop];
        if (propKfs && propKfs.length > 0) {
          hasAnimChanges = true;
          const val = partial[prop as keyof Partial<BaseShape>];
          const time = Math.round(state.currentTime * 100) / 100;
          const newPropKfs = [...propKfs];
          const existingIndex = newPropKfs.findIndex(k => Math.abs(k.time - time) < 0.02);
          if (existingIndex >= 0) {
            hasAnimChanges = true;
            newPropKfs[existingIndex] = { ...newPropKfs[existingIndex], value: val };
            newPropKfs.sort((a, b) => a.time - b.time);
            updatedAnims[prop] = newPropKfs;
          } else if (state.autoKeyframeEnabled) {
            hasAnimChanges = true;
            newPropKfs.push({
              id: Math.random().toString(36).substring(2, 9),
              time: time,
              value: val,
              easing: 'ease-in-out'
            });
            newPropKfs.sort((a, b) => a.time - b.time);
            updatedAnims[prop] = newPropKfs;
          }
        }
      }
    });

    if (hasAnimChanges) {
      return {
        shapes: newShapes,
        animations: {
          ...state.animations,
          [id]: updatedAnims
        }
      };
    }

    return { shapes: newShapes };
  }),

  updateShapes: (updates) => set((state) => {
    if (updates.length === 0) return state;
    const updateMap = new Map(updates.map(u => [u.id, u.partial]));
    let newShapes = state.shapes.map(s => {
      const partial = updateMap.get(s.id);
      return partial ? { ...s, ...partial } : s;
    });
    newShapes = recalculateAllGroupBounds(newShapes);

    const time = Math.round(state.currentTime * 100) / 100;
    let newAnimations = state.animations;
    let hasGlobalAnimChanges = false;
    const animatableProps: AnimatableProperty[] = ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'fill', 'radius'];

    updates.forEach(({ id, partial }) => {
      const shapeAnims = newAnimations[id];
      if (!shapeAnims) return;

      let shapeAnimUpdated = false;
      const updatedAnims = { ...shapeAnims };

      animatableProps.forEach((prop) => {
        if (prop in partial && partial[prop as keyof Partial<BaseShape>] !== undefined) {
          const propKfs = updatedAnims[prop];
          if (propKfs && propKfs.length > 0) {
            const val = partial[prop as keyof Partial<BaseShape>];
            const newPropKfs = [...propKfs];
            const existingIndex = newPropKfs.findIndex(k => Math.abs(k.time - time) < 0.02);
            if (existingIndex >= 0) {
              shapeAnimUpdated = true;
              newPropKfs[existingIndex] = { ...newPropKfs[existingIndex], value: val };
              newPropKfs.sort((a, b) => a.time - b.time);
              updatedAnims[prop] = newPropKfs;
            } else if (state.autoKeyframeEnabled) {
              shapeAnimUpdated = true;
              newPropKfs.push({
                id: Math.random().toString(36).substring(2, 9),
                time: time,
                value: val,
                easing: 'ease-in-out'
              });
              newPropKfs.sort((a, b) => a.time - b.time);
              updatedAnims[prop] = newPropKfs;
            }
          }
        }
      });

      if (shapeAnimUpdated) {
        if (!hasGlobalAnimChanges) {
          newAnimations = { ...newAnimations };
          hasGlobalAnimChanges = true;
        }
        newAnimations[id] = updatedAnims;
      }
    });

    if (hasGlobalAnimChanges) {
      return { shapes: newShapes, animations: newAnimations };
    }

    return { shapes: newShapes };
  }),

  removeSelected: () => {
    const state = get();
    if (state.selectedIds.length === 0) return;
    state.pushHistory();
    set((s) => {
      let newShapes = s.shapes.filter((shape) => !s.selectedIds.includes(shape.id) && !(shape.groupId && s.selectedIds.includes(shape.groupId)));
      newShapes = recalculateAllGroupBounds(newShapes);
      return {
        shapes: newShapes,
        selectedIds: [],
        hoveredId: null,
      };
    });
  },

  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    return {
      past: newPast,
      future: [state.shapes, ...state.future],
      shapes: previous,
      selectedIds: [], // Clear selection on undo
      hoveredId: null,
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    return {
      past: [...state.past, state.shapes],
      future: newFuture,
      shapes: next,
      selectedIds: [], // Clear selection on redo
      hoveredId: null,
    };
  }),

  zoomIn: () => set((state) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const newScale = Math.min(state.viewport.transform.scale + 0.1, 50);
    const nextX = cx - (cx - state.viewport.transform.x) * (newScale / state.viewport.transform.scale);
    const nextY = cy - (cy - state.viewport.transform.y) * (newScale / state.viewport.transform.scale);
    return { viewport: { transform: { x: nextX, y: nextY, scale: newScale } } };
  }),

  zoomOut: () => set((state) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const newScale = Math.max(state.viewport.transform.scale - 0.1, 0.05);
    const nextX = cx - (cx - state.viewport.transform.x) * (newScale / state.viewport.transform.scale);
    const nextY = cy - (cy - state.viewport.transform.y) * (newScale / state.viewport.transform.scale);
    return { viewport: { transform: { x: nextX, y: nextY, scale: newScale } } };
  }),

  zoomTo100: () => set((state) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const newScale = 1;
    const nextX = cx - (cx - state.viewport.transform.x) * (newScale / state.viewport.transform.scale);
    const nextY = cy - (cy - state.viewport.transform.y) * (newScale / state.viewport.transform.scale);
    return { viewport: { transform: { x: nextX, y: nextY, scale: newScale } } };
  }),

  zoomToFit: () => set((state) => {
    if (state.shapes.length === 0) return state;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.shapes.forEach(s => {
      const bounds = getShapeBounds(s);
      if (bounds.x < minX) minX = bounds.x;
      if (bounds.y < minY) minY = bounds.y;
      if (bounds.x + bounds.width > maxX) maxX = bounds.x + bounds.width;
      if (bounds.y + bounds.height > maxY) maxY = bounds.y + bounds.height;
    });
    
    const w = maxX - minX;
    const h = maxY - minY;
    if (w === 0 || h === 0) return state;

    const pad = 40;
    const scaleX = (window.innerWidth - pad * 2) / w;
    const scaleY = (window.innerHeight - pad * 2) / h;
    const newScale = Math.max(0.05, Math.min(scaleX, scaleY, 50));
    
    const cx = minX + w / 2;
    const cy = minY + h / 2;
    const nextX = (window.innerWidth / 2) - (cx * newScale);
    const nextY = (window.innerHeight / 2) - (cy * newScale);
    
    return { viewport: { transform: { x: nextX, y: nextY, scale: newScale } } };
  }),

  zoomToSelection: () => set((state) => {
    if (state.selectedIds.length === 0) return state;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.shapes.filter(s => state.selectedIds.includes(s.id)).forEach(s => {
      const bounds = getShapeBounds(s);
      if (bounds.x < minX) minX = bounds.x;
      if (bounds.y < minY) minY = bounds.y;
      if (bounds.x + bounds.width > maxX) maxX = bounds.x + bounds.width;
      if (bounds.y + bounds.height > maxY) maxY = bounds.y + bounds.height;
    });
    
    const w = maxX - minX;
    const h = maxY - minY;
    if (w === 0 || h === 0) return state;

    const pad = 40;
    const scaleX = (window.innerWidth - pad * 2) / w;
    const scaleY = (window.innerHeight - pad * 2) / h;
    const newScale = Math.max(0.05, Math.min(scaleX, scaleY, 50));
    
    const cx = minX + w / 2;
    const cy = minY + h / 2;
    const nextX = (window.innerWidth / 2) - (cx * newScale);
    const nextY = (window.innerHeight / 2) - (cy * newScale);
    
    return { viewport: { transform: { x: nextX, y: nextY, scale: newScale } } };
  }),

  bringToFront: () => set((state) => {
    if (state.selectedIds.length === 0) return state;
    state.pushHistory();
    const selectedFullIds = new Set<string>();
    state.shapes.forEach(s => {
      if (state.selectedIds.includes(s.id) || (s.groupId && state.selectedIds.includes(s.groupId))) {
        selectedFullIds.add(s.id);
      }
    });

    const selectedList: BaseShape[] = [];
    const unselectedList: BaseShape[] = [];
    state.shapes.forEach(s => {
      if (selectedFullIds.has(s.id)) {
        selectedList.push(s);
      } else {
        unselectedList.push(s);
      }
    });

    return { shapes: [...unselectedList, ...selectedList] };
  }),

  sendToBack: () => set((state) => {
    if (state.selectedIds.length === 0) return state;
    state.pushHistory();
    const selectedFullIds = new Set<string>();
    state.shapes.forEach(s => {
      if (state.selectedIds.includes(s.id) || (s.groupId && state.selectedIds.includes(s.groupId))) {
        selectedFullIds.add(s.id);
      }
    });

    const selectedList: BaseShape[] = [];
    const unselectedList: BaseShape[] = [];
    state.shapes.forEach(s => {
      if (selectedFullIds.has(s.id)) {
        selectedList.push(s);
      } else {
        unselectedList.push(s);
      }
    });

    return { shapes: [...selectedList, ...unselectedList] };
  }),

  bringForward: () => set((state) => {
    if (state.selectedIds.length === 0) return state;
    state.pushHistory();
    const selectedFullIds = new Set<string>();
    state.shapes.forEach(s => {
      if (state.selectedIds.includes(s.id) || (s.groupId && state.selectedIds.includes(s.groupId))) {
        selectedFullIds.add(s.id);
      }
    });

    const newShapes = [...state.shapes];
    for (let i = newShapes.length - 2; i >= 0; i--) {
      if (selectedFullIds.has(newShapes[i].id) && !selectedFullIds.has(newShapes[i + 1].id)) {
        const temp = newShapes[i];
        newShapes[i] = newShapes[i + 1];
        newShapes[i + 1] = temp;
      }
    }
    return { shapes: newShapes };
  }),

  sendBackward: () => set((state) => {
    if (state.selectedIds.length === 0) return state;
    state.pushHistory();
    const selectedFullIds = new Set<string>();
    state.shapes.forEach(s => {
      if (state.selectedIds.includes(s.id) || (s.groupId && state.selectedIds.includes(s.groupId))) {
        selectedFullIds.add(s.id);
      }
    });

    const newShapes = [...state.shapes];
    for (let i = 1; i < newShapes.length; i++) {
      if (selectedFullIds.has(newShapes[i].id) && !selectedFullIds.has(newShapes[i - 1].id)) {
        const temp = newShapes[i];
        newShapes[i] = newShapes[i - 1];
        newShapes[i - 1] = temp;
      }
    }
    return { shapes: newShapes };
  }),

  duplicateSelected: () => {
    const state = get();
    if (state.selectedIds.length === 0) return;
    state.pushHistory();

    const selectedFullIds = new Set<string>();
    state.shapes.forEach(s => {
      if (state.selectedIds.includes(s.id) || (s.groupId && state.selectedIds.includes(s.groupId))) {
        selectedFullIds.add(s.id);
      }
    });

    const copied = state.shapes.filter(s => selectedFullIds.has(s.id));
    
    const idMap: { [oldId: string]: string } = {};
    const newShapes = copied.map(s => {
      const newId = Math.random().toString(36).substring(2, 9);
      idMap[s.id] = newId;
      return {
        ...s,
        id: newId,
        x: s.x + 20,
        y: s.y + 20,
        name: s.name ? `${s.name} Copy` : undefined
      };
    });

    newShapes.forEach(s => {
      if (s.groupId && idMap[s.groupId]) {
        s.groupId = idMap[s.groupId];
      }
      if (s.childrenIds) {
        s.childrenIds = s.childrenIds.map(cid => idMap[cid] || cid);
      }
    });

    set((s) => ({
      shapes: [...s.shapes, ...newShapes],
      selectedIds: newShapes.map(ns => ns.id)
    }));
  },

  copySelected: () => {
    const state = get();
    if (state.selectedIds.length === 0) return;
    const selectedFullIds = new Set<string>();
    state.shapes.forEach(s => {
      if (state.selectedIds.includes(s.id) || (s.groupId && state.selectedIds.includes(s.groupId))) {
        selectedFullIds.add(s.id);
      }
    });
    const copied = state.shapes.filter(s => selectedFullIds.has(s.id));
    set({ copiedShapes: copied });
  },

  cutSelected: () => {
    const state = get();
    if (state.selectedIds.length === 0) return;
    state.copySelected();
    state.removeSelected();
  },

  pasteCopied: () => {
    const state = get();
    if (state.copiedShapes.length === 0) return;
    state.pushHistory();

    const idMap: { [oldId: string]: string } = {};
    const newShapes = state.copiedShapes.map(s => {
      const newId = Math.random().toString(36).substring(2, 9);
      idMap[s.id] = newId;
      return {
        ...s,
        id: newId,
        x: s.x + 20,
        y: s.y + 20
      };
    });

    newShapes.forEach(s => {
      if (s.groupId && idMap[s.groupId]) {
        s.groupId = idMap[s.groupId];
      }
      if (s.childrenIds) {
        s.childrenIds = s.childrenIds.map(cid => idMap[cid] || cid);
      }
    });

    set((s) => ({
      shapes: [...s.shapes, ...newShapes],
      selectedIds: newShapes.map(ns => ns.id)
    }));
  },

  convertToPath: () => set((state) => {
    if (state.selectedIds.length === 0) return state;
    state.pushHistory();

    const selectedFullIds = new Set<string>();
    state.shapes.forEach(s => {
      if (state.selectedIds.includes(s.id) || (s.groupId && state.selectedIds.includes(s.groupId))) {
        selectedFullIds.add(s.id);
      }
    });

    const newShapes = state.shapes.map(s => {
      if (!selectedFullIds.has(s.id)) return s;
      if (s.type === 'rectangle') {
        return {
          ...s,
          type: 'path' as const,
          points: [
            { x: -0.5, y: -0.5 },
            { x: 0.5, y: -0.5 },
            { x: 0.5, y: 0.5 },
            { x: -0.5, y: 0.5 }
          ],
          closed: true
        };
      } else if (s.type === 'ellipse') {
        const points = [];
        const numPoints = 24;
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * 2 * Math.PI;
          points.push({
            x: 0.5 * Math.cos(angle),
            y: 0.5 * Math.sin(angle)
          });
        }
        return {
          ...s,
          type: 'path' as const,
          points,
          closed: true
        };
      }
      return s;
    });

    return { shapes: newShapes };
  }),

  reorientPath: () => set((state) => {
    if (state.selectedIds.length === 0) return state;
    state.pushHistory();

    const selectedFullIds = new Set<string>();
    state.shapes.forEach(s => {
      if (state.selectedIds.includes(s.id) || (s.groupId && state.selectedIds.includes(s.groupId))) {
        selectedFullIds.add(s.id);
      }
    });

    const newShapes = state.shapes.map(s => {
      if (!selectedFullIds.has(s.id)) return s;
      if (s.type === 'path' && s.points) {
        return {
          ...s,
          points: [...s.points].reverse()
        };
      }
      return s;
    });

    return { shapes: newShapes };
  }),

  clearDocument: () => set((state) => {
    state.pushHistory();
    return {
      shapes: [],
      selectedIds: [],
      hoveredId: null
    };
  })
}));
