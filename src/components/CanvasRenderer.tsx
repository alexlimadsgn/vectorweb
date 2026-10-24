import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { useStore } from '../store/useStore';
import { screenToCanvas, canvasToScreen, isPointInShape, getShapeBounds, getShapeWorldAABB, generateId, detectHandleHit, DragAction } from '../lib/geometry';
import { BaseShape } from '../types';
import { getAnimatedShape, getMotionPathNodes, MotionSegment } from '../lib/animationUtils';
import { calculateMoveSnap, AlignmentGuide } from '../lib/snapUtils';
import { simplifyPoints, smoothToBezier } from '../lib/pathUtils';
import { applyStrokeStyle, applyShadow } from '../lib/strokeUtils';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import {
  Scissors, Copy, CopyPlus, Trash2,
  ChevronsUp, ChevronUp, ChevronDown, ChevronsDown,
  Group, Ungroup, Lock, Unlock, Eye, EyeOff,
  Sparkles, Clipboard, MousePointer2, Plus,
  Square, Circle, Pen, Frame, Maximize2, Search,
  Ruler, Box as BoxIcon, Eraser
} from 'lucide-react';

const imageCache = new Map<string, HTMLImageElement>();
const path2DCache = new Map<string, Path2D>();

const getOrCreatePath2D = (key: string, buildFn: (p: Path2D) => void): Path2D => {
  let cached = path2DCache.get(key);
  if (!cached) {
    cached = new Path2D();
    buildFn(cached);
    if (path2DCache.size > 3000) {
      path2DCache.clear();
    }
    path2DCache.set(key, cached);
  }
  return cached;
};

