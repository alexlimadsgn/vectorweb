import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Flex, Text, Badge, Button, Input, Menu, Portal } from '@chakra-ui/react';
import { useStore } from '../store/useStore';
import {
  Play, Pause, Repeat, Download, ChevronUp, ChevronDown, ChevronRight,
  Trash2, Sparkles, Wand2, Check, Gauge, Clock, Sliders, Zap
} from 'lucide-react';
import { AnimatableProperty, BaseShape, Keyframe, SpringConfig } from '../types';
import { exportAnimatedSvg } from '../lib/exportAnimatedSvg';
import { normalizeEasingName } from '../lib/animationUtils';
import EasingEditor from './EasingEditor';

const PROPERTY_LABELS: Record<AnimatableProperty, string> = {
  x: 'Posição X',
  y: 'Posição Y',
  width: 'Largura (W)',
  height: 'Altura (H)',
  rotation: 'Rotação',
  opacity: 'Opacidade',
  fill: 'Cor de Preenchimento',
  radius: 'Canto Arredondado',
  stroke: 'Cor do Contorno',
  strokeWidth: 'Espessura',
  trimStart: 'Trim Início',
  trimEnd: 'Trim Fim',
  trimOffset: 'Trim Deslocamento',
  arcStart: 'Arco Início',
  arcSweep: 'Arco Abertura',
  arcRatio: 'Arco Ratio'
};

const TRACK_PADDING = 16;
const RULER_HEIGHT = 28;

type KfRef = { shapeId: string; property: AnimatableProperty; keyframeId: string };
const kfKey = (r: KfRef) => `${r.shapeId}|${r.property}|${r.keyframeId}`;

const EASING_OPTIONS = [
  { value: 'power1.out', label: 'Suave (Power1 Out)' },
  { value: 'power2.out', label: 'Aceleração Média (Power2 Out)' },
  { value: 'power3.out', label: 'Aceleração Forte (Power3 Out)' },
  { value: 'power4.out', label: 'Aceleração Ultra Forte (Power4 Out)' },
  { value: 'bounce.out', label: '🏀 Quicar (Bounce Out)' },
  { value: 'elastic.out(1, 0.3)', label: '⚡ Elástico (Elastic Out)' },
  { value: 'back.out(1.7)', label: '🔙 Efeito Recuo (Back Out)' },
  { value: 'power2.inOut', label: 'Transição Dupla (Power2 InOut)' },
  { value: 'power3.inOut', label: 'Entrada/Saída Suave (Power3 InOut)' },
  { value: 'circ.out', label: 'Circular (Circ Out)' },
  { value: 'expo.out', label: 'Exponencial (Expo Out)' },
  { value: 'sine.inOut', label: 'Onda Senoidal (Sine InOut)' },
  { value: 'steps(6)', label: '🪜 Passos / Stop-Motion (Steps)' },
  { value: 'none', label: 'Linear (Constante)' }
];

const PRESET_OPTIONS = [
  { name: 'Fade In', label: 'Fade In', icon: '◐', desc: 'Aparecer suave' },
  { name: 'Slide Right', label: 'Slide', icon: '➔', desc: 'Deslizar e aparecer' },
  { name: 'Rise', label: 'Subir', icon: '↑', desc: 'Subir e aparecer' },
  { name: 'Grow', label: 'Crescer', icon: '↗', desc: 'Escalar do centro' },
  { name: 'Pop', label: 'Pop', icon: '⚡', desc: 'Pop elástico' },
  { name: 'Drop', label: 'Quicar', icon: '●', desc: 'Cair e quicar' },
  { name: 'Pulse', label: 'Pulsar', icon: '♥', desc: 'Ênfase' },
  { name: 'Wiggle', label: 'Balançar', icon: '〰', desc: 'Ênfase' },
  { name: 'Float', label: 'Flutuar', icon: '≈', desc: 'Loop suave' },
  { name: 'Spin', label: 'Rodar 360°', icon: '↻', desc: 'Loop contínuo' },
  { name: 'Fade Out', label: 'Sumir', icon: '◑', desc: 'Saída' },
  { name: 'Scale Out', label: 'Encolher', icon: '↘', desc: 'Saída' },
];

