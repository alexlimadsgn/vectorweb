import React, { useState } from 'react';
import { Box, Flex, Text, Badge, Grid, Slider, Input, Button, Portal } from '@chakra-ui/react';
import { useStore } from '../store/useStore';
import { AnimatableProperty } from '../types';
import { getAnimatedShape } from '../lib/animationUtils';
import { Sliders, RotateCcw, Lock, Unlock, Sparkles, Check, ChevronDown, Trash2 } from 'lucide-react';
import CustomColorPicker from './CustomColorPicker';
import PresetGallery from './PresetGallery';
import DesignPanel from './inspector/DesignPanel';
import { NumField, KeyframeButton } from './inspector/fields';

export default function InspectorPanel() {
  const shapes = useStore((s) => s.shapes);
  const selectedIds = useStore((s) => s.selectedIds);
  const updateShape = useStore((s) => s.updateShape);
  const pushHistory = useStore((s) => s.pushHistory);
  const isPlaying = useStore((s) => s.isPlaying);
  const currentTimeRaw = useStore((s) => s.currentTime);
  const animations = useStore((s) => s.animations);
  const showTimeline = useStore((s) => s.showTimeline);
  const timelineHeight = useStore((s) => s.timelineHeight);
  const [ratioLocked, setRatioLocked] = useState(false);
  const [tab, setTab] = useState<'design' | 'animate'>('design');
  const showMotionPath = useStore((s) => s.showMotionPath);
  const toggleMotionPath = useStore((s) => s.toggleMotionPath);

  // During playback, throttle property updates to prevent React DOM layout thrashing
  const currentTime = isPlaying ? Math.floor(currentTimeRaw * 4) / 4 : currentTimeRaw;

  const activeId = selectedIds.length > 0 ? selectedIds[0] : null;
  const rawActiveShape = activeId ? shapes.find(s => s.id === activeId) : null;
  const activeShape = rawActiveShape ? getAnimatedShape(rawActiveShape, currentTime, animations) : null;

  const handleChange = (field: string, value: string | number | boolean) => {
    if (!activeShape) return;

    if (ratioLocked && field === 'width' && activeShape.width !== 0) {
      const ratio = activeShape.height / activeShape.width;
      const targetW = Number(value);
      selectedIds.forEach(id => {
        const shape = shapes.find(s => s.id === id);
        if (shape) {
          updateShape(id, { width: targetW, height: targetW * ratio });
        }
      });
      return;
    }

    if (ratioLocked && field === 'height' && activeShape.height !== 0) {
      const ratio = activeShape.width / activeShape.height;
      const targetH = Number(value);
      selectedIds.forEach(id => {
        const shape = shapes.find(s => s.id === id);
        if (shape) {
          updateShape(id, { height: targetH, width: targetH * ratio });
        }
      });
      return;
    }

    if (field === 'anchor') {
      let ax = 0.5;
      let ay = 0.5;
      if (value === 'top-left') { ax = 0; ay = 0; }
      else if (value === 'top-middle') { ax = 0.5; ay = 0; }
      else if (value === 'top-right') { ax = 1; ay = 0; }
      else if (value === 'middle-left') { ax = 0; ay = 0.5; }
      else if (value === 'middle') { ax = 0.5; ay = 0.5; }
      else if (value === 'middle-right') { ax = 1; ay = 0.5; }
      else if (value === 'bottom-left') { ax = 0; ay = 1; }
      else if (value === 'bottom-middle') { ax = 0.5; ay = 1; }
      else if (value === 'bottom-right') { ax = 1; ay = 1; }
      
      selectedIds.forEach(id => {
        updateShape(id, { anchor: value as string, anchorX: ax, anchorY: ay });
      });
      return;
    }

    selectedIds.forEach(id => {
      updateShape(id, { [field]: value });
    });
  };

  const commitChange = () => {
    pushHistory();
  };

  const getNormBounds = (s: typeof activeShape) => {
    if (!s) return { x1: 0, x2: 0, y1: 0, y2: 0, width: 0, height: 0, cx: 0, cy: 0 };
    const x1 = Math.min(s.x, s.x + s.width);
    const x2 = Math.max(s.x, s.x + s.width);
    const y1 = Math.min(s.y, s.y + s.height);
    const y2 = Math.max(s.y, s.y + s.height);
    return {
      x1, x2, y1, y2,
      width: x2 - x1,
      height: y2 - y1,
      cx: (x1 + x2) / 2,
      cy: (y1 + y2) / 2
    };
  };

  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selectedShapes = shapes.filter(s => selectedIds.includes(s.id) && s.type !== 'group');
    if (selectedShapes.length < 2) return;

    pushHistory();

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    selectedShapes.forEach(s => {
      const b = getNormBounds(s);
      if (b.x1 < minX) minX = b.x1;
      if (b.x2 > maxX) maxX = b.x2;
      if (b.y1 < minY) minY = b.y1;
      if (b.y2 > maxY) maxY = b.y2;
    });

    const overallWidth = maxX - minX;
    const overallHeight = maxY - minY;
    const centerX = minX + overallWidth / 2;
    const centerY = minY + overallHeight / 2;

    selectedShapes.forEach(s => {
      const w = s.width;
      const h = s.height;
      
      if (type === 'left') {
        if (w >= 0) updateShape(s.id, { x: minX });
        else updateShape(s.id, { x: minX - w });
      } else if (type === 'center') {
        if (w >= 0) updateShape(s.id, { x: centerX - w / 2 });
        else updateShape(s.id, { x: centerX + w / 2 });
      } else if (type === 'right') {
        if (w >= 0) updateShape(s.id, { x: maxX - w });
        else updateShape(s.id, { x: maxX });
      } else if (type === 'top') {
        if (h >= 0) updateShape(s.id, { y: minY });
        else updateShape(s.id, { y: minY - h });
      } else if (type === 'middle') {
        if (h >= 0) updateShape(s.id, { y: centerY - h / 2 });
        else updateShape(s.id, { y: centerY + h / 2 });
      } else if (type === 'bottom') {
        if (h >= 0) updateShape(s.id, { y: maxY - h });
        else updateShape(s.id, { y: maxY });
      }
    });
  };

  return (
    <Box
      pos="fixed"
      right="16px"
      top="64px"
      w="280px"
      bg="#18181B"
      border="1px solid"
      borderColor="#3F3F4680"
      rounded="lg"
      zIndex={30}
      overflow="hidden"
      display="flex"
      flexDir="column"
      maxH={showTimeline ? `calc(100vh - ${timelineHeight + 80}px)` : 'calc(100vh - 80px)'}
    >
      {/* Header: Design / Animação tabs */}
      <Flex px={2} pt={2} gap={1} borderBottom="1px solid" borderColor="#3F3F4680" align="flex-end" shrink={0}>
        {([['design', 'Design'], ['animate', 'Animação']] as const).map(([id, label]) => (
          <Box
            key={id}
            as="button"
            onClick={() => setTab(id)}
            flex={1}
            py={2}
            fontSize="xs"
            fontWeight="semibold"
            color={tab === id ? 'white' : '#918F9F'}
            borderBottom="2px solid"
            borderColor={tab === id ? '#818CF8' : 'transparent'}
            _hover={{ color: 'white' }}
            transition="all 0.15s"
          >
            {label}
          </Box>
        ))}
      </Flex>

      {/* Body Content */}
      <Box p={4} overflowY="auto" flex={1} display="flex" flexDir="column" gap={3}>
        {!activeShape ? (
          <Flex direction="column" align="center" justify="center" py={12} px={4} textAlign="center" gap={3}>
            <Box p={3} bg="#27272A" rounded="full" color="#918F9F">
              <Sliders size={22} />
            </Box>
            <Text fontSize="xs" fontWeight="bold" color="#E5E2E1">
              Nenhum elemento selecionado
            </Text>
            <Text fontSize="11px" color="#918F9F">
              Selecione uma forma no canvas para editar posição, tamanho, cores e animações.
            </Text>
          </Flex>
        ) : tab === 'design' ? (
          <DesignPanel
            shape={activeShape}
            handleChange={handleChange}
            commitChange={commitChange}
            handleAlign={handleAlign}
            ratioLocked={ratioLocked}
            setRatioLocked={setRatioLocked}
          />
        ) : (
          <>
            {/* Section: Animações & Presets */}
            <Box>
              <Flex align="center" justify="space-between" mb={2}>
                <Flex align="center" gap={1.5}>
                  <Sparkles size={12} color="#818CF8" />
                  <Text fontSize="10px" tracking="wider" textTransform="uppercase" fontWeight="bold" color="#A1A1AA">
                    Presets de animação
                  </Text>
                </Flex>
                {useStore.getState().animations[activeShape.id] && (
                  <Box
                    as="button"
                    onClick={() => useStore.getState().clearAnimationForShape(activeShape.id)}
                    fontSize="10px" color="#F87171" _hover={{ textDecoration: 'underline' }}
                  >
                    Limpar
                  </Box>
                )}
              </Flex>

              <PresetGallery shapeId={activeShape.id} hasStroke={activeShape.stroke !== 'transparent' && activeShape.strokeWidth > 0} />
            </Box>

            <Box h="1px" bg="#3F3F464D" />

            {/* Section: Trim do traço */}
            <Box>
              <Text fontSize="10px" tracking="wider" textTransform="uppercase" fontWeight="bold" color="#A1A1AA" mb={1}>
                Trim do traço
              </Text>
              {activeShape.stroke !== 'transparent' && activeShape.strokeWidth > 0 ? (
                <Flex direction="column" gap={2}>
                  <Text fontSize="11px" color="#918F9F" lineHeight="1.5">
                    Mostra só um trecho do contorno. Anime Início/Fim para desenhar ou apagar o traço.
                  </Text>
                  <Flex gap={2}>
                    <NumField label="Início" value={activeShape.trimStart ?? 0} min={0} max={100} suffix="%"
                      onChange={v => handleChange('trimStart', v)} onCommit={commitChange}
                      keyframe={{ shapeId: activeShape.id, property: 'trimStart' }} />
                    <NumField label="Fim" value={activeShape.trimEnd ?? 100} min={0} max={100} suffix="%"
                      onChange={v => handleChange('trimEnd', v)} onCommit={commitChange}
                      keyframe={{ shapeId: activeShape.id, property: 'trimEnd' }} />
                  </Flex>
                  <NumField label="Deslocar" value={activeShape.trimOffset ?? 0} suffix="%"
                    onChange={v => handleChange('trimOffset', v)} onCommit={commitChange}
                    keyframe={{ shapeId: activeShape.id, property: 'trimOffset' }} />
                </Flex>
              ) : (
                <Text fontSize="11px" color="#918F9F">Adicione um contorno (aba Design) para usar o trim.</Text>
              )}
            </Box>

            <Box h="1px" bg="#3F3F464D" />

            {/* Section: Caminho de movimento */}
            <Box>
              <Flex align="center" justify="space-between" mb={1.5}>
                <Text fontSize="10px" tracking="wider" textTransform="uppercase" fontWeight="bold" color="#A1A1AA">
                  Caminho de movimento
                </Text>
                <Box
                  as="button"
                  onClick={toggleMotionPath}
                  w="30px" h="16px" rounded="full" pos="relative"
                  bg={showMotionPath ? '#818CF8' : '#3F3F46'} transition="all 0.15s"
                  aria-label="Mostrar caminho de movimento"
                >
                  <Box pos="absolute" top="2px" left={showMotionPath ? '16px' : '2px'} w="12px" h="12px" rounded="full" bg="white" transition="all 0.15s" />
                </Box>
              </Flex>
              <Text fontSize="11px" color="#918F9F" lineHeight="1.5">
                {animations[activeShape.id]?.x || animations[activeShape.id]?.y
                  ? 'Arraste os pontos no canvas para mudar a trajetória. Arraste o meio de um trecho para curvá-lo. Duplo clique no ponto do trecho reseta a curva.'
                  : 'Anime a posição (X/Y) para ver e editar a trajetória no canvas.'}
              </Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