export default function CanvasRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    shapes, selectedIds, hoveredId, activeTool, viewport, setViewportTransform,
    selectShape, selectAll, setHovered, addShape, updateShape, updateShapes, pushHistory, removeSelected, setTool, removeShape,
    showRulers, showWireframe, toggleRulers, toggleWireframe, snapEnabled, toggleSnap,
    copiedShapes, cutSelected, copySelected, pasteCopied, duplicateSelected,
    groupShapes, ungroupShapes, bringToFront, bringForward, sendBackward, sendToBack,
    toggleLock, toggleVisibility, zoomToFit, zoomTo100, clearDocument,
    applyPresetAnimation, clearAnimationForShape,
    isPlaying, currentTime, setCurrentTime, duration, isLooping, animations,
    isEditingPathNodes, selectedNodeIndex, selectedHandleType, setEditingPathNodes, setSelectedNode, setSelectedIds
  } = useStore();

  // Ticker for animation playback
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const state = useStore.getState();
      if (state.isPlaying) {
        const delta = ((now - lastTime) / 1000) * (state.playbackSpeed || 1);
        lastTime = now;

        let nextTime = state.currentTime + delta;
        if (nextTime >= state.duration) {
          if (state.isLooping) {
            nextTime = nextTime % state.duration;
          } else {
            nextTime = state.duration;
            state.setIsPlaying(false);
          }
        }
        state.setCurrentTime(nextTime);
      } else {
        lastTime = now;
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);
  
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const initialViewportTransformRef = useRef({ x: 0, y: 0, scale: 1 });
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  isDrawingRef.current = isDrawing;
  const [isDragging, setIsDragging] = useState(false);
  const dragDidMove = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [dragAction, setDragAction] = useState<DragAction>('none');
  const initialDragStart = useRef<{ x: number; y: number } | null>(null);
  const dragStartChildrenStates = useRef<Map<string, { x: number; y: number; width: number; height: number; rotation: number; anchorX: number; anchorY: number }>>(new Map());
  const pendingClickSelection = useRef<{ id: string; shiftKey: boolean; forceIndividual?: boolean } | null>(null);

  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialSelectedIdsRef = useRef<string[]>([]);
  const [isDraggingAnchor, setIsDraggingAnchor] = useState(false);
  const [isDraggingNodeHandle, setIsDraggingNodeHandle] = useState(false);
  const anchorDragStart = useRef<{ x: number, y: number } | null>(null);
  const dragStartShapeState = useRef<{ x: number, y: number, width: number, height: number, rotation: number, anchorX: number, anchorY: number } | null>(null);
  const dragStartAnchor = useRef<{ x: number, y: number } | null>(null);
  const drawStartPos = useRef<{ x: number, y: number } | null>(null);
  const hoverPosRef = useRef<{ x: number, y: number } | null>(null);
  const pendingPointerEventRef = useRef<{ clientX: number; clientY: number; shiftKey: boolean; altKey: boolean } | null>(null);
  const moveRafIdRef = useRef<number | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  // Rectangle whose corner-radius handles are visible (hovered or selected+hovered)
  const [radiusHoverId, setRadiusHoverId] = useState<string | null>(null);
  // Bumped on pointer move while drawing so the live preview follows the cursor
  const [drawHoverTick, setDrawHoverTick] = useState(0);
  // Pen (Bézier): index of the node whose handles are being dragged out
  const penDragIndexRef = useRef<number | null>(null);
  // Pencil: raw freehand points in world coordinates
  const freehandPointsRef = useRef<{ x: number; y: number }[] | null>(null);
  // Motion path editing: dragging a keyframe node or a segment's curve handle
  const motionDragRef = useRef<{ kind: 'node'; time: number } | { kind: 'curve'; from: number; to: number } | null>(null);
  const showMotionPath = useStore((s) => s.showMotionPath);
  const setMotionNode = useStore((s) => s.setMotionNode);
  const setMotionControl = useStore((s) => s.setMotionControl);

  const segmentMidpoint = (seg: MotionSegment) => seg.cp
    ? { x: 0.25 * seg.from.x + 0.5 * seg.cp.x + 0.25 * seg.to.x, y: 0.25 * seg.from.y + 0.5 * seg.cp.y + 0.25 * seg.to.y }
    : { x: (seg.from.x + seg.to.x) / 2, y: (seg.from.y + seg.to.y) / 2 };

  // Motion path of the single selected shape, in shape-position (top-left) space plus the
  // offset that maps it to the shape center for display.
  const getMotionPathInfo = () => {
    if (!showMotionPath || activeTool !== 'select' || isDrawing || selectedIds.length !== 1) return null;
    const raw = shapes.find(s => s.id === selectedIds[0]);
    if (!raw || raw.type === 'group') return null;
    const path = getMotionPathNodes(raw, animations);
    if (!path) return null;
    const anim = getAnimatedShape(raw, currentTime, animations);
    return { raw, ...path, offX: anim.width / 2, offY: anim.height / 2 };
  };
  const [canvasSizeTick, setCanvasSizeTick] = useState(0);
  const [activeAlignmentGuides, setActiveAlignmentGuides] = useState<AlignmentGuide[]>([]);

  const finalizePathDrawing = (activeShape: BaseShape, isClosed: boolean = false) => {
    if (!activeShape.points || activeShape.points.length <= 1) {
      removeShape(activeShape.id);
      setIsDrawing(false);
      setTool('select');
      return;
    }

    let rawPoints = [...activeShape.points];
    if (isClosed && rawPoints.length > 2) {
      const first = rawPoints[0];
      const last = rawPoints[rawPoints.length - 1];
      if (Math.hypot(last.x - first.x, last.y - first.y) < 1) {
        rawPoints.pop();
      }
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rawPoints.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.cp1) {
        if (p.cp1.x < minX) minX = p.cp1.x;
        if (p.cp1.y < minY) minY = p.cp1.y;
        if (p.cp1.x > maxX) maxX = p.cp1.x;
        if (p.cp1.y > maxY) maxY = p.cp1.y;
      }
      if (p.cp2) {
        if (p.cp2.x < minX) minX = p.cp2.x;
        if (p.cp2.y < minY) minY = p.cp2.y;
        if (p.cp2.x > maxX) maxX = p.cp2.x;
        if (p.cp2.y > maxY) maxY = p.cp2.y;
      }
    });

    let width = maxX - minX;
    let height = maxY - minY;
    if (width === 0) width = 1;
    if (height === 0) height = 1;

    const cx = minX + width / 2;
    const cy = minY + height / 2;

    const normalizedPoints = rawPoints.map(p => ({
      ...p,
      x: (p.x - cx) / width,
      y: (p.y - cy) / height,
      cp1: p.cp1 ? { x: (p.cp1.x - cx) / width, y: (p.cp1.y - cy) / height } : undefined,
      cp2: p.cp2 ? { x: (p.cp2.x - cx) / width, y: (p.cp2.y - cy) / height } : undefined,
    }));

    updateShape(activeShape.id, {
      x: minX,
      y: minY,
      width,
      height,
      fill: isClosed ? (activeShape.fill !== 'transparent' ? activeShape.fill : '#D3D3D3') : activeShape.fill,
      closed: isClosed,
      points: normalizedPoints
    });

    setIsDrawing(false);
    setTool('select');
  };

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    type: 'object' | 'canvas';
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'canvas'
  });

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = screenToCanvas(e.clientX, e.clientY, viewport.transform);

    const hitShape = [...shapes].reverse().find(s => {
      if (s.hidden) return false;
      const animShape = getAnimatedShape(s, currentTime, animations);
      return isPointInShape(pos.x, pos.y, animShape);
    });

    if (hitShape) {
      const forceIndividual = e.ctrlKey || e.metaKey;
      const targetId = forceIndividual ? hitShape.id : (hitShape.groupId || hitShape.id);

      if (!selectedIds.includes(targetId) && !selectedIds.includes(hitShape.id)) {
        selectShape(hitShape.id, e.shiftKey, forceIndividual);
      }

      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        type: 'object'
      });
    } else {
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        type: 'canvas'
      });
    }
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    if (contextMenu.type === 'object') {
      const activeShape = shapes.find(s => selectedIds.includes(s.id));
      const isLocked = activeShape?.locked;
      const isHidden = activeShape?.hidden;
      const canUngroup = selectedIds.some(id =>
        shapes.some(s => (s.groupId === id || (s.type === 'group' && s.id === id)))
      );

      return [
        {
          id: 'cut',
          label: 'Recortar',
          icon: <Scissors size={14} />,
          shortcut: 'Ctrl+X',
          onClick: cutSelected
        },
        {
          id: 'copy',
          label: 'Copiar',
          icon: <Copy size={14} />,
          shortcut: 'Ctrl+C',
          onClick: copySelected
        },
        {
          id: 'duplicate',
          label: 'Duplicar',
          icon: <CopyPlus size={14} />,
          shortcut: 'Ctrl+D',
          onClick: duplicateSelected
        },
        {
          id: 'delete',
          label: 'Excluir Objeto',
          icon: <Trash2 size={14} />,
          shortcut: 'Del',
          danger: true,
          onClick: removeSelected
        },
        { id: 'div1', label: '', divider: true },
        {
          id: 'front',
          label: 'Trazer para Frente',
          icon: <ChevronsUp size={14} />,
          shortcut: 'Ctrl+]',
          onClick: bringToFront
        },
        {
          id: 'forward',
          label: 'Avançar Camada',
          icon: <ChevronUp size={14} />,
          shortcut: ']',
          onClick: bringForward
        },
        {
          id: 'backward',
          label: 'Recuar Camada',
          icon: <ChevronDown size={14} />,
          shortcut: '[',
          onClick: sendBackward
        },
        {
          id: 'back',
          label: 'Enviar para Trás',
          icon: <ChevronsDown size={14} />,
          shortcut: 'Ctrl+[',
          onClick: sendToBack
        },
        { id: 'div2', label: '', divider: true },
        {
          id: 'group',
          label: 'Agrupar Seleção',
          icon: <Group size={14} />,
          shortcut: 'Ctrl+G',
          disabled: selectedIds.length < 2,
          onClick: groupShapes
        },
        {
          id: 'ungroup',
          label: 'Desagrupar',
          icon: <Ungroup size={14} />,
          shortcut: 'Ctrl+Shift+G',
          disabled: !canUngroup,
          onClick: ungroupShapes
        },
        { id: 'div3', label: '', divider: true },
        {
          id: 'lock',
          label: isLocked ? 'Desbloquear Objeto' : 'Bloquear Objeto',
          icon: isLocked ? <Unlock size={14} /> : <Lock size={14} />,
          onClick: () => selectedIds.forEach(id => toggleLock(id))
        },
        {
          id: 'visibility',
          label: isHidden ? 'Mostrar Objeto' : 'Ocultar Objeto',
          icon: isHidden ? <Eye size={14} /> : <EyeOff size={14} />,
          onClick: () => selectedIds.forEach(id => toggleVisibility(id))
        },
        { id: 'div4', label: '', divider: true },
        {
          id: 'animations',
          label: 'Animações Rápidas',
          icon: <Sparkles size={14} />,
          submenu: [
            {
              id: 'anim-fade',
              label: '✨ Fade In',
              onClick: () => activeShape && applyPresetAnimation(activeShape.id, 'Fade In')
            },
            {
              id: 'anim-bounce',
              label: '💥 Pop / Bounce',
              onClick: () => activeShape && applyPresetAnimation(activeShape.id, 'Pop')
            },
            {
              id: 'anim-spin',
              label: '🔄 Girar 360° (Spin)',
              onClick: () => activeShape && applyPresetAnimation(activeShape.id, 'Spin')
            },
            {
              id: 'anim-clear',
              label: '🧹 Remover Animação',
              onClick: () => activeShape && clearAnimationForShape(activeShape.id)
            }
          ]
        }
      ];
    }

    return [
      {
        id: 'paste',
        label: 'Colar Objeto',
        icon: <Clipboard size={14} />,
        shortcut: 'Ctrl+V',
        disabled: copiedShapes.length === 0,
        onClick: pasteCopied
      },
      {
        id: 'select-all',
        label: 'Selecionar Tudo',
        icon: <MousePointer2 size={14} />,
        shortcut: 'Ctrl+A',
        onClick: selectAll
      },
      { id: 'div1', label: '', divider: true },
      {
        id: 'add-shape',
        label: 'Adicionar Objeto',
        icon: <Plus size={14} />,
        submenu: [
          {
            id: 'add-rect',
            label: 'Retângulo',
            icon: <Square size={14} />,
            onClick: () => setTool('rectangle')
          },
          {
            id: 'add-ellipse',
            label: 'Elipse',
            icon: <Circle size={14} />,
            onClick: () => setTool('ellipse')
          },
          {
            id: 'add-pen',
            label: 'Vetor / Caneta (Pen)',
            icon: <Pen size={14} />,
            onClick: () => setTool('pen')
          },
          {
            id: 'add-frame',
            label: 'Frame',
            icon: <Frame size={14} />,
            onClick: () => setTool('frame')
          }
        ]
      },
      { id: 'div2', label: '', divider: true },
      {
        id: 'zoom-fit',
        label: 'Ajustar à Tela',
        icon: <Maximize2 size={14} />,
        shortcut: 'Ctrl+0',
        onClick: zoomToFit
      },
      {
        id: 'zoom-100',
        label: 'Zoom 100%',
        icon: <Search size={14} />,
        shortcut: 'Ctrl+1',
        onClick: zoomTo100
      },
      { id: 'div3', label: '', divider: true },
      {
        id: 'toggle-rulers',
        label: showRulers ? 'Ocultar Réguas' : 'Mostrar Réguas',
        icon: <Ruler size={14} />,
        onClick: toggleRulers
      },
      {
        id: 'toggle-wireframe',
        label: showWireframe ? 'Ocultar Modo Aramado' : 'Modo Aramado (Wireframe)',
        icon: <BoxIcon size={14} />,
        onClick: toggleWireframe
      },
      { id: 'div4', label: '', divider: true },
      {
        id: 'clear',
        label: 'Limpar Canvas',
        icon: <Eraser size={14} />,
        danger: true,
        disabled: shapes.length === 0,
        onClick: clearDocument
      }
    ];
  };
  
  // For Spacebar panning shortcut and deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const state = useStore.getState();
        if (e.shiftKey) {
            state.redo();
        } else {
            state.undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const state = useStore.getState();
        if (e.shiftKey) {
            state.ungroupShapes();
        } else {
            state.groupShapes();
        }
        return;
      }

      if (e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        useStore.getState().toggleRulers();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        useStore.getState().copySelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        useStore.getState().cutSelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        useStore.getState().pasteCopied();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        useStore.getState().duplicateSelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
        e.preventDefault();
        if (e.shiftKey) {
          useStore.getState().bringToFront();
        } else {
          useStore.getState().bringForward();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        if (e.shiftKey) {
          useStore.getState().sendToBack();
        } else {
          useStore.getState().sendBackward();
        }
        return;
      }

      if (e.code === 'Space') {
        setSpacePressed(true);
        if (!isPanning) document.body.style.cursor = 'grab';
      }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        removeSelected();
      }

      // Tool switching shortcuts
      if (e.key === 'v' || e.key === 'V') {
         const state = useStore.getState();
         state.setTool('select');
      } else if (e.key === 'f' || e.key === 'F') {
         const state = useStore.getState();
         state.setTool('frame');
      } else if (e.key === 'p' || e.key === 'P') {
         const state = useStore.getState();
         state.setTool('pen');
      } else if (e.key === 'b' || e.key === 'B') {
         const state = useStore.getState();
         state.setTool('bezier');
      } else if (e.key === 'Escape') {
         const state = useStore.getState();
         if (state.isEditingPathNodes) {
            state.setEditingPathNodes(false);
         }
         if (isDrawingRef.current && (state.activeTool === 'bezier' || state.activeTool === 'pen')) {
            const activeShape = state.shapes.find(s => s.id === state.selectedIds[0]);
            if (activeShape && activeShape.type === 'path') finalizePathDrawing(activeShape, false);
         }
      } else if (e.key === 'Enter') {
         const state = useStore.getState();
         if (isDrawingRef.current && state.selectedIds.length > 0) {
            const activeShape = state.shapes.find(s => s.id === state.selectedIds[0]);
            if (activeShape && activeShape.type === 'path') {
               finalizePathDrawing(activeShape, false);
            }
         }
      } else if (e.key === 'r' || e.key === 'R') {
         const state = useStore.getState();
         state.setTool('rectangle');
      } else if (e.key === 'e' || e.key === 'E') {
         const state = useStore.getState();
         state.setTool('ellipse');
      } else if (e.key === 'h' || e.key === 'H') {
         const state = useStore.getState();
         state.setTool('hand');
      }

      // Zoom shortcuts
      const state = useStore.getState();
      if (e.shiftKey) {
        if (e.code === 'Digit0' || e.code === 'Numpad0') {
           e.preventDefault();
           state.zoomTo100();
        } else if (e.code === 'Digit1' || e.code === 'Numpad1') {
           e.preventDefault();
           state.zoomToFit();
        } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
           e.preventDefault();
           state.zoomToSelection();
        }
      } 
      
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        state.zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        state.zoomOut();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
        if (!isPanning) document.body.style.cursor = 'default';
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPanning, removeSelected]);

  // Handle native wheel event for complex zoom/pan
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useStore.getState();
      const transform = state.viewport.transform;
      const { setViewportTransform } = state;

      if (e.ctrlKey || e.metaKey || !e.shiftKey) {
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        let newScale = transform.scale * zoomFactor;
        newScale = Math.max(0.05, Math.min(newScale, 50));

        const rect = containerRef.current?.getBoundingClientRect();
        const mouseX = rect ? e.clientX - rect.left : e.clientX;
        const mouseY = rect ? e.clientY - rect.top : e.clientY;

        const nextX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
        const nextY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);

        setViewportTransform({ x: nextX, y: nextY, scale: newScale });
      } else {
        setViewportTransform({
          x: transform.x - e.deltaX,
          y: transform.y - e.deltaY,
          scale: transform.scale
        });
      }
    };

    const div = containerRef.current;
    if (div) {
      div.addEventListener('wheel', onWheel, { passive: false });
      return () => div.removeEventListener('wheel', onWheel);
    }
  }, []);

  // ResizeObserver for canvas buffer resolution matching CSS container size without stretching
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCanvasDimensions = () => {
      const canvas = canvasRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(1, Math.round(rect.width * dpr));
      const targetH = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        setCanvasSizeTick(n => n + 1);
      }
    };

    updateCanvasDimensions();

    const observer = new ResizeObserver(() => {
      updateCanvasDimensions();
    });

    observer.observe(container);
    window.addEventListener('resize', updateCanvasDimensions);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, []);

  const getCanvasPos = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewport.transform.x) / viewport.transform.scale,
      y: (clientY - rect.top - viewport.transform.y) / viewport.transform.scale,
    };
  };

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const targetW = Math.max(1, Math.round(rect.width * dpr));
        const targetH = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(viewport.transform.x, viewport.transform.y);
    ctx.scale(viewport.transform.scale, viewport.transform.scale);

    // Compute visible viewport bounds in world coordinates for Viewport Culling
    const scale = viewport.transform.scale;
    const viewLeft = -viewport.transform.x / scale;
    const viewTop = -viewport.transform.y / scale;
    const viewRight = viewLeft + canvas.width / (scale * dpr);
    const viewBottom = viewTop + canvas.height / (scale * dpr);
    const cullMargin = 2000 / scale; // Generous margin to prevent off-screen disappearance during resize

    shapes.forEach(rawShape => {
      if (rawShape.hidden) return; // Ignore hidden shapes
      const shape = getAnimatedShape(rawShape, currentTime, animations);

      const isSelected = selectedIds.includes(shape.id);
      const isHovered = shape.id === hoveredId;
      const isCurrentlyDrawing = isDrawing && (activeTool === 'pen' || activeTool === 'bezier') && isSelected && shape.type === 'path';

      // --- Viewport Culling: Skip shapes outside current view ---
      if (!isSelected && !isHovered && !isCurrentlyDrawing) {
        const aabb = getShapeWorldAABB(shape);
        if (
          aabb.maxX < viewLeft - cullMargin ||
          aabb.minX > viewRight + cullMargin ||
          aabb.maxY < viewTop - cullMargin ||
          aabb.minY > viewBottom + cullMargin
        ) {
          return; // Off-screen shape culled from render pass
        }
      }

      ctx.save();
      const ax_offset = (shape.anchorX !== undefined ? shape.anchorX : 0.5) * shape.width;
      const ay_offset = (shape.anchorY !== undefined ? shape.anchorY : 0.5) * shape.height;
      const hw = shape.width / 2;
      const hh = shape.height / 2;
      
      if (shape.type !== 'path' || !isCurrentlyDrawing) {
          const rad = (shape.rotation || 0) * Math.PI / 180;
          const ax = shape.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
          const ay = shape.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);
          ctx.translate(ax, ay);
          ctx.rotate(rad);
      } else {
          ctx.translate(shape.x, shape.y);
      }

      ctx.fillStyle = shape.fill;
      ctx.strokeStyle = shape.stroke;
      ctx.lineWidth = shape.strokeWidth;
      ctx.globalAlpha = shape.opacity;

      if (showWireframe) {
        ctx.fillStyle = 'rgba(88, 86, 214, 0.03)';
        ctx.strokeStyle = '#5856D6';
        ctx.lineWidth = 1 / viewport.transform.scale;
      }

      // Stroke style (cap/join/dash/trim) and drop shadow; wireframe shows raw geometry
      const strokeVisible = showWireframe || isCurrentlyDrawing || shape.type === 'frame' ? true : applyStrokeStyle(ctx, shape);
      if (!showWireframe && shape.type !== 'frame') applyShadow(ctx, shape, viewport.transform.scale * dpr);

      if (shape.type === 'frame') {
        const r = Math.max(0, shape.radius || 0);
        const cacheKey = `frame_${shape.width}_${shape.height}_${r}_${ax_offset}_${ay_offset}`;
        const path = getOrCreatePath2D(cacheKey, p => {
          if (r > 0 && typeof p.roundRect === 'function') {
            p.roundRect(-ax_offset, -ay_offset, shape.width, shape.height, r);
          } else {
            p.rect(-ax_offset, -ay_offset, shape.width, shape.height);
          }
        });

        if (shape.fill !== 'transparent' || showWireframe) ctx.fill(path);
        if ((shape.strokeWidth > 0 && shape.stroke !== 'transparent') || showWireframe) {
          ctx.stroke(path);
        } else {
          ctx.save();
          ctx.strokeStyle = '#38383E';
          ctx.lineWidth = 1 / viewport.transform.scale;
          ctx.stroke(path);
          ctx.restore();
        }

        // Draw Frame Title & Dimensions Badge above top-left
        ctx.save();
        const frameTitle = shape.name || 'Frame';
        // Constant on-screen size regardless of zoom
        const fontSize = 11 / viewport.transform.scale;
        ctx.font = `600 ${fontSize}px sans-serif`;
        const textMetrics = ctx.measureText(frameTitle);
        const padding = 6 / viewport.transform.scale;
        const badgeW = textMetrics.width + padding * 2;
        const badgeH = 20 / viewport.transform.scale;
        const badgeX = -ax_offset;
        const badgeY = -ay_offset - badgeH - (4 / viewport.transform.scale);

        ctx.fillStyle = isSelected ? '#6366F1' : '#27272A';
        ctx.strokeStyle = isSelected ? '#818CF8' : '#3F3F46';
        ctx.lineWidth = 1 / viewport.transform.scale;

        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4 / viewport.transform.scale);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
          ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
        }

        ctx.fillStyle = isSelected ? '#FFFFFF' : '#A1A1AA';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(frameTitle, badgeX + padding, badgeY + badgeH / 2);
        ctx.restore();
      } else if (shape.type === 'rectangle') {
        const r = Math.max(0, shape.radius || 0);
        const cacheKey = `rect_${shape.width}_${shape.height}_${r}_${ax_offset}_${ay_offset}`;
        const path = getOrCreatePath2D(cacheKey, p => {
          if (r > 0 && typeof p.roundRect === 'function') {
            p.roundRect(-ax_offset, -ay_offset, shape.width, shape.height, r);
          } else {
            p.rect(-ax_offset, -ay_offset, shape.width, shape.height);
          }
        });

        if (shape.imageUrl && !showWireframe) {
          let img = imageCache.get(shape.imageUrl);
          if (!img) {
            img = new Image();
            img.src = shape.imageUrl;
            img.onload = () => {
              // Image loaded, canvas will redraw on next frame
            };
            imageCache.set(shape.imageUrl, img);
          }
          ctx.save();
          ctx.clip(path);
          try {
            if (img.complete) {
              ctx.drawImage(img, -ax_offset, -ay_offset, shape.width, shape.height);
            }
          } catch (e) {}
          ctx.restore();
        } else {
          if (shape.fill !== 'transparent' || showWireframe) ctx.fill(path);
        }
        if ((shape.strokeWidth > 0 && shape.stroke !== 'transparent' && strokeVisible) || showWireframe) ctx.stroke(path);
      } else if (shape.type === 'ellipse') {
        const rx = Math.abs(shape.width / 2);
        const ry = Math.abs(shape.height / 2);
        const cacheKey = `ellipse_${shape.width}_${shape.height}_${ax_offset}_${ay_offset}`;
        const path = getOrCreatePath2D(cacheKey, p => {
          p.ellipse(shape.width / 2 - ax_offset, shape.height / 2 - ay_offset, rx, ry, 0, 0, 2 * Math.PI);
        });

        if (shape.fill !== 'transparent' || showWireframe) ctx.fill(path);
        if ((shape.strokeWidth > 0 && shape.stroke !== 'transparent' && strokeVisible) || showWireframe) ctx.stroke(path);
      } else if (shape.type === 'path' && shape.points && shape.points.length > 0) {
        // Points are normalized around the shape center; offset to the anchor-based origin
        const offX = isCurrentlyDrawing ? 0 : hw - ax_offset;
        const offY = isCurrentlyDrawing ? 0 : hh - ay_offset;
        const sx = isCurrentlyDrawing ? 1 : shape.width;
        const sy = isCurrentlyDrawing ? 1 : shape.height;
        const tx = (v: number) => v * sx + offX;
        const ty = (v: number) => v * sy + offY;
        const buildPath = (p: Path2D) => {
          const pts = shape.points!;
          p.moveTo(tx(pts[0].x), ty(pts[0].y));
          const segment = (prev: typeof pts[0], curr: typeof pts[0]) => {
            if (prev.cp2 || curr.cp1) {
              const c1 = prev.cp2 || prev;
              const c2 = curr.cp1 || curr;
              p.bezierCurveTo(tx(c1.x), ty(c1.y), tx(c2.x), ty(c2.y), tx(curr.x), ty(curr.y));
            } else {
              p.lineTo(tx(curr.x), ty(curr.y));
            }
          };
          for (let i = 1; i < pts.length; i++) segment(pts[i - 1], pts[i]);
          if (shape.closed && pts.length > 2) {
            segment(pts[pts.length - 1], pts[0]);
            p.closePath();
          }
        };
        const path = isCurrentlyDrawing
          ? (() => { const p = new Path2D(); buildPath(p); return p; })()
          : getOrCreatePath2D(
              `path_${shape.id}_${shape.width}_${shape.height}_${offX}_${offY}_${shape.closed}_${JSON.stringify(shape.points)}`,
              buildPath
            );

        if ((shape.fill !== 'transparent' && !isCurrentlyDrawing) || showWireframe) ctx.fill(path);
        if ((shape.strokeWidth > 0 && shape.stroke !== 'transparent' && strokeVisible) || showWireframe) ctx.stroke(path);
      }
      ctx.restore();

      const bounds = getShapeBounds(shape);

      if (shape.id === hoveredId && !selectedIds.includes(shape.id) && !isCurrentlyDrawing) {
        ctx.save();
        const ax_offset = (shape.anchorX !== undefined ? shape.anchorX : 0.5) * shape.width;
        const ay_offset = (shape.anchorY !== undefined ? shape.anchorY : 0.5) * shape.height;
        const hw = shape.width / 2;
        const hh = shape.height / 2;
        const rad = (shape.rotation || 0) * Math.PI / 180;
        const ax = shape.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
        const ay = shape.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);

        ctx.translate(ax, ay);
        ctx.rotate(rad);
        ctx.strokeStyle = '#5856d6';
        ctx.lineWidth = 1.5 / viewport.transform.scale;
        ctx.setLineDash([5 / viewport.transform.scale, 5 / viewport.transform.scale]);
        ctx.strokeRect(-ax_offset, -ay_offset, shape.width, shape.height);
        ctx.restore();
      }

      const isSelectedForOverlay = selectedIds.includes(shape.id);
      if ((isSelectedForOverlay || shape.id === radiusHoverId) && !isCurrentlyDrawing) {
        ctx.save();
        const ax_offset = (shape.anchorX !== undefined ? shape.anchorX : 0.5) * shape.width;
        const ay_offset = (shape.anchorY !== undefined ? shape.anchorY : 0.5) * shape.height;
        const hw = shape.width / 2;
        const hh = shape.height / 2;
        const rad = (shape.rotation || 0) * Math.PI / 180;
        const ax = shape.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
        const ay = shape.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);

        ctx.translate(ax, ay);
        ctx.rotate(rad);
        if (isSelectedForOverlay) {
          ctx.strokeStyle = '#5856d6';
          ctx.lineWidth = 1.5 / viewport.transform.scale;
          ctx.strokeRect(-ax_offset, -ay_offset, shape.width, shape.height);
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = '#5856D6';
          ctx.lineWidth = 2 / viewport.transform.scale;
          const handleSize = 6 / viewport.transform.scale;
          const positions = [
            [-ax_offset, -ay_offset],
            [shape.width - ax_offset, -ay_offset],
            [-ax_offset, shape.height - ay_offset],
            [shape.width - ax_offset, shape.height - ay_offset]
          ];
          positions.forEach(([hx, hy]) => {
             ctx.fillRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
             ctx.strokeRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
          });
        }
        ctx.restore();

        // DRAW ANCHOR POINT MARKER (only if manual mode active)
        if (isSelectedForOverlay && shape.type !== 'group' && shape.editAnchorManual) {
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(rad);
          
          const isManualMode = !!shape.editAnchorManual;
          const markerColor = isManualMode ? '#3b82f6' : '#5856D6';
          const outerSize = (isManualMode ? 14 : 10) / viewport.transform.scale;
          const innerSize = (isManualMode ? 6 : 4) / viewport.transform.scale;

          // Outer circle
          ctx.beginPath();
          ctx.arc(0, 0, outerSize / 2, 0, 2 * Math.PI);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 2 / viewport.transform.scale;
          ctx.stroke();

          // Outer crosshairs for manual mode
          if (isManualMode) {
             ctx.beginPath();
             ctx.moveTo(-outerSize, 0); ctx.lineTo(outerSize, 0);
             ctx.moveTo(0, -outerSize); ctx.lineTo(0, outerSize);
             ctx.strokeStyle = '#3b82f6';
             ctx.lineWidth = 1 / viewport.transform.scale;
             ctx.stroke();
          }

          // Inner solid dot
          ctx.beginPath();
          ctx.arc(0, 0, innerSize / 2, 0, 2 * Math.PI);
          ctx.fillStyle = markerColor;
          ctx.fill();

          ctx.restore();
        }

        // DRAW INNER CORNER RADIUS HANDLES FOR RECTANGLES
        if (shape.type === 'rectangle' && (shape.id === radiusHoverId || (dragAction === 'radius' && selectedIds[0] === shape.id))) {
          const maxPossibleRadius = Math.min(Math.abs(shape.width), Math.abs(shape.height)) / 2;
          const currentRadius = shape.radius || 0;
          const isRadiusAtLimit = currentRadius >= maxPossibleRadius - 0.5;
          const isShapeTooSmall = Math.min(Math.abs(shape.width), Math.abs(shape.height)) < 24;

          // Hide radius handles when radius is at max limit or shape is too small
          if (!isRadiusAtLimit && !isShapeTooSmall) {
            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(rad);

            const r = currentRadius;
            const offset = Math.max(12, r);
            
            const innerPositions: [number, number][] = [
              [offset - ax_offset, offset - ay_offset],
              [shape.width - offset - ax_offset, offset - ay_offset],
              [offset - ax_offset, shape.height - offset - ay_offset],
              [shape.width - offset - ax_offset, shape.height - offset - ay_offset]
            ];

            // Find closest handle to mouse position to display the Radius tag
            let activeHandleIdx = 0;
            const mousePos = hoverPosRef.current;
            if (mousePos) {
              const rx_local = (mousePos.x - ax) * Math.cos(-rad) - (mousePos.y - ay) * Math.sin(-rad);
              const ry_local = (mousePos.x - ax) * Math.sin(-rad) + (mousePos.y - ay) * Math.cos(-rad);

              let minDist = Infinity;
              innerPositions.forEach(([hx, hy], idx) => {
                const dist = Math.hypot(rx_local - hx, ry_local - hy);
                if (dist < minDist) {
                  minDist = dist;
                  activeHandleIdx = idx;
                }
              });
            }

            innerPositions.forEach(([hx, hy]) => {
              ctx.beginPath();
              ctx.arc(hx, hy, 5 / viewport.transform.scale, 0, 2 * Math.PI);
              ctx.fillStyle = '#FFFFFF';
              ctx.fill();
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 1.5 / viewport.transform.scale;
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(hx, hy, 2 / viewport.transform.scale, 0, 2 * Math.PI);
              ctx.fillStyle = '#3b82f6';
              ctx.fill();
            });

            ctx.restore();

            // Display "Radius X" badge tag ONLY while actively dragging the radius handle
            if (dragAction === 'radius') {
              const [activeHx, activeHy] = innerPositions[activeHandleIdx];
              const activeWorldX = ax + activeHx * Math.cos(rad) - activeHy * Math.sin(rad);
              const activeWorldY = ay + activeHx * Math.sin(rad) + activeHy * Math.cos(rad);

              const label = `Radius ${Math.round(r)}`;
              const scale = viewport.transform.scale;
              const fontSize = 11 / scale;

              ctx.save();
              ctx.font = `600 ${fontSize}px sans-serif, -apple-system, BlinkMacSystemFont`;

              const textMetrics = ctx.measureText(label);
              const paddingX = 7 / scale;
              const paddingY = 3.5 / scale;
              const badgeWidth = textMetrics.width + paddingX * 2;
              const badgeHeight = fontSize + paddingY * 2;

              const badgeX = activeWorldX + 10 / scale;
              const badgeY = activeWorldY - badgeHeight / 2;
              const badgeCorner = 4 / scale;

              ctx.beginPath();
              if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeCorner);
              } else {
                ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
              }
              ctx.fillStyle = '#3b82f6';
              ctx.fill();

              ctx.fillStyle = '#FFFFFF';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              ctx.fillText(label, badgeX + paddingX, badgeY + paddingY + 1 / scale);
              ctx.restore();
            }
          }
        }
      }
    });

    // DRAW SMART ALIGNMENT GUIDES (MAGNETIC SNAP LINES) - must be before ctx.restore() to use world coordinates
    if (activeAlignmentGuides.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5 / viewport.transform.scale;
      ctx.setLineDash([4 / viewport.transform.scale, 4 / viewport.transform.scale]);

      activeAlignmentGuides.forEach(guide => {
        ctx.beginPath();
        if (guide.type === 'vertical') {
          ctx.moveTo(guide.position, guide.start);
          ctx.lineTo(guide.position, guide.end);
        } else {
          ctx.moveTo(guide.start, guide.position);
          ctx.lineTo(guide.end, guide.position);
        }
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(guide.dotX, guide.dotY, 3.5 / viewport.transform.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    }

    // DRAW BEZIER NODE EDITING OVERLAY (FIGMA STYLE)
    if (isEditingPathNodes && selectedIds.length === 1) {
      const rawSelected = shapes.find(s => s.id === selectedIds[0]);
      if (rawSelected && rawSelected.type === 'path' && rawSelected.points) {
        ctx.save();
        const rad = (rawSelected.rotation || 0) * Math.PI / 180;
        const hw = rawSelected.width / 2;
        const hh = rawSelected.height / 2;
        const ax_offset = (rawSelected.anchorX !== undefined ? rawSelected.anchorX : 0.5) * rawSelected.width;
        const ay_offset = (rawSelected.anchorY !== undefined ? rawSelected.anchorY : 0.5) * rawSelected.height;
        const ax = rawSelected.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
        const ay = rawSelected.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);

        const scale = viewport.transform.scale;

        rawSelected.points.forEach((pt, idx) => {
          const lx = pt.x * rawSelected.width;
          const ly = pt.y * rawSelected.height;
          const worldPtX = ax + lx * Math.cos(rad) - ly * Math.sin(rad);
          const worldPtY = ay + lx * Math.sin(rad) + ly * Math.cos(rad);

          // Handle 1 (cp1) - Figma Diamond
          if (pt.cp1) {
            const cp1_lx = pt.cp1.x * rawSelected.width;
            const cp1_ly = pt.cp1.y * rawSelected.height;
            const worldCp1X = ax + cp1_lx * Math.cos(rad) - cp1_ly * Math.sin(rad);
            const worldCp1Y = ay + cp1_lx * Math.sin(rad) + cp1_ly * Math.cos(rad);

            ctx.beginPath();
            ctx.moveTo(worldPtX, worldPtY);
            ctx.lineTo(worldCp1X, worldCp1Y);
            ctx.strokeStyle = '#818CF8';
            ctx.lineWidth = 1 / scale;
            ctx.stroke();

            ctx.save();
            ctx.translate(worldCp1X, worldCp1Y);
            ctx.rotate(Math.PI / 4);
            const dSize = 6 / scale;
            ctx.fillStyle = (selectedNodeIndex === idx && selectedHandleType === 'cp1') ? '#3B82F6' : '#818CF8';
            ctx.fillRect(-dSize / 2, -dSize / 2, dSize, dSize);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1 / scale;
            ctx.strokeRect(-dSize / 2, -dSize / 2, dSize, dSize);
            ctx.restore();
          }

          // Handle 2 (cp2) - Figma Diamond
          if (pt.cp2) {
            const cp2_lx = pt.cp2.x * rawSelected.width;
            const cp2_ly = pt.cp2.y * rawSelected.height;
            const worldCp2X = ax + cp2_lx * Math.cos(rad) - cp2_ly * Math.sin(rad);
            const worldCp2Y = ay + cp2_lx * Math.sin(rad) + cp2_ly * Math.cos(rad);

            ctx.beginPath();
            ctx.moveTo(worldPtX, worldPtY);
            ctx.lineTo(worldCp2X, worldCp2Y);
            ctx.strokeStyle = '#818CF8';
            ctx.lineWidth = 1 / scale;
            ctx.stroke();

            ctx.save();
            ctx.translate(worldCp2X, worldCp2Y);
            ctx.rotate(Math.PI / 4);
            const dSize = 6 / scale;
            ctx.fillStyle = (selectedNodeIndex === idx && selectedHandleType === 'cp2') ? '#3B82F6' : '#818CF8';
            ctx.fillRect(-dSize / 2, -dSize / 2, dSize, dSize);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1 / scale;
            ctx.strokeRect(-dSize / 2, -dSize / 2, dSize, dSize);
            ctx.restore();
          }

          // Node Point - Figma Circle
          const isNodeSel = selectedNodeIndex === idx && (selectedHandleType === 'point' || !selectedHandleType);
          const nodeRadius = (isNodeSel ? 5.5 : 4.5) / scale;

          ctx.beginPath();
          ctx.arc(worldPtX, worldPtY, nodeRadius, 0, Math.PI * 2);
          ctx.fillStyle = isNodeSel ? '#3B82F6' : '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2 / scale;
          ctx.stroke();
        });

        ctx.restore();
      }
    }

    // DRAW MOTION PATH (dotted trajectory + draggable keyframe nodes and curve handles)
    const motion = getMotionPathInfo();
    if (motion) {
      const scale = viewport.transform.scale;
      const { raw, nodes, segments, offX, offY } = motion;
      ctx.save();

      ctx.beginPath();
      const t0 = nodes[0].time;
      const t1 = nodes[nodes.length - 1].time;
      const steps = Math.max(24, Math.round((t1 - t0) * 60));
      for (let i = 0; i <= steps; i++) {
        const sample = getAnimatedShape(raw, t0 + ((t1 - t0) * i) / steps, animations);
        if (i === 0) ctx.moveTo(sample.x + offX, sample.y + offY);
        else ctx.lineTo(sample.x + offX, sample.y + offY);
      }
      ctx.strokeStyle = '#818CF8';
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([4 / scale, 4 / scale]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Curve handles at each segment midpoint
      segments.forEach(seg => {
        const mid = segmentMidpoint(seg);
        if (seg.cp) {
          ctx.beginPath();
          ctx.moveTo(seg.from.x + offX, seg.from.y + offY);
          ctx.lineTo(seg.cp.x + offX, seg.cp.y + offY);
          ctx.lineTo(seg.to.x + offX, seg.to.y + offY);
          ctx.strokeStyle = 'rgba(129, 140, 248, 0.35)';
          ctx.lineWidth = 1 / scale;
          ctx.stroke();
        }
        ctx.save();
        ctx.translate(mid.x + offX, mid.y + offY);
        ctx.rotate(Math.PI / 4);
        const d = 7 / scale;
        ctx.fillStyle = seg.cp ? '#818CF8' : '#18181B';
        ctx.strokeStyle = '#818CF8';
        ctx.lineWidth = 1.5 / scale;
        ctx.fillRect(-d / 2, -d / 2, d, d);
        ctx.strokeRect(-d / 2, -d / 2, d, d);
        ctx.restore();
      });

      nodes.forEach(node => {
        const isCurrent = Math.abs(node.time - currentTime) < 0.02;
        ctx.beginPath();
        ctx.arc(node.x + offX, node.y + offY, (isCurrent ? 6 : 5) / scale, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? '#818CF8' : '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#818CF8';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
      });
      ctx.restore();
    }

    // DRAW PEN / BEZIER NODE CLOSING INDICATOR OVERLAY
    if (isDrawing && (activeTool === 'pen' || activeTool === 'bezier') && selectedIds.length > 0) {
      const activeShape = shapes.find(s => s.id === selectedIds[0]);
      if (activeShape && activeShape.type === 'path' && activeShape.points && activeShape.points.length > 1) {
        const p0 = activeShape.points[0];
        const pLast = hoverPosRef.current || activeShape.points[activeShape.points.length - 1];
        const dist = Math.hypot(pLast.x - p0.x, pLast.y - p0.y);
        const threshold = 12 / viewport.transform.scale;
        const isNearClose = dist <= threshold && activeShape.points.length > 2 && penDragIndexRef.current === null;

        ctx.save();

        // 1. Initial node marker
        ctx.beginPath();
        ctx.arc(p0.x, p0.y, (isNearClose ? 6 : 4) / viewport.transform.scale, 0, Math.PI * 2);
        ctx.fillStyle = isNearClose ? '#3B82F6' : '#818CF8';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5 / viewport.transform.scale;
        ctx.stroke();

        if (isNearClose) {
          const scale = viewport.transform.scale;

          // 2. Outer pulsing glow ring around start node in primary blue accent
          ctx.beginPath();
          ctx.arc(p0.x, p0.y, 14 / scale, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
          ctx.fill();
          ctx.strokeStyle = '#818CF8';
          ctx.lineWidth = 2 / scale;
          ctx.setLineDash([3 / scale, 3 / scale]);
          ctx.stroke();

          // 3. Concentric target icon ring
          ctx.beginPath();
          ctx.arc(p0.x, p0.y, 9 / scale, 0, Math.PI * 2);
          ctx.strokeStyle = '#818CF8';
          ctx.lineWidth = 1.5 / scale;
          ctx.setLineDash([]);
          ctx.stroke();

          // 4. Snap connector line from cursor to start node
          if (pLast.x !== p0.x || pLast.y !== p0.y) {
            ctx.beginPath();
            ctx.moveTo(pLast.x, pLast.y);
            ctx.lineTo(p0.x, p0.y);
            ctx.strokeStyle = '#818CF8';
            ctx.lineWidth = 1.5 / scale;
            ctx.setLineDash([4 / scale, 4 / scale]);
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    }

    // DRAW ACTIVE PATH NODES WHILE DRAWING (FIGMA STYLE)
    if (isDrawing && (activeTool === 'pen' || activeTool === 'bezier') && selectedIds.length > 0) {
      const activeShape = shapes.find(s => s.id === selectedIds[0]);
      if (activeShape && activeShape.type === 'path' && activeShape.points && activeShape.points.length > 0) {
        ctx.save();
        const scale = viewport.transform.scale;

        // Thin outline guide over the real stroke so the path stays visible on any background
        if (activeShape.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(activeShape.points[0].x, activeShape.points[0].y);
          for (let i = 1; i < activeShape.points.length; i++) {
            const pt = activeShape.points[i];
            const prev = activeShape.points[i - 1];
            if (prev.cp2 || pt.cp1) {
              const cp1x = prev.cp2 ? prev.cp2.x : prev.x;
              const cp1y = prev.cp2 ? prev.cp2.y : prev.y;
              const cp2x = pt.cp1 ? pt.cp1.x : pt.x;
              const cp2y = pt.cp1 ? pt.cp1.y : pt.y;
              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, pt.x, pt.y);
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 1 / scale;
          ctx.stroke();
        }

        // Render visible node markers at every point (pencil strokes have none)
        if (activeTool === 'bezier') activeShape.points.forEach((pt, idx) => {
          const isLast = idx === activeShape.points.length - 1;
          const nodeRadius = (isLast ? 5.5 : 4.5) / scale;

          // Render handles if present
          if (pt.cp1) {
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(pt.cp1.x, pt.cp1.y);
            ctx.strokeStyle = '#818CF8';
            ctx.lineWidth = 1 / scale;
            ctx.stroke();

            ctx.save();
            ctx.translate(pt.cp1.x, pt.cp1.y);
            ctx.rotate(Math.PI / 4);
            const dSize = 5 / scale;
            ctx.fillStyle = '#818CF8';
            ctx.fillRect(-dSize / 2, -dSize / 2, dSize, dSize);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1 / scale;
            ctx.strokeRect(-dSize / 2, -dSize / 2, dSize, dSize);
            ctx.restore();
          }

          if (pt.cp2) {
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(pt.cp2.x, pt.cp2.y);
            ctx.strokeStyle = '#818CF8';
            ctx.lineWidth = 1 / scale;
            ctx.stroke();

            ctx.save();
            ctx.translate(pt.cp2.x, pt.cp2.y);
            ctx.rotate(Math.PI / 4);
            const dSize = 5 / scale;
            ctx.fillStyle = '#818CF8';
            ctx.fillRect(-dSize / 2, -dSize / 2, dSize, dSize);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1 / scale;
            ctx.strokeRect(-dSize / 2, -dSize / 2, dSize, dSize);
            ctx.restore();
          }

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, nodeRadius, 0, Math.PI * 2);
          ctx.fillStyle = isLast ? '#3B82F6' : '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2 / scale;
          ctx.stroke();
        });

        ctx.restore();
      }
    }

    // DRAW LIVE PREVIEW LINE WHILE DRAWING PATH (FIGMA STYLE)
    if (isDrawing && activeTool === 'bezier' && penDragIndexRef.current === null && selectedIds.length > 0) {
      const activeShape = shapes.find(s => s.id === selectedIds[0]);
      if (activeShape && activeShape.type === 'path' && activeShape.points && activeShape.points.length > 0) {
        const lastPt = activeShape.points[activeShape.points.length - 1];
        const mousePos = hoverPosRef.current;
        if (mousePos) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(lastPt.x, lastPt.y);
          if (lastPt.cp2) {
            ctx.quadraticCurveTo(lastPt.cp2.x, lastPt.cp2.y, mousePos.x, mousePos.y);
          } else {
            ctx.lineTo(mousePos.x, mousePos.y);
          }
          ctx.strokeStyle = '#818CF8';
          ctx.lineWidth = 1.5 / viewport.transform.scale;
          ctx.setLineDash([4 / viewport.transform.scale, 4 / viewport.transform.scale]);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // DRAW MARQUEE SELECTION BOX (ZONA DE SELEÇÃO)
    if (selectionBox && selectionBox.width > 1 && selectionBox.height > 1) {
      ctx.save();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1 / viewport.transform.scale;
      ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
      ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
      ctx.restore();
    }

    ctx.restore();

    // DRAW RULERS IF ENABLED
    if (showRulers) {
      ctx.save();
      ctx.fillStyle = '#18181B';
      ctx.fillRect(0, 0, canvas.width, 24);
      ctx.fillRect(0, 0, 24, canvas.height);
      
      ctx.strokeStyle = '#27272A';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 24); ctx.lineTo(canvas.width, 24);
      ctx.moveTo(24, 0); ctx.lineTo(24, canvas.height);
      ctx.stroke();
      
      ctx.fillStyle = '#18181B';
      ctx.fillRect(0, 0, 24, 24);
      ctx.strokeRect(0, 0, 24, 24);

      ctx.fillStyle = '#A1A1AA';
      ctx.strokeStyle = '#3F3F46';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      
      const scale = viewport.transform.scale;
      const offsetX = viewport.transform.x;
      const offsetY = viewport.transform.y;
      
      const rawInterval = 100 / scale;
      let interval = 100;
      if (rawInterval < 15) interval = 10;
      else if (rawInterval < 30) interval = 20;
      else if (rawInterval < 60) interval = 50;
      else if (rawInterval < 120) interval = 100;
      else if (rawInterval < 240) interval = 200;
      else if (rawInterval < 600) interval = 500;
      else interval = 1000;

      const startX = Math.floor((-offsetX + 24) / scale / interval) * interval;
      const endX = Math.ceil((canvas.width - offsetX) / scale / interval) * interval;
      ctx.beginPath();
      for (let x_canvas = startX; x_canvas <= endX; x_canvas += interval) {
        const x_screen = x_canvas * scale + offsetX;
        if (x_screen < 24) continue;
        
        ctx.moveTo(x_screen, 16);
        ctx.lineTo(x_screen, 24);
        ctx.fillText(x_canvas.toString(), x_screen, 12);
        
        const subInterval = interval / 5;
        for (let j = 1; j < 5; j++) {
          const subX_canvas = x_canvas + j * subInterval;
          const subX_screen = subX_canvas * scale + offsetX;
          if (subX_screen < 24 || subX_screen > canvas.width) continue;
          ctx.moveTo(subX_screen, 20);
          ctx.lineTo(subX_screen, 24);
        }
      }
      ctx.stroke();

      ctx.save();
      ctx.textAlign = 'right';
      const startY = Math.floor((-offsetY + 24) / scale / interval) * interval;
      const endY = Math.ceil((canvas.height - offsetY) / scale / interval) * interval;
      ctx.beginPath();
      for (let y_canvas = startY; y_canvas <= endY; y_canvas += interval) {
        const y_screen = y_canvas * scale + offsetY;
        if (y_screen < 24) continue;
        
        ctx.moveTo(16, y_screen);
        ctx.lineTo(24, y_screen);
        
        ctx.save();
        ctx.translate(12, y_screen);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(y_canvas.toString(), 0, 0);
        ctx.restore();
        
        const subInterval = interval / 5;
        for (let j = 1; j < 5; j++) {
          const subY_canvas = y_canvas + j * subInterval;
          const subY_screen = subY_canvas * scale + offsetY;
          if (subY_screen < 24 || subY_screen > canvas.height) continue;
          ctx.moveTo(20, subY_screen);
          ctx.lineTo(24, subY_screen);
        }
      }
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
  }, [shapes, viewport, selectedIds, hoveredId, showRulers, showWireframe, radiusHoverId, drawHoverTick, showMotionPath, dragAction, currentTime, animations, activeTool, isDragging, isDrawing, isPanning, canvasSizeTick]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    
    if (e.button === 1 || activeTool === 'hand' || spacePressed) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      initialViewportTransformRef.current = { ...viewport.transform };
      document.body.style.cursor = 'grabbing';
      return;
    }

    const pos = getCanvasPos(e.clientX, e.clientY);
    hoverPosRef.current = pos;

    if (isEditingPathNodes && selectedIds.length === 1 && activeTool === 'select') {
      const rawSelected = shapes.find(s => s.id === selectedIds[0]);
      if (rawSelected && rawSelected.type === 'path' && rawSelected.points) {
        const rad = (rawSelected.rotation || 0) * Math.PI / 180;
        const hw = rawSelected.width / 2;
        const hh = rawSelected.height / 2;
        const ax_offset = (rawSelected.anchorX !== undefined ? rawSelected.anchorX : 0.5) * rawSelected.width;
        const ay_offset = (rawSelected.anchorY !== undefined ? rawSelected.anchorY : 0.5) * rawSelected.height;
        const ax = rawSelected.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
        const ay = rawSelected.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);

        const hitThreshold = 10 / viewport.transform.scale;

        for (let idx = 0; idx < rawSelected.points.length; idx++) {
          const pt = rawSelected.points[idx];
          const lx = pt.x * rawSelected.width + (hw - ax_offset);
          const ly = pt.y * rawSelected.height + (hh - ay_offset);
          const worldPtX = ax + lx * Math.cos(rad) - ly * Math.sin(rad);
          const worldPtY = ay + lx * Math.sin(rad) + ly * Math.cos(rad);

          // Check cp1
          if (pt.cp1) {
            const cp1_lx = pt.cp1.x * rawSelected.width + (hw - ax_offset);
            const cp1_ly = pt.cp1.y * rawSelected.height + (hh - ay_offset);
            const worldCp1X = ax + cp1_lx * Math.cos(rad) - cp1_ly * Math.sin(rad);
            const worldCp1Y = ay + cp1_lx * Math.sin(rad) + cp1_ly * Math.cos(rad);
            if (Math.hypot(pos.x - worldCp1X, pos.y - worldCp1Y) <= hitThreshold) {
              setSelectedNode(idx, 'cp1');
              setIsDraggingNodeHandle(true);
              pushHistory();
              return;
            }
          }

          // Check cp2
          if (pt.cp2) {
            const cp2_lx = pt.cp2.x * rawSelected.width + (hw - ax_offset);
            const cp2_ly = pt.cp2.y * rawSelected.height + (hh - ay_offset);
            const worldCp2X = ax + cp2_lx * Math.cos(rad) - cp2_ly * Math.sin(rad);
            const worldCp2Y = ay + cp2_lx * Math.sin(rad) + cp2_ly * Math.cos(rad);
            if (Math.hypot(pos.x - worldCp2X, pos.y - worldCp2Y) <= hitThreshold) {
              setSelectedNode(idx, 'cp2');
              setIsDraggingNodeHandle(true);
              pushHistory();
              return;
            }
          }

          // Check node point
          if (Math.hypot(pos.x - worldPtX, pos.y - worldPtY) <= hitThreshold) {
            setSelectedNode(idx, (e.ctrlKey || e.metaKey) ? 'cp2' : 'point');
            setIsDraggingNodeHandle(true);
            pushHistory();
            return;
          }
        }
      }
    }

    if (activeTool === 'select') {
      const motion = getMotionPathInfo();
      if (motion) {
        const hitR = 9 / viewport.transform.scale;
        const near = (p: { x: number; y: number }) => Math.hypot(pos.x - (p.x + motion.offX), pos.y - (p.y + motion.offY)) <= hitR;
        // The node at the playhead sits on the shape itself; let a normal drag move the shape there
        const node = motion.nodes.find(n => near(n) && Math.abs(n.time - currentTime) >= 0.02);
        if (node) {
          motionDragRef.current = { kind: 'node', time: node.time };
          return;
        }
        const seg = motion.segments.find(sg => near(segmentMidpoint(sg)));
        if (seg) {
          if (e.detail >= 2) {
            setMotionControl(motion.raw.id, seg.from.time, seg.to.time, null);
          } else {
            motionDragRef.current = { kind: 'curve', from: seg.from.time, to: seg.to.time };
          }
          return;
        }
      }

      const radiusCandidateId = radiusHoverId || (selectedIds.length === 1 ? selectedIds[0] : null);
      if (radiusCandidateId) {
          const rawSelected = shapes.find(s => s.id === radiusCandidateId);
          if (rawSelected && rawSelected.type !== 'group') {
              const selected = getAnimatedShape(rawSelected, currentTime, animations);
              const rad = (selected.rotation || 0) * Math.PI / 180;
              const ax_offset = (selected.anchorX !== undefined ? selected.anchorX : 0.5) * selected.width;
              const ay_offset = (selected.anchorY !== undefined ? selected.anchorY : 0.5) * selected.height;
              const hw = selected.width / 2;
              const hh = selected.height / 2;
              const ax = selected.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
              const ay = selected.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);

              if (selected.editAnchorManual && selectedIds.includes(selected.id)) {
                  const dist = Math.hypot(pos.x - ax, pos.y - ay) * viewport.transform.scale;
                  if (dist <= 14) {
                      setIsDraggingAnchor(true);
                      pushHistory();
                      return;
                  }
              }

              if (selected.type === 'rectangle') {
                  const maxPossibleRadius = Math.min(Math.abs(selected.width), Math.abs(selected.height)) / 2;
                  const currentRadius = selected.radius || 0;
                  const isRadiusAtLimit = currentRadius >= maxPossibleRadius - 0.5;
                  const isShapeTooSmall = Math.min(Math.abs(selected.width), Math.abs(selected.height)) < 24;

                  if (!isRadiusAtLimit && !isShapeTooSmall) {
                      const r = currentRadius;
                      const offset = Math.max(12, r);
                      const innerOffsets = [
                          [offset, offset],
                          [selected.width - offset, offset],
                          [offset, selected.height - offset],
                          [selected.width - offset, selected.height - offset]
                      ];
                      for (const [lx, ly] of innerOffsets) {
                          const rx_local = lx - ax_offset;
                          const ry_local = ly - ay_offset;
                          const hx_world = ax + rx_local * Math.cos(rad) - ry_local * Math.sin(rad);
                          const hy_world = ay + rx_local * Math.sin(rad) + ry_local * Math.cos(rad);
                          const dist = Math.hypot(pos.x - hx_world, pos.y - hy_world) * viewport.transform.scale;
                          if (dist <= 10) {
                              if (!selectedIds.includes(selected.id)) selectShape(selected.id, false, true);
                              setDragAction('radius');
                              setIsDragging(true);
                              dragDidMove.current = false;
                              dragStartRef.current = { x: pos.x, y: pos.y };
                              
                              dragStartShapeState.current = {
                                  x: selected.x,
                                  y: selected.y,
                                  width: selected.width,
                                  height: selected.height,
                                  rotation: selected.rotation || 0,
                                  anchorX: selected.anchorX !== undefined ? selected.anchorX : 0.5,
                                  anchorY: selected.anchorY !== undefined ? selected.anchorY : 0.5
                              };
                              dragStartAnchor.current = { x: ax, y: ay };
                              return;
                          }
                      }
                  }
              }
          }
      }

      const populateStartingChildrenStates = (targetIds: string[]) => {
          dragStartChildrenStates.current.clear();
          const allMovingIds = new Set<string>(targetIds);
          shapes.forEach(s => {
              if (s.groupId && targetIds.includes(s.groupId)) {
                  allMovingIds.add(s.id);
              }
          });

          shapes.forEach(s => {
              if (allMovingIds.has(s.id)) {
                  const animChild = getAnimatedShape(s, currentTime, animations);
                  dragStartChildrenStates.current.set(s.id, {
                      x: animChild.x,
                      y: animChild.y,
                      width: animChild.width,
                      height: animChild.height,
                      rotation: animChild.rotation || 0,
                      anchorX: animChild.anchorX !== undefined ? animChild.anchorX : 0.5,
                      anchorY: animChild.anchorY !== undefined ? animChild.anchorY : 0.5
                  });
              }
          });
      };

      const hitShape = [...shapes].reverse().find(s => {
          if (s.type === 'group' || s.locked || s.hidden) return false;
          const animShape = getAnimatedShape(s, currentTime, animations);
          return isPointInShape(pos.x, pos.y, animShape);
      });
      
      let action: DragAction = 'none';
      if (selectedIds.length === 1) {
          const rawSelected = shapes.find(s => s.id === selectedIds[0]);
          if (rawSelected) {
              const selected = getAnimatedShape(rawSelected, currentTime, animations);
              action = detectHandleHit(pos, selected, viewport.transform.scale);
          }
      }

      if (action !== 'none') {
          setDragAction(action);
          setIsDragging(true);
          dragDidMove.current = false;
          dragStartRef.current = { x: pos.x, y: pos.y };
          initialDragStart.current = { x: pos.x, y: pos.y };

          const rawSelected = shapes.find(s => s.id === selectedIds[0]);
          if (rawSelected) {
              const selected = getAnimatedShape(rawSelected, currentTime, animations);
              const rad = (selected.rotation || 0) * Math.PI / 180;
              const ax_offset = (selected.anchorX !== undefined ? selected.anchorX : 0.5) * selected.width;
              const ay_offset = (selected.anchorY !== undefined ? selected.anchorY : 0.5) * selected.height;
              const hw = selected.width / 2;
              const hh = selected.height / 2;
              const ax = selected.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
              const ay = selected.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);

              dragStartShapeState.current = {
                  x: selected.x,
                  y: selected.y,
                  width: selected.width,
                  height: selected.height,
                  rotation: selected.rotation || 0,
                  anchorX: selected.anchorX !== undefined ? selected.anchorX : 0.5,
                  anchorY: selected.anchorY !== undefined ? selected.anchorY : 0.5
              };
              dragStartAnchor.current = { x: ax, y: ay };
              populateStartingChildrenStates(selectedIds);
          }
          return;
      }

      if (hitShape) {
        if (e.altKey) {
            const animHit = getAnimatedShape(hitShape, currentTime, animations);
            const newShape = { ...animHit, id: generateId() };
            addShape(newShape);
            selectShape(newShape.id);
            setIsDragging(true);
            dragDidMove.current = true;
            setDragAction('move');
            dragStartRef.current = { x: pos.x, y: pos.y };
            initialDragStart.current = { x: pos.x, y: pos.y };

            dragStartChildrenStates.current.clear();
            dragStartChildrenStates.current.set(newShape.id, {
                x: newShape.x,
                y: newShape.y,
                width: newShape.width,
                height: newShape.height,
                rotation: newShape.rotation || 0,
                anchorX: newShape.anchorX !== undefined ? newShape.anchorX : 0.5,
                anchorY: newShape.anchorY !== undefined ? newShape.anchorY : 0.5
            });
        } else {
            if (hitShape.type === 'path' && e.detail >= 2) {
              setEditingPathNodes(true);
              selectShape(hitShape.id);
              return;
            }

            const forceIndividual = e.ctrlKey || e.metaKey || e.shiftKey || e.detail >= 2;
            const targetId = forceIndividual ? hitShape.id : (hitShape.groupId || hitShape.id);
            const isAlreadySelected = forceIndividual
                ? selectedIds.includes(hitShape.id)
                : (selectedIds.includes(hitShape.id) || (hitShape.groupId && selectedIds.includes(hitShape.groupId)));
            if (isAlreadySelected) {
                pendingClickSelection.current = { id: hitShape.id, shiftKey: e.shiftKey, forceIndividual: true };
            } else {
                selectShape(hitShape.id, e.shiftKey, forceIndividual);
            }
            setIsDragging(true);
            dragDidMove.current = false;
            setDragAction('move');
            dragStartRef.current = { x: pos.x, y: pos.y };
            initialDragStart.current = { x: pos.x, y: pos.y };

            const movingIds = isAlreadySelected ? selectedIds : [targetId];
            populateStartingChildrenStates(movingIds);
        }
      } else {
        selectionStartRef.current = pos;
        initialSelectedIdsRef.current = e.shiftKey ? [...selectedIds] : [];
        if (!e.shiftKey) {
          selectShape(null);
        }
        setIsDragging(true);
        setDragAction('select-marquee');
      }
    } else if (activeTool === 'rectangle' || activeTool === 'ellipse' || activeTool === 'frame') {
      drawStartPos.current = pos;
      setIsDrawing(false);
    } else if (activeTool === 'bezier' && isDrawing && selectedIds.length > 0) {
      // Pen: click = corner node, click+drag = smooth node with handles
      const activeId = selectedIds[0];
      const activeShape = shapes.find(s => s.id === activeId);
      if (activeShape && activeShape.points && activeShape.points.length > 0) {
        if (e.detail >= 2) {
          finalizePathDrawing(activeShape, false);
          return;
        }

        const p0 = activeShape.points[0];
        const distToStart = Math.hypot(pos.x - p0.x, pos.y - p0.y);
        const snapThreshold = 12 / viewport.transform.scale;

        if (activeShape.points.length > 2 && distToStart <= snapThreshold) {
          finalizePathDrawing(activeShape, true);
          return;
        }
        penDragIndexRef.current = activeShape.points.length;
        updateShape(activeId, { points: [...activeShape.points, { x: pos.x, y: pos.y, pointType: 'corner' }] });
      }
    } else if (activeTool === 'pen' || activeTool === 'bezier') {
      // Pick a stroke that contrasts with what's underneath: the frame fill or the dark canvas
      const frameBelow = [...shapes].reverse().find(s => s.type === 'frame' && !s.hidden && isPointInShape(pos.x, pos.y, s));
      const bgHex = frameBelow && /^#[0-9a-f]{6}$/i.test(frameBelow.fill) ? frameBelow.fill : '#18181B';
      const [r, g, b] = [1, 3, 5].map(i => parseInt(bgHex.slice(i, i + 2), 16));
      const isLightBg = (0.299 * r + 0.587 * g + 0.114 * b) > 140;
      const newShape: BaseShape = {
        id: generateId(),
        type: 'path',
        name: activeTool === 'pen' ? 'Traço' : 'Caminho',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        fill: 'transparent',
        stroke: isLightBg ? '#18181B' : '#F4F4F5',
        strokeWidth: activeTool === 'pen' ? 4 : 2,
        opacity: 1,
        points: [{ x: pos.x, y: pos.y, pointType: 'corner' }]
      };
      if (activeTool === 'pen') {
        freehandPointsRef.current = [{ x: pos.x, y: pos.y }];
      } else {
        penDragIndexRef.current = 0;
      }
      addShape(newShape);
      selectShape(newShape.id);
      setIsDrawing(true);
    }
  };

  const handlePointerMoveThrottled = (e: { clientX: number; clientY: number; shiftKey: boolean; altKey?: boolean }) => {
    const hoverPos = getCanvasPos(e.clientX, e.clientY);
    hoverPosRef.current = hoverPos;

    if (motionDragRef.current) {
      const motion = getMotionPathInfo();
      if (motion) {
        const px = hoverPos.x - motion.offX;
        const py = hoverPos.y - motion.offY;
        const drag = motionDragRef.current;
        if (drag.kind === 'node') {
          setMotionNode(motion.raw.id, drag.time, Math.round(px), Math.round(py));
        } else {
          const seg = motion.segments.find(sg => Math.abs(sg.from.time - drag.from) < 0.02 && Math.abs(sg.to.time - drag.to) < 0.02);
          if (seg) {
            // Handle sits at the curve midpoint B(0.5) → solve for the quadratic control point
            setMotionControl(motion.raw.id, drag.from, drag.to, {
              x: 2 * px - (seg.from.x + seg.to.x) / 2,
              y: 2 * py - (seg.from.y + seg.to.y) / 2,
            });
          }
        }
      }
      return;
    }

    // Corner-radius handles: shown while hovering a rectangle (selected or not)
    let radiusTarget: string | null = null;
    if (activeTool === 'select' && !isDrawing && !isPanning && selectedIds.length <= 1) {
      const canShowRadius = (s: BaseShape) =>
        s.type === 'rectangle' && !s.locked && !s.hidden &&
        Math.min(Math.abs(s.width), Math.abs(s.height)) >= 24 &&
        (s.radius || 0) < Math.min(Math.abs(s.width), Math.abs(s.height)) / 2 - 0.5;

      const rawSelected = selectedIds.length === 1 ? shapes.find(s => s.id === selectedIds[0]) : undefined;
      const selected = rawSelected ? getAnimatedShape(rawSelected, currentTime, animations) : undefined;
      if (selected && canShowRadius(selected) && (
        isPointInShape(hoverPos.x, hoverPos.y, selected) ||
        detectHandleHit(hoverPos, selected, viewport.transform.scale) !== 'none'
      )) {
        radiusTarget = selected.id;
      } else if (!isDragging) {
        const hit = [...shapes].reverse().find(s => {
          if (s.type === 'group' || s.locked || s.hidden) return false;
          return isPointInShape(hoverPos.x, hoverPos.y, getAnimatedShape(s, currentTime, animations));
        });
        if (hit && canShowRadius(getAnimatedShape(hit, currentTime, animations))) {
          radiusTarget = hit.id;
        }
      }
    }
    if (radiusTarget !== radiusHoverId && dragAction !== 'radius') {
      setRadiusHoverId(radiusTarget);
    }

    if (isDraggingNodeHandle && isEditingPathNodes && selectedIds.length === 1 && selectedNodeIndex !== null && selectedHandleType !== null) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      const rawSelected = shapes.find(s => s.id === selectedIds[0]);
      if (rawSelected && rawSelected.type === 'path' && rawSelected.points) {
        const rad = (rawSelected.rotation || 0) * Math.PI / 180;
        const hw = rawSelected.width / 2;
        const hh = rawSelected.height / 2;
        const ax_offset = (rawSelected.anchorX !== undefined ? rawSelected.anchorX : 0.5) * rawSelected.width;
        const ay_offset = (rawSelected.anchorY !== undefined ? rawSelected.anchorY : 0.5) * rawSelected.height;
        const ax = rawSelected.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
        const ay = rawSelected.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);

        const rx_local = (pos.x - ax) * Math.cos(-rad) - (pos.y - ay) * Math.sin(-rad);
        const ry_local = (pos.x - ax) * Math.sin(-rad) + (pos.y - ay) * Math.cos(-rad);

        const lx = rx_local + ax_offset;
        const ly = ry_local + ay_offset;

        const normX = rawSelected.width !== 0 ? (lx - hw) / rawSelected.width : (lx - hw);
        const normY = rawSelected.height !== 0 ? (ly - hh) / rawSelected.height : (ly - hh);

        const newPoints = rawSelected.points.map((pt, idx) => {
          if (idx !== selectedNodeIndex) return pt;
          const updatedPt = { ...pt };

          if (selectedHandleType === 'point') {
            const dx = normX - pt.x;
            const dy = normY - pt.y;
            updatedPt.x = normX;
            updatedPt.y = normY;
            if (updatedPt.cp1) {
              updatedPt.cp1 = { x: updatedPt.cp1.x + dx, y: updatedPt.cp1.y + dy };
            }
            if (updatedPt.cp2) {
              updatedPt.cp2 = { x: updatedPt.cp2.x + dx, y: updatedPt.cp2.y + dy };
            }
          } else if (selectedHandleType === 'cp1') {
            updatedPt.cp1 = { x: normX, y: normY };
            if (updatedPt.pointType === 'smooth' || updatedPt.pointType === 'symmetric') {
              const dx = pt.x - normX;
              const dy = pt.y - normY;
              updatedPt.cp2 = { x: pt.x + dx, y: pt.y + dy };
            }
          } else if (selectedHandleType === 'cp2') {
            updatedPt.cp2 = { x: normX, y: normY };
            if (updatedPt.pointType === 'smooth' || updatedPt.pointType === 'symmetric') {
              const dx = pt.x - normX;
              const dy = pt.y - normY;
              updatedPt.cp1 = { x: pt.x + dx, y: pt.y + dy };
            }
          }

          return updatedPt;
        });

        updateShape(rawSelected.id, { points: newPoints });
      }
      return;
    }

    if (dragAction === 'select-marquee' && selectionStartRef.current) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      const minX = Math.min(selectionStartRef.current.x, pos.x);
      const minY = Math.min(selectionStartRef.current.y, pos.y);
      const width = Math.abs(pos.x - selectionStartRef.current.x);
      const height = Math.abs(pos.y - selectionStartRef.current.y);

      setSelectionBox({ x: minX, y: minY, width, height });

      const touchedIds: string[] = [];
      shapes.forEach(s => {
        if (s.hidden || s.locked) return;
        const animShape = getAnimatedShape(s, currentTime, animations);
        const aabb = getShapeWorldAABB(animShape);
        const intersects = (
          aabb.minX <= minX + width &&
          aabb.maxX >= minX &&
          aabb.minY <= minY + height &&
          aabb.maxY >= minY
        );
        if (intersects) {
          const targetId = (e.altKey) ? animShape.id : (animShape.groupId || animShape.id);
          if (!touchedIds.includes(targetId)) {
            touchedIds.push(targetId);
          }
        }
      });

      if (e.shiftKey) {
        const combined = Array.from(new Set([...initialSelectedIdsRef.current, ...touchedIds]));
        setSelectedIds(combined);
      } else {
        setSelectedIds(touchedIds);
      }
      return;
    }

    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewportTransform({
        x: initialViewportTransformRef.current.x + dx,
        y: initialViewportTransformRef.current.y + dy,
        scale: initialViewportTransformRef.current.scale
      });
    } else if (isDraggingAnchor && selectedIds.length === 1) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      const rawSelected = shapes.find(s => s.id === selectedIds[0]);
      if (rawSelected && rawSelected.type !== 'group') {
          const selected = getAnimatedShape(rawSelected, currentTime, animations);
          const rad = (selected.rotation || 0) * Math.PI / 180;
          const ax_offset = (selected.anchorX !== undefined ? selected.anchorX : 0.5) * selected.width;
          const ay_offset = (selected.anchorY !== undefined ? selected.anchorY : 0.5) * selected.height;
          const hw = selected.width / 2;
          const hh = selected.height / 2;
          const ax = selected.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
          const ay = selected.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);

          // Inverse rotate mouse position pos around current anchor
          const rx_local = (pos.x - ax) * Math.cos(-rad) - (pos.y - ay) * Math.sin(-rad);
          const ry_local = (pos.x - ax) * Math.sin(-rad) + (pos.y - ay) * Math.cos(-rad);

          const target_ax_offset = rx_local + ax_offset;
          const target_ay_offset = ry_local + ay_offset;

          const nAnchorX = selected.width !== 0 ? (target_ax_offset / selected.width) : 0.5;
          const nAnchorY = selected.height !== 0 ? (target_ay_offset / selected.height) : 0.5;

          updateShape(selected.id, {
             anchor: 'manual',
             anchorX: Math.max(-2, Math.min(3, nAnchorX)), // clamp gently to allow moving outside
             anchorY: Math.max(-2, Math.min(3, nAnchorY))
          });
      }
    } else if (isDragging && selectedIds.length > 0) {
      if (!dragDidMove.current) {
          pushHistory();
          dragDidMove.current = true;
      }
      const pos = getCanvasPos(e.clientX, e.clientY);
      
      if (dragAction === 'radius' && selectedIds.length === 1) {
          const rawSelected = shapes.find(s => s.id === selectedIds[0]);
          if (rawSelected && rawSelected.type === 'rectangle') {
              const selected = getAnimatedShape(rawSelected, currentTime, animations);
              const rad = (selected.rotation || 0) * Math.PI / 180;
              const ax_offset = (selected.anchorX !== undefined ? selected.anchorX : 0.5) * selected.width;
              const ay_offset = (selected.anchorY !== undefined ? selected.anchorY : 0.5) * selected.height;
              const hw = selected.width / 2;
              const hh = selected.height / 2;
              
              const ax = selected.x + hw + (ax_offset - hw) * Math.cos(rad) - (ay_offset - hh) * Math.sin(rad);
              const ay = selected.y + hh + (ax_offset - hw) * Math.sin(rad) + (ay_offset - hh) * Math.cos(rad);
              
              const rx_local = (pos.x - ax) * Math.cos(-rad) - (pos.y - ay) * Math.sin(-rad);
              const ry_local = (pos.x - ax) * Math.sin(-rad) + (pos.y - ay) * Math.cos(-rad);
              
              const lx = rx_local + ax_offset;
              const ly = ry_local + ay_offset;
              
              const corners = [
                  { cx: 0, cy: 0, dx: lx, dy: ly },
                  { cx: selected.width, cy: 0, dx: selected.width - lx, dy: ly },
                  { cx: 0, cy: selected.height, dx: lx, dy: selected.height - ly },
                  { cx: selected.width, cy: selected.height, dx: selected.width - lx, dy: selected.height - ly }
              ];
              
              let closest = corners[0];
              let minDist = Math.hypot(lx - corners[0].cx, ly - corners[0].cy);
              for (let i = 1; i < corners.length; i++) {
                  const d = Math.hypot(lx - corners[i].cx, ly - corners[i].cy);
                  if (d < minDist) {
                      minDist = d;
                      closest = corners[i];
                  }
              }
              
              let targetRadius = Math.max(0, Math.min(closest.dx, closest.dy));
              const maxRadius = Math.min(selected.width / 2, selected.height / 2);
              targetRadius = Math.min(maxRadius, targetRadius);
              
              updateShape(selected.id, { radius: Math.round(targetRadius) });
          }
      } else {
          if (dragAction === 'move') {
              if (initialDragStart.current) {
                  let totalDx = pos.x - initialDragStart.current.x;
                  let totalDy = pos.y - initialDragStart.current.y;

                  if (snapEnabled && !e.altKey && selectedIds.length === 1) {
                      const primaryId = selectedIds[0];
                      const startState = dragStartChildrenStates.current.get(primaryId);
                      if (startState) {
                          const proposedX = startState.x + totalDx;
                          const proposedY = startState.y + totalDy;
                          const snap = calculateMoveSnap(
                              proposedX,
                              proposedY,
                              startState.width,
                              startState.height,
                              shapes,
                              selectedIds,
                              viewport.transform.scale
                          );
                          totalDx = snap.x - startState.x;
                          totalDy = snap.y - startState.y;
                          setActiveAlignmentGuides(snap.guides);
                      }
                  } else {
                      setActiveAlignmentGuides([]);
                  }

                  const updates: { id: string; partial: Partial<BaseShape> }[] = [];
                  dragStartChildrenStates.current.forEach((startState, shapeId) => {
                      updates.push({
                          id: shapeId,
                          partial: {
                              x: startState.x + totalDx,
                              y: startState.y + totalDy
                          }
                      });
                  });
                  if (updates.length > 0) {
                      updateShapes(updates);
                  }
              }
          } else if (dragAction.startsWith('resize') && selectedIds.length === 1) {
              const shape = shapes.find(s => s.id === selectedIds[0]);
              if (shape) {
                  const startState = dragStartShapeState.current;
                  if (startState) {
                      const rad = startState.rotation * Math.PI / 180;
                      const minSize = 5;

                      const C_x = startState.x + startState.width / 2;
                      const C_y = startState.y + startState.height / 2;

                      const handle = dragAction.replace('resize-', '');

                      const getOppositeOffset = (action: string, w: number, h: number) => {
                          let dx = 0;
                          let dy = 0;
                          if (action.includes('e')) dx = -w / 2;
                          else if (action.includes('w')) dx = w / 2;
                          if (action.includes('s')) dy = -h / 2;
                          else if (action.includes('n')) dy = h / 2;
                          return { dx, dy };
                      };

                      const startOffsets = getOppositeOffset(handle, startState.width, startState.height);

                      const opp_x = C_x + startOffsets.dx * Math.cos(rad) - startOffsets.dy * Math.sin(rad);
                      const opp_y = C_y + startOffsets.dx * Math.sin(rad) + startOffsets.dy * Math.cos(rad);

                      const dx_vec = pos.x - opp_x;
                      const dy_vec = pos.y - opp_y;
                      const lx_relative = dx_vec * Math.cos(-rad) - dy_vec * Math.sin(-rad);
                      const ly_relative = dx_vec * Math.sin(-rad) + dy_vec * Math.cos(-rad);

                      let nWidth = startState.width;
                      let nHeight = startState.height;

                      if (handle.includes('e')) {
                          nWidth = Math.max(minSize, lx_relative);
                      } else if (handle.includes('w')) {
                          nWidth = Math.max(minSize, -lx_relative);
                      }

                      if (handle.includes('s')) {
                          nHeight = Math.max(minSize, ly_relative);
                      } else if (handle.includes('n')) {
                          nHeight = Math.max(minSize, -ly_relative);
                      }

                      if (e.shiftKey) {
                          const originalRatio = startState.width / startState.height;
                          if (dragAction === 'resize-e' || dragAction === 'resize-w') {
                              nHeight = nWidth / originalRatio;
                          } else if (dragAction === 'resize-n' || dragAction === 'resize-s') {
                              nWidth = nHeight * originalRatio;
                          } else {
                              const currentRatio = nWidth / nHeight;
                              if (currentRatio > originalRatio) {
                                  nWidth = nHeight * originalRatio;
                              } else {
                                  nHeight = nWidth / originalRatio;
                              }
                          }
                      }

                      const offsets = getOppositeOffset(handle, nWidth, nHeight);
                      const C_new_x = opp_x - offsets.dx * Math.cos(rad) + offsets.dy * Math.sin(rad);
                      const C_new_y = opp_y - offsets.dx * Math.sin(rad) - offsets.dy * Math.cos(rad);

                      const nX = C_new_x - nWidth / 2;
                      const nY = C_new_y - nHeight / 2;

                      const updates: { id: string; partial: Partial<BaseShape> }[] = [
                          { id: shape.id, partial: { x: nX, y: nY, width: nWidth, height: nHeight } }
                      ];

                      if (shape.type === 'group' || shape.type === 'frame') {
                          shapes.forEach(child => {
                              if (child.groupId === shape.id) {
                                  const childState = dragStartChildrenStates.current.get(child.id);
                                  if (childState) {
                                      const childCenterOld = {
                                          x: childState.x + childState.width / 2,
                                          y: childState.y + childState.height / 2
                                      };
                                      const groupCenterOld = {
                                          x: startState.x + startState.width / 2,
                                          y: startState.y + startState.height / 2
                                      };
                                      const rad_old = startState.rotation * Math.PI / 180;
                                      const dx_child = childCenterOld.x - groupCenterOld.x;
                                      const dy_child = childCenterOld.y - groupCenterOld.y;

                                      const localX = dx_child * Math.cos(-rad_old) - dy_child * Math.sin(-rad_old);
                                      const localY = dx_child * Math.sin(-rad_old) + dy_child * Math.cos(-rad_old);

                                      const scaleX = startState.width !== 0 ? (nWidth / startState.width) : 1;
                                      const scaleY = startState.height !== 0 ? (nHeight / startState.height) : 1;
                                      const localX_scaled = localX * scaleX;
                                      const localY_scaled = localY * scaleY;

                                      const groupCenterNew = {
                                          x: nX + nWidth / 2,
                                          y: nY + nHeight / 2
                                      };
                                      const groupRot = startState.rotation;
                                      const rad_new = groupRot * Math.PI / 180;

                                      const childCenterNew = {
                                          x: groupCenterNew.x + localX_scaled * Math.cos(rad_new) - localY_scaled * Math.sin(rad_new),
                                          y: groupCenterNew.y + localX_scaled * Math.sin(rad_new) + localY_scaled * Math.cos(rad_new)
                                      };

                                      const nChildWidth = childState.width * Math.abs(scaleX);
                                      const nChildHeight = childState.height * Math.abs(scaleY);

                                      const nChildX = childCenterNew.x - nChildWidth / 2;
                                      const nChildY = childCenterNew.y - nChildHeight / 2;

                                      updates.push({
                                          id: child.id,
                                          partial: {
                                              x: nChildX,
                                              y: nChildY,
                                              width: nChildWidth,
                                              height: nChildHeight
                                          }
                                      });
                                  }
                              }
                          });
                      }
                      updateShapes(updates);
                  }
              }
          } else if (dragAction.startsWith('rotate') && selectedIds.length === 1) {
              const shape = shapes.find(s => s.id === selectedIds[0]);
              if (shape) {
                  const startState = dragStartShapeState.current;
                  const startAnchor = dragStartAnchor.current;
                  const initialMouse = initialDragStart.current;
                  if (startState && startAnchor && initialMouse) {
                      const angle1 = Math.atan2(initialMouse.y - startAnchor.y, initialMouse.x - startAnchor.x);
                      const angle2 = Math.atan2(pos.y - startAnchor.y, pos.x - startAnchor.x);
                      let angleChange = (angle2 - angle1) * 180 / Math.PI;
                      
                      if (e.shiftKey) {
                          angleChange = Math.round(angleChange / 15) * 15;
                      }

                      let newRotation = (startState.rotation + angleChange) % 360;
                      if (newRotation < 0) newRotation += 360;

                      const rad = newRotation * Math.PI / 180;
                      const hw = startState.width / 2;
                      const hh = startState.height / 2;
                      const ax_offset = startState.anchorX * startState.width;
                      const ay_offset = startState.anchorY * startState.height;

                      const nX = startAnchor.x - hw - (ax_offset - hw) * Math.cos(rad) + (ay_offset - hh) * Math.sin(rad);
                      const nY = startAnchor.y - hh - (ax_offset - hw) * Math.sin(rad) - (ay_offset - hh) * Math.cos(rad);

                      const updates: { id: string; partial: Partial<BaseShape> }[] = [
                          { id: shape.id, partial: { rotation: newRotation, x: nX, y: nY } }
                      ];

                      if (shape.type === 'group' || shape.type === 'frame') {
                          shapes.forEach(child => {
                              if (child.groupId === shape.id) {
                                  const childState = dragStartChildrenStates.current.get(child.id);
                                  if (childState) {
                                      const childCenterOld = {
                                          x: childState.x + childState.width / 2,
                                          y: childState.y + childState.height / 2
                                      };
                                      const groupCenterOld = {
                                          x: startState.x + startState.width / 2,
                                          y: startState.y + startState.height / 2
                                      };
                                      const rad_old = startState.rotation * Math.PI / 180;
                                      const dx_child = childCenterOld.x - groupCenterOld.x;
                                      const dy_child = childCenterOld.y - groupCenterOld.y;

                                      const localX = dx_child * Math.cos(-rad_old) - dy_child * Math.sin(-rad_old);
                                      const localY = dx_child * Math.sin(-rad_old) + dy_child * Math.cos(-rad_old);

                                      const groupCenterNew = {
                                          x: nX + startState.width / 2,
                                          y: nY + startState.height / 2
                                      };
                                      const groupRot = newRotation;
                                      const rad_new = groupRot * Math.PI / 180;

                                      const childCenterNew = {
                                          x: groupCenterNew.x + localX * Math.cos(rad_new) - localY * Math.sin(rad_new),
                                          y: groupCenterNew.y + localX * Math.sin(rad_new) + localY * Math.cos(rad_new)
                                      };

                                      const rotDiff = groupRot - startState.rotation;
                                      const nChildRotation = childState.rotation + rotDiff;

                                      const nChildX = childCenterNew.x - childState.width / 2;
                                      const nChildY = childCenterNew.y - childState.height / 2;

                                      updates.push({
                                          id: child.id,
                                          partial: {
                                              x: nChildX,
                                              y: nChildY,
                                              rotation: nChildRotation
                                          }
                                      });
                                  }
                              }
                          });
                      }
                      updateShapes(updates);
                  }
              }
          }
      }
    } else if (!isDrawing && drawStartPos.current && (activeTool === 'rectangle' || activeTool === 'ellipse' || activeTool === 'frame')) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      const dist = Math.hypot(pos.x - drawStartPos.current.x, pos.y - drawStartPos.current.y);
      if (dist > 3 / viewport.transform.scale) {
          const isFrame = activeTool === 'frame';
          const newShape: BaseShape = {
              id: generateId(),
              type: activeTool,
              name: isFrame ? `Frame ${shapes.filter(s => s.type === 'frame').length + 1}` : undefined,
              x: drawStartPos.current.x,
              y: drawStartPos.current.y,
              width: 0,
              height: 0,
              rotation: 0,
              fill: '#FFFFFF',
              stroke: isFrame ? '#E2E8F0' : 'transparent',
              strokeWidth: isFrame ? 1 : 0,
              opacity: 1
          };
          addShape(newShape);
          selectShape(newShape.id);
          setIsDrawing(true);
      }
    } else if (isDrawing && selectedIds.length > 0) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      const activeId = selectedIds[0];
      const activeShape = shapes.find(s => s.id === activeId)!;
      
      if (activeTool === 'rectangle' || activeTool === 'ellipse' || activeTool === 'frame') {
        const width = pos.x - activeShape.x;
        const height = pos.y - activeShape.y;
        updateShape(activeId, { 
            width: e.shiftKey ? Math.max(width, height) : width, 
            height: e.shiftKey ? Math.max(width, height) : height 
        });
      } else if (activeTool === 'pen' && activeShape.points && freehandPointsRef.current) {
        // Pencil: sample the cursor; skip points closer than ~2 screen px
        const raw = freehandPointsRef.current;
        const last = raw[raw.length - 1];
        if (Math.hypot(pos.x - last.x, pos.y - last.y) * viewport.transform.scale >= 2) {
          raw.push({ x: pos.x, y: pos.y });
          updateShape(activeId, { points: raw.map(p => ({ x: p.x, y: p.y })) });
        }
      } else if (activeTool === 'bezier' && activeShape.points) {
        const dragIdx = penDragIndexRef.current;
        if (dragIdx !== null && activeShape.points[dragIdx]) {
          // Dragging out symmetric handles from the node just placed
          const node = activeShape.points[dragIdx];
          if (Math.hypot(pos.x - node.x, pos.y - node.y) * viewport.transform.scale > 3) {
            const newPoints = activeShape.points.slice();
            newPoints[dragIdx] = {
              ...node,
              cp2: { x: pos.x, y: pos.y },
              cp1: { x: 2 * node.x - pos.x, y: 2 * node.y - pos.y },
              pointType: 'symmetric'
            };
            updateShape(activeId, { points: newPoints });
          }
        } else {
          setDrawHoverTick(t => t + 1);
        }
      }
    } else if (!isPanning && !isDragging && !isDrawing && activeTool === 'select') {
      const pos = getCanvasPos(e.clientX, e.clientY);

      let detectedAction: DragAction = 'none';
      if (selectedIds.length === 1) {
          const rawSelected = shapes.find(s => s.id === selectedIds[0]);
          if (rawSelected) {
              const selected = getAnimatedShape(rawSelected, currentTime, animations);
              detectedAction = detectHandleHit(pos, selected, viewport.transform.scale);
          }
      }

      if (detectedAction === 'resize-nw' || detectedAction === 'resize-se') {
          document.body.style.cursor = 'nwse-resize';
      } else if (detectedAction === 'resize-ne' || detectedAction === 'resize-sw') {
          document.body.style.cursor = 'nesw-resize';
      } else if (detectedAction === 'resize-n' || detectedAction === 'resize-s') {
          document.body.style.cursor = 'ns-resize';
      } else if (detectedAction === 'resize-e' || detectedAction === 'resize-w') {
          document.body.style.cursor = 'ew-resize';
      } else if (detectedAction.startsWith('rotate')) {
          document.body.style.cursor = 'crosshair';
      } else {
          document.body.style.cursor = spacePressed ? 'grab' : 'default';
      }

      const hitShape = [...shapes].reverse().find(s => {
          if (s.type === 'group' || s.locked || s.hidden) return false;
          const animShape = getAnimatedShape(s, currentTime, animations);
          return isPointInShape(pos.x, pos.y, animShape);
      });
      
      if (hitShape && hitShape.id !== hoveredId) {
        setHovered(hitShape.id);
      } else if (!hitShape && hoveredId !== null) {
        setHovered(null);
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pendingPointerEventRef.current = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, altKey: e.altKey };
    if (moveRafIdRef.current === null) {
      moveRafIdRef.current = requestAnimationFrame(() => {
        moveRafIdRef.current = null;
        if (pendingPointerEventRef.current) {
          handlePointerMoveThrottled(pendingPointerEventRef.current);
        }
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    penDragIndexRef.current = null;
    if (motionDragRef.current) {
      motionDragRef.current = null;
      return;
    }
    if (freehandPointsRef.current) {
      // Pencil: simplify + smooth the stroke into Bézier nodes, close if it ends on its start
      const raw = freehandPointsRef.current;
      freehandPointsRef.current = null;
      const activeShape = shapes.find(s => s.id === selectedIds[0]);
      if (activeShape) {
        const scale = viewport.transform.scale;
        const first = raw[0];
        const last = raw[raw.length - 1];
        const isClosed = raw.length > 8 && Math.hypot(last.x - first.x, last.y - first.y) * scale <= 12;
        let simplified = simplifyPoints(raw, 1.5 / scale);
        if (isClosed && simplified.length > 3) simplified = simplified.slice(0, -1);
        finalizePathDrawing({ ...activeShape, points: smoothToBezier(simplified, isClosed) }, isClosed);
      }
      setDrawHoverTick(t => t + 1);
      return;
    }
    if (dragAction === 'select-marquee') {
      selectionStartRef.current = null;
      setSelectionBox(null);
    }
    if (isDraggingNodeHandle) {
      setIsDraggingNodeHandle(false);
    }
    if (isPanning) {
      setIsPanning(false);
      document.body.style.cursor = spacePressed ? 'grab' : 'default';
    }
    if (isDraggingAnchor) {
      setIsDraggingAnchor(false);
    }
    if (isDragging) {
      setIsDragging(false);
      setDragAction('none');
      setActiveAlignmentGuides([]);
      if (dragAction === 'move') {
        const frames = shapes.filter(s => s.type === 'frame');
        selectedIds.forEach(id => {
          const shape = shapes.find(s => s.id === id);
          if (!shape || shape.type === 'frame') return;

          const cx = shape.x + shape.width / 2;
          const cy = shape.y + shape.height / 2;

          const containingFrame = [...frames].reverse().find(f => {
            if (f.id === shape.id) return false;
            const fx = Math.min(f.x, f.x + f.width);
            const fy = Math.min(f.y, f.y + f.height);
            const fw = Math.abs(f.width);
            const fh = Math.abs(f.height);
            return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
          });

          if (containingFrame) {
            if (shape.groupId !== containingFrame.id) {
              updateShape(shape.id, { groupId: containingFrame.id });
            }
          } else {
            const currentGroup = shapes.find(s => s.id === shape.groupId);
            if (currentGroup && currentGroup.type === 'frame') {
              updateShape(shape.id, { groupId: undefined });
            }
          }
        });
      }
      if (pendingClickSelection.current) {
        selectShape(
          pendingClickSelection.current.id,
          pendingClickSelection.current.shiftKey,
          pendingClickSelection.current.forceIndividual
        );
        pendingClickSelection.current = null;
      }
    }
    if (isDrawing && selectedIds.length > 0) {
      const activeShape = shapes.find(s => s.id === selectedIds[0]);
      if (activeShape && (activeShape.type === 'rectangle' || activeShape.type === 'ellipse' || activeShape.type === 'frame')) {
         setIsDrawing(false);
         if (Math.abs(activeShape.width) < 5 || Math.abs(activeShape.height) < 5) {
           const defaultWidth = activeShape.type === 'frame' ? 800 : (100 / viewport.transform.scale);
           const defaultHeight = activeShape.type === 'frame' ? 600 : (100 / viewport.transform.scale);
           updateShape(activeShape.id, {
             width: defaultWidth,
             height: defaultHeight
           });
         } else {
           let nx = activeShape.x;
           let ny = activeShape.y;
           let nw = activeShape.width;
           let nh = activeShape.height;
           if (nw < 0) {
             nx = nx + nw;
             nw = Math.abs(nw);
           }
           if (nh < 0) {
             ny = ny + nh;
             nh = Math.abs(nh);
           }
           updateShape(activeShape.id, { x: nx, y: ny, width: nw, height: nh });
         }
         setTool('select');
      }
    } else if (drawStartPos.current && (activeTool === 'rectangle' || activeTool === 'ellipse' || activeTool === 'frame')) {
      if (activeTool === 'frame') {
        const frameCount = shapes.filter(s => s.type === 'frame').length;
        const newShape: BaseShape = {
          id: generateId(),
          type: 'frame',
          name: `Frame ${frameCount + 1}`,
          x: Math.round(drawStartPos.current.x - 400),
          y: Math.round(drawStartPos.current.y - 300),
          width: 800,
          height: 600,
          rotation: 0,
          fill: '#FFFFFF',
          stroke: '#E2E8F0',
          strokeWidth: 1,
          opacity: 1
        };
        addShape(newShape);
        selectShape(newShape.id);
        setTool('select');
      } else {
        const size = 100 / viewport.transform.scale;
        const newShape: BaseShape = {
          id: generateId(),
          type: activeTool,
          x: drawStartPos.current.x - size / 2,
          y: drawStartPos.current.y - size / 2,
          width: size,
          height: size,
          rotation: 0,
          fill: '#FFFFFF',
          stroke: 'transparent',
          strokeWidth: 0,
          opacity: 1
        };
        addShape(newShape);
        selectShape(newShape.id);
        setTool('select');
      }
    }
    drawStartPos.current = null;
  };

  return (
    <Box ref={containerRef} pos="absolute" inset={0} zIndex={0}>
      <Box
        as="canvas"
        ref={canvasRef}
        w="full"
        h="full"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={handleContextMenu}
      />
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        items={getContextMenuItems()}
      />
    </Box>
  );
}