export default function TimelinePanel() {
  const shapes = useStore((s) => s.shapes);
  const selectedIds = useStore((s) => s.selectedIds);
  const selectShape = useStore((s) => s.selectShape);
  const isPlaying = useStore((s) => s.isPlaying);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const currentTime = useStore((s) => s.currentTime);
  const setCurrentTime = useStore((s) => s.setCurrentTime);
  const duration = useStore((s) => s.duration);
  const setDuration = useStore((s) => s.setDuration);
  const playbackSpeed = useStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed);
  const isLooping = useStore((s) => s.isLooping);
  const setIsLooping = useStore((s) => s.setIsLooping);
  const showTimeline = useStore((s) => s.showTimeline);
  const toggleTimeline = useStore((s) => s.toggleTimeline);
  const timelineHeight = useStore((s) => s.timelineHeight);
  const setTimelineHeight = useStore((s) => s.setTimelineHeight);
  const animations = useStore((s) => s.animations);
  const addOrUpdateKeyframe = useStore((s) => s.addOrUpdateKeyframe);
  const deleteKeyframe = useStore((s) => s.deleteKeyframe);
  const moveKeyframe = useStore((s) => s.moveKeyframe);
  const shiftShapeKeyframes = useStore((s) => s.shiftShapeKeyframes);
  const applyPresetAnimation = useStore((s) => s.applyPresetAnimation);
  const keyframeAllSelected = useStore((s) => s.keyframeAllSelected);
  const autoKeyframeEnabled = useStore((s) => s.autoKeyframeEnabled);
  const toggleAutoKeyframe = useStore((s) => s.toggleAutoKeyframe);
  const updateKeyframeEasing = useStore((s) => s.updateKeyframeEasing);
  const setKeyframeTimes = useStore((s) => s.setKeyframeTimes);
  const deleteKeyframes = useStore((s) => s.deleteKeyframes);

  const [expandedShapes, setExpandedShapes] = useState<Record<string, boolean>>({});
  const [selectedKeyframe, setSelectedKeyframe] = useState<KfRef | null>(null);
  // Multi-selection (marquee / Shift+click); `selectedKeyframe` is the primary one shown in the toolbar
  const [selectedKfs, setSelectedKfs] = useState<KfRef[]>([]);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number; active: boolean; additive: boolean; base: KfRef[] } | null>(null);
  // Keyframes being dragged together, with their times at drag start
  const groupDragRef = useRef<{ startTime: number; items: (KfRef & { time0: number })[] } | null>(null);

  useEffect(() => {
    useStore.getState().setKeyframeSelectionActive(selectedKfs.length > 0);
  }, [selectedKfs.length]);

  // Selecting other objects or hiding the timeline drops the keyframe selection
  useEffect(() => {
    setSelectedKfs([]);
    setSelectedKeyframe(null);
  }, [selectedIds.join(','), showTimeline]);

  const isKfSelected = (shapeId: string, property: string, keyframeId: string) =>
    selectedKfs.some(r => r.keyframeId === keyframeId && r.shapeId === shapeId && r.property === property);

  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [draggingKeyframe, setDraggingKeyframe] = useState<{ shapeId: string; property: AnimatableProperty; keyframeId: string } | null>(null);
  const [draggingBlock, setDraggingBlock] = useState<{ shapeId: string; startX: number } | null>(null);

  const [isResizingHeight, setIsResizingHeight] = useState<boolean>(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);

  const [easingEditorState, setEasingEditorState] = useState<{
    keyframe: Keyframe;
    shapeId: string;
    property: AnimatableProperty;
    anchorRect: DOMRect;
  } | null>(null);

  const trackCanvasRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (shapeId: string) => {
    setExpandedShapes(prev => ({ ...prev, [shapeId]: !prev[shapeId] }));
  };

  const getTimeFromX = (x: number, trackWidth: number) => {
    const usableWidth = trackWidth - (TRACK_PADDING * 2);
    if (usableWidth <= 0) return 0;
    const relativeX = x - TRACK_PADDING;
    const time = (relativeX / usableWidth) * duration;
    return Math.max(0, Math.min(duration, Math.round(time * 100) / 100));
  };

  const handleKeyframePointerDown = (e: React.PointerEvent, ref: KfRef) => {
    e.stopPropagation();
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    let next = selectedKfs;
    if (additive) {
      next = isKfSelected(ref.shapeId, ref.property, ref.keyframeId)
        ? selectedKfs.filter(r => kfKey(r) !== kfKey(ref))
        : [...selectedKfs, ref];
    } else if (!isKfSelected(ref.shapeId, ref.property, ref.keyframeId)) {
      next = [ref];
    }
    setSelectedKfs(next);
    setSelectedKeyframe(next.some(r => kfKey(r) === kfKey(ref)) ? ref : next[next.length - 1] || null);
    if (additive || !trackCanvasRef.current) return;

    // Drag the whole selection, keeping relative timing
    const rect = trackCanvasRef.current.getBoundingClientRect();
    const items = next.map(r => {
      const kf = useStore.getState().animations[r.shapeId]?.[r.property]?.find(k => k.id === r.keyframeId);
      return { ...r, time0: kf?.time ?? 0 };
    });
    groupDragRef.current = { startTime: getTimeFromX(e.clientX - rect.left, rect.width), items };
    setDraggingKeyframe(ref);
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizingHeight(true);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isResizingHeight) {
        const newHeight = window.innerHeight - e.clientY;
        const clamped = Math.max(140, Math.min(newHeight, window.innerHeight - 80));
        setTimelineHeight(clamped);
      }
    };

    const handlePointerUp = () => {
      setIsResizingHeight(false);
    };

    if (isResizingHeight) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizingHeight]);

  const handleTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.keyframe-diamond')) return;
    if (!trackCanvasRef.current) return;
    const rect = trackCanvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (e.clientY - rect.top <= RULER_HEIGHT) {
      // Ruler: scrub the playhead
      setCurrentTime(getTimeFromX(clickX, rect.width));
      setDraggingPlayhead(true);
      return;
    }
    // Track area: drag = marquee selection, click = move playhead (resolved on pointer up)
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    setMarquee({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, active: false, additive, base: additive ? selectedKfs : [] });
  };

  useEffect(() => {
    if (!marquee) return;
    const onMove = (e: PointerEvent) => {
      setMarquee(m => {
        if (!m) return m;
        const active = m.active || Math.hypot(e.clientX - m.x0, e.clientY - m.y0) > 4;
        if (active) {
          const left = Math.min(m.x0, e.clientX), right = Math.max(m.x0, e.clientX);
          const top = Math.min(m.y0, e.clientY), bottom = Math.max(m.y0, e.clientY);
          const hits = new Map<string, KfRef>();
          m.base.forEach(r => hits.set(kfKey(r), r));
          trackCanvasRef.current?.querySelectorAll<HTMLElement>('[data-kf]').forEach(el => {
            const b = el.getBoundingClientRect();
            const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
            if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
              const [shapeId, property, keyframeId] = el.dataset.kf!.split('|');
              const ref = { shapeId, property: property as AnimatableProperty, keyframeId };
              hits.set(kfKey(ref), ref);
            }
          });
          const list = [...hits.values()];
          setSelectedKfs(list);
          setSelectedKeyframe(list[list.length - 1] || null);
        }
        return { ...m, x1: e.clientX, y1: e.clientY, active };
      });
    };
    const onUp = (e: PointerEvent) => {
      setMarquee(m => {
        if (m && !m.active && trackCanvasRef.current) {
          const rect = trackCanvasRef.current.getBoundingClientRect();
          setCurrentTime(getTimeFromX(e.clientX - rect.left, rect.width));
          if (!m.additive) {
            setSelectedKfs([]);
            setSelectedKeyframe(null);
          }
        }
        return null;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [!!marquee, duration]);

  const pendingTimelinePointerRef = useRef<PointerEvent | null>(null);
  const timelineRafRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      pendingTimelinePointerRef.current = e;
      if (timelineRafRef.current === null) {
        timelineRafRef.current = requestAnimationFrame(() => {
          timelineRafRef.current = null;
          const ev = pendingTimelinePointerRef.current;
          if (!ev) return;

          if (draggingPlayhead && trackCanvasRef.current) {
            const rect = trackCanvasRef.current.getBoundingClientRect();
            const clickX = ev.clientX - rect.left;
            const newTime = getTimeFromX(clickX, rect.width);
            setCurrentTime(newTime);
          } else if (draggingKeyframe && trackCanvasRef.current) {
            const rect = trackCanvasRef.current.getBoundingClientRect();
            const clickX = ev.clientX - rect.left;
            const newTime = getTimeFromX(clickX, rect.width);
            const drag = groupDragRef.current;
            if (drag) {
              // Clamp the shared offset so no keyframe leaves the timeline
              const minT0 = Math.min(...drag.items.map(i => i.time0));
              const maxT0 = Math.max(...drag.items.map(i => i.time0));
              const delta = Math.max(-minT0, Math.min(duration - maxT0, newTime - drag.startTime));
              setKeyframeTimes(drag.items.map(i => ({ ...i, time: i.time0 + delta })));
            } else {
              moveKeyframe(draggingKeyframe.shapeId, draggingKeyframe.property, draggingKeyframe.keyframeId, newTime);
            }
          } else if (draggingBlock && trackCanvasRef.current) {
            const rect = trackCanvasRef.current.getBoundingClientRect();
            const usableWidth = rect.width - (TRACK_PADDING * 2);
            if (usableWidth > 0) {
              const dx = ev.clientX - draggingBlock.startX;
              const timeDelta = (dx / usableWidth) * duration;
              if (Math.abs(timeDelta) >= 0.01) {
                shiftShapeKeyframes(draggingBlock.shapeId, timeDelta);
                setDraggingBlock(prev => prev ? { ...prev, startX: ev.clientX } : null);
              }
            }
          }
        });
      }
    };

    const handlePointerUp = () => {
      setDraggingPlayhead(false);
      setDraggingKeyframe(null);
      groupDragRef.current = null;
      setDraggingBlock(null);
    };

    if (draggingPlayhead || draggingKeyframe || draggingBlock) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingPlayhead, !!draggingKeyframe, !!draggingBlock, duration]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKfs.length > 0) {
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
        deleteKeyframes(selectedKfs);
        setSelectedKfs([]);
        setSelectedKeyframe(null);
      }
      if (e.key === 'Escape' && selectedKfs.length > 0) {
        setSelectedKfs([]);
        setSelectedKeyframe(null);
      }
      if (e.code === 'Space') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
        e.preventDefault();
        setIsPlaying(!isPlaying);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKfs, isPlaying]);

  if (!showTimeline) {
    return (
      <Box pos="fixed" bottom="12px" left="50%" transform="translateX(-50%)" zIndex={40}>
        <Button
          onClick={toggleTimeline}
          size="sm"
          bg="#18181BE6"
          color="#E5E2E1"
          border="1px solid"
          borderColor="#3F3F4680"
          rounded="md"
          px={4}
          py={2}
          fontSize="xs"
          fontWeight="semibold"
          _hover={{ borderColor: '#818CF8' }}
          display="flex"
          alignItems="center"
          gap={2}
        >
          <Sparkles size={14} color="#818CF8" />
          <Text>Timeline</Text>
          <ChevronUp size={14} />
        </Button>
      </Box>
    );
  }

  const fps = 30;
  const currentFrame = Math.round(currentTime * fps);
  const totalFrames = Math.round(duration * fps);
  const ticksCount = Math.floor(duration * 2) + 1;
  const tickInterval = duration / Math.max(1, ticksCount - 1);

  return (
    <>
    <Box
      id="timeline-panel"
      pos="fixed"
      bottom={0}
      left={0}
      right={0}
      h={`${timelineHeight}px`}
      bg="#1A191E"
      borderTop="1px solid"
      borderColor="#46455466"
      zIndex={40}
      display="flex"
      flexDir="column"
      fontFamily="sans-serif"
      userSelect="none"
      fontSize="xs"
      color="#C7C4D6"
    >
      {/* Height Resize Handle Bar - Sits outside above top edge */}
      <Box
        onPointerDown={handleResizePointerDown}
        pos="absolute"
        top="-14px"
        left={0}
        right={0}
        h="16px"
        cursor="ns-resize"
        zIndex={50}
        display="flex"
        alignItems="center"
        justifyContent="center"
        role="separator"
        aria-label="Redimensionar Timeline"
        _hover={{ '& > div': { bg: '#818CF8', w: '52px', borderColor: '#818CF8' } }}
      >
        <Box
          w="40px"
          h="5px"
          bg="#3F3F46"
          border="1px solid"
          borderColor="#3F3F4680"
          rounded="full"
          transition="all 0.2s"
        />
      </Box>
      {/* Timeline Controls Header Bar */}
      <Flex
        h="42px"
        px={4}
        bg="#18181B"
        borderBottom="1px solid"
        borderColor="#3F3F4680"
        align="center"
        justify="space-between"
        shrink={0}
      >
        <Flex align="center" gap={2.5}>
          {/* Play / Pause Toggle */}
          <Box
            as="button"
            id="timeline-play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            w="28px"
            h="28px"
            rounded="md"
            display="flex"
            alignItems="center"
            justifyContent="center"
            transition="all 0.15s"
            bg={isPlaying ? '#818CF8' : '#2A2932'}
            color={isPlaying ? '#000000' : '#E5E2E1'}
            _hover={{ bg: isPlaying ? '#A5B4FC' : '#353440' }}
            title={isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: '2px' }} />}
          </Box>

          {/* Loop Toggle */}
          <Box
            as="button"
            id="timeline-loop-btn"
            onClick={() => setIsLooping(!isLooping)}
            w="28px"
            h="28px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            rounded="md"
            transition="all 0.15s"
            color={isLooping ? '#818CF8' : '#918F9F'}
            bg={isLooping ? '#818CF820' : 'transparent'}
            border="1px solid"
            borderColor={isLooping ? '#818CF84D' : 'transparent'}
            _hover={{ bg: isLooping ? '#818CF833' : '#2A2932' }}
            title={isLooping ? 'Repetição Ativa (Loop)' : 'Loop Desativado'}
          >
            <Repeat size={14} />
          </Box>

          {/* Speed Selector */}
          <Box pos="relative" style={{ position: 'relative' }}>
            <Box
              as="button"
              onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
              display="flex"
              alignItems="center"
              gap={1}
              px={2.5}
              h="28px"
              rounded="md"
              bg={isSpeedMenuOpen ? '#353440' : '#2A2932'}
              border="1px solid"
              borderColor={isSpeedMenuOpen ? '#818CF8' : '#4645544D'}
              color="#E5E2E1"
              fontSize="11px"
              fontWeight="medium"
              _hover={{ bg: '#353440' }}
              title="Velocidade da Animação"
              cursor="pointer"
            >
              <Gauge size={13} color="#818CF8" />
              <Text fontStyle="mono">{playbackSpeed}x</Text>
              <ChevronDown size={11} color="#918F9F" />
            </Box>
            {isSpeedMenuOpen && (
              <>
                <Portal>
                  <Box pos="fixed" inset={0} zIndex={999} onClick={() => setIsSpeedMenuOpen(false)} />
                </Portal>
                <Box
                  pos="absolute"
                  bottom="100%"
                  left={0}
                  mb="6px"
                  style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 1000 }}
                  bg="#18181B"
                  border="1px solid"
                  borderColor="#3F3F46"
                  boxShadow="0 10px 30px rgba(0,0,0,0.8)"
                  rounded="md"
                  py={1}
                  w="80px"
                  display="flex"
                  flexDir="column"
                >
                  {[0.25, 0.5, 1.0, 1.5, 2.0, 4.0].map((speed) => (
                    <Box
                      key={speed}
                      as="button"
                      onClick={() => {
                        setPlaybackSpeed(speed);
                        setIsSpeedMenuOpen(false);
                      }}
                      px={2.5}
                      py={1}
                      textAlign="left"
                      fontSize="11px"
                      color={playbackSpeed === speed ? '#818CF8' : '#E5E2E1'}
                      fontWeight={playbackSpeed === speed ? 'bold' : 'normal'}
                      _hover={{ bg: '#27272A' }}
                      cursor="pointer"
                    >
                      {speed}x
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>

          <Box w="1px" h="16px" bg="#3F3F4680" mx={0.5} />

          {/* Auto-Keyframe Toggle */}
          <Box
            as="button"
            id="timeline-auto-keyframe-btn"
            onClick={toggleAutoKeyframe}
            display="flex"
            alignItems="center"
            gap={1.5}
            px={2.5}
            h="28px"
            bg={autoKeyframeEnabled ? '#818CF820' : '#27272A'}
            border="1px solid"
            borderColor={autoKeyframeEnabled ? '#818CF866' : '#3F3F4680'}
            rounded="md"
            color={autoKeyframeEnabled ? '#818CF8' : '#918F9F'}
            fontSize="11px"
            fontWeight="medium"
            _hover={{ bg: autoKeyframeEnabled ? '#818CF833' : '#323238' }}
            title={autoKeyframeEnabled ? 'Auto-Keyframe Ativo (Clique para desativar a gravação automática)' : 'Auto-Keyframe Desativado (Clique para ativar a gravação automática)'}
          >
            <Sparkles size={13} color={autoKeyframeEnabled ? '#818CF8' : '#918F9F'} />
            <Text>Auto Keyframe</Text>
            <Box
              w="6px"
              h="6px"
              rounded="full"
              bg={autoKeyframeEnabled ? '#22C55E' : '#6B7280'}
            />
          </Box>

          {/* Keyframe Selection */}
          <Box
            as="button"
            id="timeline-add-keyframe-btn"
            onClick={keyframeAllSelected}
            disabled={selectedIds.length === 0}
            display="flex"
            alignItems="center"
            gap={1.5}
            px={2.5}
            h="28px"
            bg="#27272A"
            opacity={selectedIds.length === 0 ? 0.4 : 1}
            cursor={selectedIds.length === 0 ? 'not-allowed' : 'pointer'}
            border="1px solid"
            borderColor="#3F3F4680"
            rounded="md"
            color="#E5E2E1"
            fontSize="11px"
            fontWeight="medium"
            _hover={{ bg: selectedIds.length > 0 ? '#323238' : '#27272A' }}
            title="Adicionar Keyframe para Seleção no Tempo Atual"
          >
            <Box w="8px" h="8px" transform="rotate(45deg)" bg="#818CF8" rounded="1px" />
            <Text>+ Keyframe</Text>
          </Box>

          {/* Time Scrubber Display */}
          <Flex
            align="center"
            gap={1.5}
            bg="#121214"
            px={2.5}
            h="28px"
            shrink={0}
            rounded="md"
            border="1px solid"
            borderColor="#3F3F4680"
            fontFamily="monospace"
            fontSize="11px"
            _focusWithin={{ borderColor: '#818CF8' }}
          >
            <Clock size={13} color="#818CF8" style={{ flexShrink: 0 }} />
            <Text fontWeight="bold" color="#818CF8" fontSize="11px" lineHeight="1" style={{ flexShrink: 0 }}>
              {currentTime.toFixed(2)}s
            </Text>
            <Text color="#918F9F" fontSize="11px" lineHeight="1" style={{ flexShrink: 0 }}>
              /
            </Text>
            <Input
              size="xs"
              type="number"
              step="0.5"
              min="0.5"
              max="60"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value) || 3.0)}
              bg="transparent"
              border="none"
              p={0}
              w="28px"
              h="18px"
              fontSize="11px"
              fontFamily="monospace"
              color="#C7C4D6"
              textAlign="center"
              _focus={{ outline: 'none', boxShadow: 'none' }}
              title="Duração total do timeline (s)"
            />
            <Text color="#918F9F" fontSize="11px" lineHeight="1" style={{ flexShrink: 0 }}>
              s
            </Text>
            <Badge
              bg="#818CF820"
              color="#818CF8"
              px={1.5}
              h="18px"
              display="inline-flex"
              alignItems="center"
              rounded="xs"
              fontSize="9px"
              fontWeight="medium"
              ml={1}
              style={{ flexShrink: 0 }}
            >
              F: {currentFrame}/{totalFrames}
            </Badge>
          </Flex>
        </Flex>

        {/* Right Header Actions */}
        <Flex align="center" gap={2.5}>

          {/* Selected Keyframe Inspector / Easing Picker */}
          {selectedKeyframe && (() => {
            const shapeAnim = animations[selectedKeyframe.shapeId]?.[selectedKeyframe.property];
            const currentKf = shapeAnim?.find(k => k.id === selectedKeyframe.keyframeId);
            const currentEasing = currentKf?.easing || 'power1.out';

            return (
              <Flex align="center" gap={1.5} bg="#26252F" px={2.5} h="28px" rounded="md" border="1px solid" borderColor="#818CF880">
                <Zap size={12} color="#FBBF24" />
                <Text fontSize="9px" textTransform="uppercase" fontWeight="bold" color="#FBBF24">
                  {selectedKfs.length > 1 ? `${selectedKfs.length} keyframes · Curva:` : 'Curva:'}
                </Text>
                <select
                  value={currentEasing}
                  onChange={(e) => {
                    const targets = selectedKfs.length > 0 ? selectedKfs : [selectedKeyframe];
                    targets.forEach(r => useStore.getState().updateKeyframeEasing(r.shapeId, r.property, r.keyframeId, e.target.value));
                  }}
                  style={{ background: '#17161C', color: '#E5E2E1', border: '1px solid #46455480', borderRadius: '6px', padding: '2px 6px', fontSize: '10px', outline: 'none' }}
                >
                  {EASING_OPTIONS.map(e => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    deleteKeyframes(selectedKfs.length > 0 ? selectedKfs : [selectedKeyframe]);
                    setSelectedKfs([]);
                    setSelectedKeyframe(null);
                  }}
                  minW="22px"
                  h="22px"
                  p={0}
                  color="#F87171"
                  _hover={{ bg: '#F8717133' }}
                  rounded="md"
                  transition="colors"
                  title="Excluir Keyframe"
                >
                  <Trash2 size={12} />
                </Button>
              </Flex>
            );
          })()}

          {/* Collapse Panel Button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={toggleTimeline}
            minW="24px"
            h="24px"
            p={0}
            color="#918F9F"
            _hover={{ bg: '#2A2932', color: '#E5E2E1' }}
            rounded="md"
            title="Minimizar Timeline"
          >
            <ChevronDown size={14} />
          </Button>
        </Flex>
      </Flex>

      {/* Main Track Body Area */}
      <Flex flex={1} overflow="hidden">
        {/* Left Column: Shape Layers & Properties Tree */}
        <Box w="230px" bg="#18181B" borderRight="1px solid" borderColor="#3F3F4680" display="flex" flexDir="column" shrink={0}>
          <Flex h="28px" minH="28px" maxH="28px" shrink={0} px={3} bg="#1F1F23" borderBottom="1px solid" borderColor="#3F3F4680" align="center" justify="space-between" fontSize="10px" fontWeight="bold" tracking="wider" textTransform="uppercase" color="#918F9F">
            <Text>Camadas ({shapes.filter(s => s.type !== 'group').length})</Text>
            <Text>Propriedades</Text>
          </Flex>

          <Box flex={1} overflowY="auto">

          {shapes.length === 0 ? (
            <Text p={4} textAlign="center" color="#918F9F" fontSize="11px" fontStyle="italic">
              Nenhum elemento no canvas
            </Text>
          ) : (
            shapes.map((shape) => {
              if (shape.type === 'group') return null;
              const isSelected = selectedIds.includes(shape.id);
              const isExpanded = !!expandedShapes[shape.id];
              const shapeAnims = animations[shape.id] || {};
              const hasKfs = Object.values(shapeAnims).some((k) => k && k.length > 0);

              return (
                <Box key={shape.id} borderBottom="1px solid" borderColor="#46455420">
                  {/* Master Shape Track Row */}
                  <Flex
                    onClick={() => selectShape(shape.id)}
                    h="28px"
                    px={2}
                    align="center"
                    justify="space-between"
                    cursor="pointer"
                    transition="colors 0.15s"
                    bg={isSelected ? '#818CF826' : 'transparent'}
                    color={isSelected ? '#FFFFFF' : '#C7C4D6'}
                    _hover={{ bg: isSelected ? '#818CF833' : '#27272A' }}
                  >
                    <Flex align="center" gap={1.5} overflow="hidden">
                      <Box
                        as="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(shape.id);
                        }}
                        p={0.5}
                        _hover={{ bg: '#323238' }}
                        rounded="xs"
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </Box>
                      <Box
                        w="10px"
                        h="10px"
                        rounded="2px"
                        shrink={0}
                        border="1px solid #FFFFFF33"
                        style={{ backgroundColor: shape.fill !== 'transparent' ? shape.fill : '#818CF8' }}
                      />
                      <Text truncate fontSize="11px" fontWeight={isSelected ? 'semibold' : 'normal'}>
                        {shape.name || `${shape.type} ${shape.id.substring(0, 4)}`}
                      </Text>
                    </Flex>

                    {hasKfs && (
                      <Box w="7px" h="7px" transform="rotate(45deg)" bg="#818CF8" shrink={0} title="Possui animação" />
                    )}
                  </Flex>

                  {/* Sub-Property Tracks */}
                  {isExpanded && hasKfs && (
                    <Box bg="#121214" pl={6} borderTop="1px solid" borderColor="#3F3F464D">
                      {(['x', 'y', 'width', 'height', 'rotation', 'opacity', 'fill', 'radius', 'stroke', 'strokeWidth', 'trimStart', 'trimEnd', 'trimOffset', 'arcStart', 'arcSweep', 'arcRatio'] as AnimatableProperty[]).map((prop) => {
                        // Only list properties that actually have keyframes
                        if (!animations[shape.id]?.[prop]?.length) return null;
                        const propKfs = shapeAnims[prop] || [];
                        const hasPropKfs = propKfs.length > 0;

                        return (
                          <Flex
                            key={prop}
                            h="24px"
                            pr={2}
                            align="center"
                            justify="space-between"
                            fontSize="10px"
                            color="#918F9F"
                            _hover={{ color: '#E5E2E1', bg: '#ffffff0a' }}
                            transition="colors"
                          >
                            <Text truncate>{PROPERTY_LABELS[prop]}</Text>
                            <Box
                              as="button"
                              onClick={() => addOrUpdateKeyframe(shape.id, prop)}
                              p={0.5}
                              _hover={{ color: '#818CF8' }}
                              title={`Adicionar Keyframe em ${currentTime}s`}
                            >
                              <Box w="8px" h="8px" transform="rotate(45deg)" border="1px solid" borderColor="#818CF8" bg={hasPropKfs ? '#818CF8' : 'transparent'} />
                            </Box>
                          </Flex>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              );
            })
          )}
          </Box>
        </Box>

        {/* Right Area: Timeline Ruler + Grid Canvas */}
        <Box
          ref={trackCanvasRef}
          onPointerDown={handleTimelinePointerDown}
          flex={1}
          pos="relative"
          bg="#121214"
          overflowX="auto"
          overflowY="auto"
          cursor="crosshair"
          userSelect="none"
        >
          {/* Time Ruler Header */}
          <Flex pos="sticky" top={0} left={0} right={0} h="28px" bg="#18181B" borderBottom="1px solid" borderColor="#3F3F4680" zIndex={20} align="center" pointerEvents="none">
            <Box pos="absolute" left={`${TRACK_PADDING}px`} right={`${TRACK_PADDING}px`} top={0} bottom={0}>
              {Array.from({ length: ticksCount }).map((_, i) => {
                const tickTime = i * tickInterval;
                const pct = (tickTime / duration) * 100;
                return (
                  <Box
                    key={i}
                    pos="absolute"
                    bottom={0}
                    top={0}
                    display="flex"
                    flexDir="column"
                    alignItems="center"
                    justifyContent="space-between"
                    style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
                  >
                    <Text fontSize="9px" fontFamily="monospace" color="#918F9F" pt={0.5}>
                      {tickTime.toFixed(1)}s
                    </Text>
                    <Box h="6px" w="1px" bg="#46455480" />
                  </Box>
                );
              })}
            </Box>
          </Flex>

          {/* Draggable Playhead Scrubber Line */}
          <Box
            pos="absolute"
            top={0}
            bottom={0}
            left={`${TRACK_PADDING}px`}
            right={`${TRACK_PADDING}px`}
            zIndex={30}
            pointerEvents="none"
          >
            <Box
              pos="absolute"
              top={0}
              bottom={0}
              w="2px"
              bg="#818CF8"
              style={{ left: `${(currentTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
            >
              {/* Playhead Scrubber Badge Handle */}
              <Box
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDraggingPlayhead(true);
                }}
                className="pointer-events-auto"
                pos="absolute"
                top="2px"
                left="50%"
                transform="translateX(-50%)"
                w="20px"
                h="22px"
                bg="#818CF8"
                roundedBottom="md"
                roundedTop="xs"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="ew-resize"
                transition="transform 0.1s"
                _hover={{ transform: 'translateX(-50%) scale(1.15)' }}
              >
                <Box w="3px" h="10px" bg="#00000066" rounded="full" />
              </Box>
            </Box>
          </Box>

          {/* Marquee selection box */}
          {marquee?.active && trackCanvasRef.current && (() => {
            const rect = trackCanvasRef.current!.getBoundingClientRect();
            const sl = trackCanvasRef.current!.scrollLeft, st = trackCanvasRef.current!.scrollTop;
            return (
              <Box
                pos="absolute"
                zIndex={40}
                pointerEvents="none"
                bg="#818CF826"
                border="1px solid #818CF8"
                rounded="sm"
                style={{
                  left: Math.min(marquee.x0, marquee.x1) - rect.left + sl,
                  top: Math.min(marquee.y0, marquee.y1) - rect.top + st,
                  width: Math.abs(marquee.x1 - marquee.x0),
                  height: Math.abs(marquee.y1 - marquee.y0),
                }}
              />
            );
          })()}

          {/* Track Rows & Keyframes */}
          <Box pt={0}>
            {shapes.map((shape) => {
              if (shape.type === 'group') return null;
              const isExpanded = !!expandedShapes[shape.id];
              const isShapeSelected = selectedIds.includes(shape.id);
              const shapeAnims = animations[shape.id] || {};

              let minTime = Infinity;
              let maxTime = -Infinity;
              let totalKfsCount = 0;

              Object.values(shapeAnims).forEach((kfs) => {
                if (kfs && kfs.length > 0) {
                  kfs.forEach((kf) => {
                    totalKfsCount++;
                    if (kf.time < minTime) minTime = kf.time;
                    if (kf.time > maxTime) maxTime = kf.time;
                  });
                }
              });

              const hasAnimation = totalKfsCount > 0;
              const spanStart = hasAnimation ? (minTime / duration) * 100 : 0;
              const spanEnd = hasAnimation ? (maxTime / duration) * 100 : 0;
              const spanWidth = hasAnimation ? Math.max(0.6, spanEnd - spanStart) : 0;

              return (
                <Box key={shape.id} borderBottom="1px solid" borderColor="#46455420">
                  {/* Master Shape Row Keyframes & Animation Span Bar */}
                  <Box pos="relative" h="28px" bg={isShapeSelected ? '#818CF812' : '#1A192066'} borderBottom="1px solid" borderColor="#4645541A">
                    <Box pos="absolute" left={`${TRACK_PADDING}px`} right={`${TRACK_PADDING}px`} top={0} bottom={0}>
                      {/* Master Span Block Bar (LottieLab / Jitter style block) */}
                      {hasAnimation && (
                        <Box
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            selectShape(shape.id);
                            setDraggingBlock({ shapeId: shape.id, startX: e.clientX });
                          }}
                          pos="absolute"
                          top="50%"
                          transform="translateY(-50%)"
                          h={isShapeSelected ? "18px" : "14px"}
                          rounded="full"
                          cursor="grab"
                          _active={{ cursor: 'grabbing' }}
                          zIndex={12}
                          bg={
                            isShapeSelected
                              ? 'linear-gradient(90deg, #818CF8 0%, #6366F1 100%)'
                              : 'rgba(255, 255, 255, 0.12)'
                          }
                          border="1px solid"
                          borderColor={isShapeSelected ? '#A5B4FC' : 'rgba(255, 255, 255, 0.2)'}
                          boxShadow={isShapeSelected ? '0 2px 10px rgba(129, 140, 248, 0.45)' : 'none'}
                          transition="height 0.15s, background 0.15s, border-color 0.15s"
                          style={{ left: `${spanStart}%`, width: `${spanWidth}%` }}
                          title={`${shape.name || shape.type}: Arraste para mover toda a animação (${minTime.toFixed(1)}s a ${maxTime.toFixed(1)}s)`}
                        />
                      )}

                      {/* Embedded Keyframe Diamonds */}
                      {Object.entries(shapeAnims).map(([prop, kfs]) => {
                        return kfs?.map((kf) => {
                          const pct = (kf.time / duration) * 100;
                          const isSelected = isKfSelected(shape.id, prop, kf.id);
                          const easeLabel = normalizeEasingName(kf.easing);

                          return (
                            <Box
                              key={kf.id}
                              className="keyframe-diamond"
                              data-kf={`${shape.id}|${prop}|${kf.id}`}
                              onPointerDown={(e) => handleKeyframePointerDown(e, { shapeId: shape.id, property: prop as AnimatableProperty, keyframeId: kf.id })}
                              pos="absolute"
                              top="50%"
                              transform="translate(-50%, -50%) rotate(45deg)"
                              w={isSelected ? "11px" : "9px"}
                              h={isSelected ? "11px" : "9px"}
                              cursor="grab"
                              _active={{ cursor: 'grabbing' }}
                              zIndex={isSelected ? 25 : 15}
                              transition="width 0.15s, height 0.15s, background 0.15s, box-shadow 0.15s"
                              bg={isSelected ? '#FBBF24' : '#FFFFFF'}
                              border="1.5px solid"
                              borderColor={isSelected ? '#FFFFFF' : '#6366F1'}
                              boxShadow={isSelected ? '0 0 10px #FBBF24' : '0 1px 3px rgba(0,0,0,0.4)'}
                              style={{ left: `${pct}%` }}
                              title={`${shape.name || shape.type} ${PROPERTY_LABELS[prop as AnimatableProperty]}: ${kf.value} @ ${kf.time}s (Ease: ${easeLabel})`}
                            />
                          );
                        });
                      })}
                    </Box>
                  </Box>

                  {/* Sub-Property Sub-Tracks & Keyframes */}
                  {isExpanded && hasAnimation && (
                    <Box bg="#100F14">
                      {(['x', 'y', 'width', 'height', 'rotation', 'opacity', 'fill', 'radius', 'stroke', 'strokeWidth', 'trimStart', 'trimEnd', 'trimOffset', 'arcStart', 'arcSweep', 'arcRatio'] as AnimatableProperty[]).map((prop) => {
                        // Only list properties that actually have keyframes
                        if (!animations[shape.id]?.[prop]?.length) return null;
                        const propKfs = shapeAnims[prop] || [];
                        const sortedKfs = [...propKfs].sort((a, b) => a.time - b.time);

                        const propHasKfs = sortedKfs.length > 0;
                        const p1 = propHasKfs ? (sortedKfs[0].time / duration) * 100 : 0;
                        const p2 = propHasKfs ? (sortedKfs[sortedKfs.length - 1].time / duration) * 100 : 0;
                        const propSpanWidth = propHasKfs ? Math.max(0.6, p2 - p1) : 0;

                        return (
                          <Box key={prop} pos="relative" h="24px" borderBottom="1px solid" borderColor="#4645541A">
                            <Box pos="absolute" left={`${TRACK_PADDING}px`} right={`${TRACK_PADDING}px`} top={0} bottom={0}>
                              {/* Sub-property Span Bar */}
                              {propHasKfs && (
                                <Box
                                  pos="absolute"
                                  top="50%"
                                  transform="translateY(-50%)"
                                  h="12px"
                                  bg={isShapeSelected ? 'rgba(129, 140, 248, 0.35)' : 'rgba(255, 255, 255, 0.08)'}
                                  border="1px solid"
                                  borderColor={isShapeSelected ? 'rgba(129, 140, 248, 0.5)' : 'rgba(255, 255, 255, 0.12)'}
                                  rounded="full"
                                  pointerEvents="none"
                                  style={{ left: `${p1}%`, width: `${propSpanWidth}%` }}
                                />
                              )}

                              {/* Keyframe Diamonds */}
                              {sortedKfs.map((kf) => {
                                const pct = (kf.time / duration) * 100;
                                const isSelected = isKfSelected(shape.id, prop, kf.id);

                                return (
                                  <Box
                                    key={kf.id}
                                    className="keyframe-diamond"
                                    data-kf={`${shape.id}|${prop}|${kf.id}`}
                                    onPointerDown={(e) => handleKeyframePointerDown(e, { shapeId: shape.id, property: prop, keyframeId: kf.id })}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setEasingEditorState({ keyframe: kf, shapeId: shape.id, property: prop, anchorRect: rect });
                                    }}
                                    pos="absolute"
                                    top="50%"
                                    transform="translate(-50%, -50%) rotate(45deg)"
                                    w={isSelected ? "10px" : "8px"}
                                    h={isSelected ? "10px" : "8px"}
                                    cursor="grab"
                                    _active={{ cursor: 'grabbing' }}
                                    zIndex={isSelected ? 25 : 15}
                                    transition="width 0.15s, height 0.15s, background 0.15s, box-shadow 0.15s"
                                    bg={isSelected ? '#FBBF24' : '#818CF8'}
                                    border="1px solid"
                                    borderColor={isSelected ? '#FFFFFF' : '#00000066'}
                                    boxShadow={isSelected ? '0 0 8px #FBBF2499' : 'none'}
                                    style={{ left: `${pct}%` }}
                                    title={`${PROPERTY_LABELS[prop]}: ${kf.value} em ${kf.time}s — ${kf.easing || 'ease'} (duplo clique para editar curva)`}
                                  />
                                );
                              })}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Flex>
    </Box>
    {easingEditorState && (
      <EasingEditor
        keyframe={easingEditorState.keyframe}
        shapeId={easingEditorState.shapeId}
        property={easingEditorState.property}
        anchorRect={easingEditorState.anchorRect}
        onClose={() => setEasingEditorState(null)}
        onApply={(easing, bezier, spring) => {
          updateKeyframeEasing(
            easingEditorState.shapeId,
            easingEditorState.property,
            easingEditorState.keyframe.id,
            easing,
            bezier,
            spring
          );
        }}
      />
    )}
  </>
  );
}
