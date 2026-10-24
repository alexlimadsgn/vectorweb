import React, { useState } from 'react';
import { Box, Flex, Text, Badge, Grid, Slider, Input, Button, Portal } from '@chakra-ui/react';
import { useStore } from '../store/useStore';
import { AnimatableProperty } from '../types';
import { getAnimatedShape } from '../lib/animationUtils';
import { Sliders, RotateCcw, Lock, Unlock, Sparkles, Check, ChevronDown, Trash2 } from 'lucide-react';
import CustomColorPicker from './CustomColorPicker';
import PresetGallery from './PresetGallery';

const anchors = [
  { value: 'top-left', label: 'Superior Esquerdo' },
  { value: 'top-middle', label: 'Superior Centro' },
  { value: 'top-right', label: 'Superior Direito' },
  { value: 'middle-left', label: 'Meio Esquerdo' },
  { value: 'middle', label: 'Centro' },
  { value: 'middle-right', label: 'Meio Direito' },
  { value: 'bottom-left', label: 'Inferior Esquerdo' },
  { value: 'bottom-middle', label: 'Inferior Centro' },
  { value: 'bottom-right', label: 'Inferior Direito' },
];

const renderAnchorGridIcon = (anchorValue: string) => {
  let activeCol = 1; // 0, 1, 2
  let activeRow = 1; // 0, 1, 2

  const val = (anchorValue || 'middle').toLowerCase();
  if (val.includes('left')) activeCol = 0;
  else if (val.includes('right')) activeCol = 2;
  else activeCol = 1;

  if (val.includes('top')) activeRow = 0;
  else if (val.includes('bottom')) activeRow = 2;
  else activeRow = 1;

  const positions = [0, 4.5, 9];
  
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {[0, 1, 2].map(r => 
        [0, 1, 2].map(c => {
          const isActive = r === activeRow && c === activeCol;
          return (
            <rect 
              key={`${r}-${c}`}
              x={positions[c]} 
              y={positions[r]} 
              width="3" 
              height="3" 
              rx="0.5" 
              fill={isActive ? '#818CF8' : '#C7C4D6'} 
              opacity={isActive ? 1 : 0.4}
            />
          );
        })
      )}
    </svg>
  );
};

const KeyframeButton = ({
  shapeId,
  property,
  value,
  isSplit = true,
}: {
  shapeId: string;
  property: AnimatableProperty;
  value: any;
  isSplit?: boolean;
}) => {
  const animations = useStore((s) => s.animations);
  const currentTime = useStore((s) => s.currentTime);
  const addOrUpdateKeyframe = useStore((s) => s.addOrUpdateKeyframe);
  const deleteKeyframe = useStore((s) => s.deleteKeyframe);
  const shapeAnims = animations[shapeId];
  const propKfs = shapeAnims ? shapeAnims[property] : undefined;
  const currentKf = propKfs ? propKfs.find(k => Math.abs(k.time - currentTime) < 0.05) : undefined;
  const isKeyframedAtCurrentTime = !!currentKf;
  const hasAnimation = !!(propKfs && propKfs.length > 0);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isKeyframedAtCurrentTime && currentKf) {
      deleteKeyframe(shapeId, property, currentKf.id);
    } else {
      addOrUpdateKeyframe(shapeId, property, currentTime, value);
    }
  };

  return (
    <Box
      as="button"
      type="button"
      onClick={handleToggle}
      w="28px"
      h="28px"
      rounded={isSplit ? 'none' : 'md'}
      roundedRight="md"
      display="flex"
      alignItems="center"
      justifyContent="center"
      transition="all 0.15s"
      shrink={0}
      bg={
        isKeyframedAtCurrentTime
          ? '#F59E0B33'
          : hasAnimation
          ? '#818CF833'
          : '#27272A'
      }
      color={
        isKeyframedAtCurrentTime
          ? '#FBBF24'
          : hasAnimation
          ? '#818CF8'
          : '#918F9F'
      }
      border="1px solid"
      borderLeft={isSplit ? '1px solid #3F3F464D' : undefined}
      borderColor={
        isKeyframedAtCurrentTime
          ? '#F59E0B99'
          : hasAnimation
          ? '#818CF866'
          : '#3F3F4680'
      }
      _hover={{
        bg: isKeyframedAtCurrentTime
          ? '#F59E0B4D'
          : hasAnimation
          ? '#818CF84D'
          : '#323238',
        color: isKeyframedAtCurrentTime ? '#FBBF24' : hasAnimation ? '#818CF8' : '#E5E2E1',
      }}
      title={
        isKeyframedAtCurrentTime
          ? `Remover Keyframe em ${currentTime.toFixed(2)}s`
          : `Adicionar Keyframe em ${currentTime.toFixed(2)}s`
      }
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill={isKeyframedAtCurrentTime ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 3 21 12 12 21 3 12" />
      </svg>
    </Box>
  );
};

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
  const [anchorMenuOpen, setAnchorMenuOpen] = useState(false);
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
          <>
            <Flex align="center" justify="space-between" mt={-1}>
              <Text fontSize="xs" fontWeight="semibold" color="#E5E2E1" truncate>
                {activeShape.name || (activeShape.type === 'rectangle' ? 'Retângulo' : activeShape.type === 'ellipse' ? 'Elipse' : activeShape.type === 'path' ? 'Caminho' : activeShape.type === 'group' ? 'Grupo' : activeShape.type === 'frame' ? 'Frame' : activeShape.type)}
              </Text>
            </Flex>
            {/* Section: Transformação */}
            <Box>
              <Text fontSize="10px" letterSpacing="wider" textTransform="uppercase" fontWeight="bold" color="#A1A1AA" mb={2}>
                Transformação
              </Text>

              <Flex direction="column" gap={2}>
                {/* Alignment bar */}
                <Flex align="center" justify="space-between" bg="#27272A55" p={1.5} rounded="lg" border="1px solid" borderColor="#3F3F464D">
                  <Box
                    as="button"
                    onClick={() => { handleChange('rotation', 0); commitChange(); }}
                    p={1} rounded="sm" color="#C7C4D6" _hover={{ bg: '#27272A', color: 'white' }}
                    title="Resetar Rotação"
                  >
                    <RotateCcw size={14} />
                  </Box>

                  <Box w="1px" h="12px" bg="#3F3F4680" />

                  <Box
                    as="button"
                    onClick={() => handleAlign('left')}
                    disabled={selectedIds.length < 2}
                    p={1} rounded="sm" color="#C7C4D6" opacity={selectedIds.length < 2 ? 0.4 : 1}
                    _hover={{ bg: selectedIds.length >= 2 ? '#27272A' : 'transparent', color: 'white' }}
                    title="Alinhar à Esquerda"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="9" height="6" x="6" y="14" rx="2" />
                      <rect width="16" height="6" x="6" y="4" rx="2" />
                      <path d="M2 2v20" />
                    </svg>
                  </Box>

                  <Box
                    as="button"
                    onClick={() => handleAlign('center')}
                    disabled={selectedIds.length < 2}
                    p={1} rounded="sm" color="#C7C4D6" opacity={selectedIds.length < 2 ? 0.4 : 1}
                    _hover={{ bg: selectedIds.length >= 2 ? '#27272A' : 'transparent', color: 'white' }}
                    title="Alinhar ao Centro Horizontal"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
                      <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
                      <path d="M4 12H2" />
                      <path d="M10 12H8" />
                      <path d="M16 12h-2" />
                      <path d="M22 12h-2" />
                    </svg>
                  </Box>

                  <Box
                    as="button"
                    onClick={() => handleAlign('right')}
                    disabled={selectedIds.length < 2}
                    p={1} rounded="sm" color="#C7C4D6" opacity={selectedIds.length < 2 ? 0.4 : 1}
                    _hover={{ bg: selectedIds.length >= 2 ? '#27272A' : 'transparent', color: 'white' }}
                    title="Alinhar à Direita"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="16" height="6" x="2" y="4" rx="2" />
                      <rect width="9" height="6" x="9" y="14" rx="2" />
                      <path d="M22 22V2" />
                    </svg>
                  </Box>

                  <Box w="1px" h="12px" bg="#3F3F4680" />

                  <Box
                    as="button"
                    onClick={() => handleAlign('top')}
                    disabled={selectedIds.length < 2}
                    p={1} rounded="sm" color="#C7C4D6" opacity={selectedIds.length < 2 ? 0.4 : 1}
                    _hover={{ bg: selectedIds.length >= 2 ? '#27272A' : 'transparent', color: 'white' }}
                    title="Alinhar ao Topo"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 2h20" />
                      <rect width="6" height="16" x="4" y="6" rx="2" />
                      <rect width="6" height="9" x="14" y="6" rx="2" />
                    </svg>
                  </Box>

                  <Box
                    as="button"
                    onClick={() => handleAlign('middle')}
                    disabled={selectedIds.length < 2}
                    p={1} rounded="sm" color="#C7C4D6" opacity={selectedIds.length < 2 ? 0.4 : 1}
                    _hover={{ bg: selectedIds.length >= 2 ? '#27272A' : 'transparent', color: 'white' }}
                    title="Alinhar ao Centro Vertical"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" />
                      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
                      <path d="M12 20v2" />
                      <path d="M12 14v2" />
                      <path d="M12 8v2" />
                      <path d="M12 2v2" />
                    </svg>
                  </Box>

                  <Box
                    as="button"
                    onClick={() => handleAlign('bottom')}
                    disabled={selectedIds.length < 2}
                    p={1} rounded="sm" color="#C7C4D6" opacity={selectedIds.length < 2 ? 0.4 : 1}
                    _hover={{ bg: selectedIds.length >= 2 ? '#27272A' : 'transparent', color: 'white' }}
                    title="Alinhar à Base"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 22h20" />
                      <rect width="6" height="16" x="4" y="2" rx="2" />
                      <rect width="6" height="9" x="14" y="9" rx="2" />
                    </svg>
                  </Box>
                </Flex>

                {/* Anchor Selection */}
                <Flex align="center" justify="space-between" gap={2} pos="relative" style={{ position: 'relative' }}>
                  <Flex
                    onClick={() => {
                      if (!activeShape.editAnchorManual) {
                        setAnchorMenuOpen(!anchorMenuOpen);
                      }
                    }}
                    flex={1} align="center" justify="space-between" rounded="md" py={1} px={2.5} bg="#27272A" border="1px solid" borderColor="#3F3F4680" cursor={activeShape.editAnchorManual ? 'not-allowed' : 'pointer'} opacity={activeShape.editAnchorManual ? 0.4 : 1} _hover={{ bg: activeShape.editAnchorManual ? '#27272A' : '#323238' }} h="28px" transition="colors"
                  >
                    <Flex align="center" gap={2}>
                      {renderAnchorGridIcon(activeShape.anchor || 'middle')}
                      <Text fontSize="11px" color="#E5E2E1" leading="none">
                        {activeShape.editAnchorManual ? 'Âncora: Manual' : `Âncora: ${anchors.find(a => a.value === (activeShape.anchor || 'middle'))?.label || 'Centro'}`}
                      </Text>
                    </Flex>
                    <ChevronDown size={12} color="#C7C4D6" style={{ transform: anchorMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </Flex>

                  <Flex
                    as="button"
                    onClick={() => {
                      const newValue = !activeShape.editAnchorManual;
                      handleChange('editAnchorManual', newValue);
                      commitChange();
                    }}
                    rounded="md" align="center" justify="center" w="28px" h="28px" shrink={0} transition="colors" border="1px solid"
                    bg={activeShape.editAnchorManual ? '#818CF833' : '#27272A'}
                    color={activeShape.editAnchorManual ? '#818CF8' : '#C7C4D6'}
                    borderColor={activeShape.editAnchorManual ? '#818CF866' : '#3F3F4680'}
                    _hover={{ bg: activeShape.editAnchorManual ? '#818CF84D' : '#323238', color: 'white' }}
                    title="Ajuste Manual da Âncora"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" fill="currentColor" />
                    </svg>
                  </Flex>

                  {/* Anchor Dropdown */}
                  {anchorMenuOpen && (
                    <>
                      <Portal>
                        <Box pos="fixed" inset={0} zIndex={40} onClick={() => setAnchorMenuOpen(false)} />
                      </Portal>
                      <Box pos="absolute" top="100%" left={0} right={0} mt={1.5} p={1} bg="#18181B" border="1px solid" borderColor="#3F3F46" rounded="md" zIndex={50} display="flex" flexDir="column" gap={0.5} maxH="220px" overflowY="auto" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50 }}>
                        {anchors.map(option => {
                          const isSelected = (activeShape.anchor || 'middle') === option.value;
                          return (
                            <Box
                              key={option.value}
                              as="button"
                              onClick={() => {
                                handleChange('anchor', option.value);
                                commitChange();
                                setAnchorMenuOpen(false);
                              }}
                              display="flex" align="center" justify="space-between" w="full" px={2.5} py={1.5} textAlign="left" fontSize="xs" rounded="md" transition="colors"
                              bg={isSelected ? '#27272A' : 'transparent'}
                              color={isSelected ? 'white' : '#C7C4D6'}
                              fontWeight={isSelected ? 'medium' : 'normal'}
                              _hover={{ bg: '#27272A', color: 'white' }}
                            >
                              <Flex align="center" gap={2.5}>
                                {renderAnchorGridIcon(option.value)}
                                <Text fontSize="11px">{option.label}</Text>
                              </Flex>
                              {isSelected && <Check size={12} color="#818CF8" />}
                            </Box>
                          );
                        })}
                      </Box>
                    </>
                  )}
                </Flex>

                {/* X, Y Position row */}
                <Flex gap={2} align="center">
                  {/* X input */}
                  <Flex flex={1} align="center">
                    <Flex flex={1} align="center" roundedLeft="md" py={0.5} px={2} h="28px" bg="#27272A" border="1px solid" borderColor="#3F3F4680" borderRight="none" gap={1.5} _focusWithin={{ borderColor: '#818CF8', zIndex: 1 }} transition="all 0.15s">
                      <Text fontSize="10px" color="#A1A1AA" fontWeight="bold" userSelect="none">X</Text>
                      <Input
                        size="xs"
                        type="number"
                        value={Math.round(activeShape.x)}
                        onChange={(e) => handleChange('x', Number(e.target.value))}
                        onBlur={commitChange}
                        bg="transparent"
                        border="none"
                        p={0}
                        h="full"
                        fontSize="11px"
                        color="#E5E2E1"
                        _focus={{ outline: 'none', boxShadow: 'none' }}
                        minW={0}
                      />
                    </Flex>
                    <KeyframeButton shapeId={activeShape.id} property="x" value={activeShape.x} isSplit />
                  </Flex>

                  {/* Y input */}
                  <Flex flex={1} align="center">
                    <Flex flex={1} align="center" roundedLeft="md" py={0.5} px={2} h="28px" bg="#27272A" border="1px solid" borderColor="#3F3F4680" borderRight="none" gap={1.5} _focusWithin={{ borderColor: '#818CF8', zIndex: 1 }} transition="all 0.15s">
                      <Text fontSize="10px" color="#A1A1AA" fontWeight="bold" userSelect="none">Y</Text>
                      <Input
                        size="xs"
                        type="number"
                        value={Math.round(activeShape.y)}
                        onChange={(e) => handleChange('y', Number(e.target.value))}
                        onBlur={commitChange}
                        bg="transparent"
                        border="none"
                        p={0}
                        h="full"
                        fontSize="11px"
                        color="#E5E2E1"
                        _focus={{ outline: 'none', boxShadow: 'none' }}
                        minW={0}
                      />
                    </Flex>
                    <KeyframeButton shapeId={activeShape.id} property="y" value={activeShape.y} isSplit />
                  </Flex>

                  {/* Invisible 28px spacer to align X and Y with W and H + ratio lock */}
                  <Box w="28px" h="28px" shrink={0} />
                </Flex>

                {/* W, H Size row + Ratio lock */}
                <Flex gap={2} align="center">
                  {/* W input */}
                  <Flex flex={1} align="center">
                    <Flex flex={1} align="center" roundedLeft="md" py={0.5} px={2} h="28px" bg="#27272A" border="1px solid" borderColor="#3F3F4680" borderRight="none" gap={1.5} _focusWithin={{ borderColor: '#818CF8', zIndex: 1 }} transition="all 0.15s">
                      <Text fontSize="10px" color="#A1A1AA" fontWeight="bold" userSelect="none">W</Text>
                      <Input
                        size="xs"
                        type="number"
                        value={Math.round(activeShape.width)}
                        onChange={(e) => handleChange('width', Number(e.target.value))}
                        onBlur={commitChange}
                        bg="transparent"
                        border="none"
                        p={0}
                        h="full"
                        fontSize="11px"
                        color="#E5E2E1"
                        _focus={{ outline: 'none', boxShadow: 'none' }}
                        minW={0}
                      />
                    </Flex>
                    <KeyframeButton shapeId={activeShape.id} property="width" value={activeShape.width} isSplit />
                  </Flex>

                  {/* H input */}
                  <Flex flex={1} align="center">
                    <Flex flex={1} align="center" roundedLeft="md" py={0.5} px={2} h="28px" bg="#27272A" border="1px solid" borderColor="#3F3F4680" borderRight="none" gap={1.5} _focusWithin={{ borderColor: '#818CF8', zIndex: 1 }} transition="all 0.15s">
                      <Text fontSize="10px" color="#A1A1AA" fontWeight="bold" userSelect="none">H</Text>
                      <Input
                        size="xs"
                        type="number"
                        value={Math.round(activeShape.height)}
                        onChange={(e) => handleChange('height', Number(e.target.value))}
                        onBlur={commitChange}
                        bg="transparent"
                        border="none"
                        p={0}
                        h="full"
                        fontSize="11px"
                        color="#E5E2E1"
                        _focus={{ outline: 'none', boxShadow: 'none' }}
                        minW={0}
                      />
                    </Flex>
                    <KeyframeButton shapeId={activeShape.id} property="height" value={activeShape.height} isSplit />
                  </Flex>

                  {/* Ratio Lock Button */}
                  <Flex
                    as="button"
                    onClick={() => setRatioLocked(!ratioLocked)}
                    w="28px" h="28px" shrink={0} rounded="md"
                    align="center" justify="center"
                    bg={ratioLocked ? '#818CF833' : '#27272A'}
                    color={ratioLocked ? '#818CF8' : '#C7C4D6'}
                    border="1px solid"
                    borderColor={ratioLocked ? '#818CF866' : '#3F3F4680'}
                    _hover={{ bg: ratioLocked ? '#818CF84D' : '#323238', color: 'white' }}
                    transition="colors"
                    title={ratioLocked ? 'Proporção Bloqueada' : 'Bloquear Proporção'}
                  >
                    {ratioLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  </Flex>
                </Flex>

                {/* Radius (if rectangle) & Rotation row */}
                <Flex gap={2} align="center">
                  {/* Corner Radius (Rectangle) */}
                  {activeShape.type === 'rectangle' && (
                    <Flex flex={1} align="center">
                      <Flex flex={1} align="center" roundedLeft="md" py={0.5} px={2} h="28px" bg="#27272A" border="1px solid" borderColor="#3F3F4680" borderRight="none" gap={1.5} _focusWithin={{ borderColor: '#818CF8', zIndex: 1 }} transition="all 0.15s">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10" />
                          <circle cx="12" cy="12" r="3" fill="currentColor" />
                        </svg>
                        <Input
                          size="xs"
                          type="number"
                          min="0"
                          max={Math.min(activeShape.width || 0, activeShape.height || 0) / 2}
                          value={activeShape.radius || 0}
                          onChange={(e) => handleChange('radius', Math.max(0, Number(e.target.value)))}
                          onBlur={commitChange}
                          bg="transparent"
                          border="none"
                          p={0}
                          h="full"
                          fontSize="11px"
                          color="#E5E2E1"
                          _focus={{ outline: 'none', boxShadow: 'none' }}
                          minW={0}
                        />
                      </Flex>
                      <KeyframeButton shapeId={activeShape.id} property="radius" value={activeShape.radius || 0} isSplit />
                    </Flex>
                  )}

                  {/* Rotation */}
                  <Flex flex={1} align="center">
                    <Flex flex={1} align="center" roundedLeft="md" px={2} h="28px" bg="#27272A" border="1px solid" borderColor="#3F3F4680" borderRight="none" gap={1} _focusWithin={{ borderColor: '#818CF8', zIndex: 1 }} transition="all 0.15s">
                      <Input
                        size="xs"
                        type="number"
                        value={Math.round(activeShape.rotation)}
                        onChange={(e) => handleChange('rotation', Number(e.target.value))}
                        onBlur={commitChange}
                        bg="transparent"
                        border="none"
                        p={0}
                        h="full"
                        fontSize="11px"
                        color="#E5E2E1"
                        _focus={{ outline: 'none', boxShadow: 'none' }}
                        minW={0}
                      />
                      <Text fontSize="10px" color="#918F9F">°</Text>
                    </Flex>
                    <KeyframeButton shapeId={activeShape.id} property="rotation" value={activeShape.rotation || 0} isSplit />
                  </Flex>

                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => { handleChange('rotation', 0); commitChange(); }}
                    minW="28px" h="28px" p={0} rounded="md" color="#C7C4D6" _hover={{ bg: '#27272A', color: 'white' }} transition="colors" shrink={0}
                    title="Resetar Rotação"
                  >
                    <RotateCcw size={14} />
                  </Button>
                </Flex>
              </Flex>
            </Box>

            <Box h="1px" bg="#3F3F464D" my={2.5} />

            {/* Section: Preenchimento */}
            <Box>
              <Flex align="center" justify="space-between" mb={2}>
                <Text fontSize="10px" tracking="wider" textTransform="uppercase" fontWeight="bold" color="#A1A1AA">
                  Preenchimento
                </Text>
                {activeShape.fill === 'transparent' ? (
                  <Box
                    as="button"
                    onClick={() => { handleChange('fill', '#818CF8'); commitChange(); }}
                    color="#C7C4D6" p={0.5} px={1.5} rounded="sm" bg="#27272A" _hover={{ bg: '#323238', color: 'white' }} transition="colors" fontSize="11px"
                    title="Adicionar cor de preenchimento"
                  >
                    +
                  </Box>
                ) : (
                  <Box
                    as="button"
                    onClick={() => { handleChange('fill', 'transparent'); commitChange(); }}
                    color="#C7C4D6" p={0.5} px={1.5} rounded="sm" bg="#27272A" _hover={{ bg: '#323238', color: 'white' }} transition="colors" fontSize="11px"
                    title="Remover preenchimento (transparente)"
                  >
                    -
                  </Box>
                )}
              </Flex>

              <Flex align="center" justify="space-between" gap={2}>
                <CustomColorPicker
                  color={activeShape.fill}
                  label="Cor de Preenchimento"
                  onChange={(val) => handleChange('fill', val)}
                  onCommit={commitChange}
                />
                <KeyframeButton shapeId={activeShape.id} property="fill" value={activeShape.fill} isSplit={false} />
              </Flex>
            </Box>

            <Box h="1px" bg="#3F3F464D" my={2.5} />

            {/* Section: Contorno */}
            <Box>
              <Flex align="center" justify="space-between" mb={2}>
                <Text fontSize="10px" tracking="wider" textTransform="uppercase" fontWeight="bold" color="#A1A1AA">
                  Contorno
                </Text>
                {activeShape.stroke === 'transparent' || activeShape.strokeWidth === 0 ? (
                  <Box
                    as="button"
                    onClick={() => { 
                      selectedIds.forEach(id => {
                        updateShape(id, { stroke: '#818CF8', strokeWidth: 2 });
                      });
                      commitChange(); 
                    }}
                    color="#C7C4D6" p={0.5} px={1.5} rounded="sm" bg="#27272A" _hover={{ bg: '#323238', color: 'white' }} transition="colors" fontSize="11px"
                    title="Adicionar contorno"
                  >
                    +
                  </Box>
                ) : (
                  <Box
                    as="button"
                    onClick={() => { 
                      selectedIds.forEach(id => {
                        updateShape(id, { stroke: 'transparent', strokeWidth: 0 });
                      });
                      commitChange(); 
                    }}
                    color="#C7C4D6" p={0.5} px={1.5} rounded="sm" bg="#27272A" _hover={{ bg: '#323238', color: 'white' }} transition="colors" fontSize="11px"
                    title="Remover contorno"
                  >
                    -
                  </Box>
                )}
              </Flex>

              {activeShape.stroke !== 'transparent' && activeShape.strokeWidth > 0 ? (
                <Flex align="center" justify="space-between" gap={2}>
                  <CustomColorPicker
                    color={activeShape.stroke}
                    label="Cor do Contorno"
                    onChange={(val) => handleChange('stroke', val)}
                    onCommit={commitChange}
                  />

                  <Flex w="70px" align="center" rounded="md" px={2} h="30px" bg="#27272A" border="1px solid" borderColor="#3F3F4680" gap={1} _focusWithin={{ borderColor: '#818CF8', boxShadow: '0 0 0 1px #818CF8' }} transition="all 0.15s">
                    <Text fontSize="10px" color="#918F9F">px</Text>
                    <Input
                      size="xs"
                      type="number"
                      value={activeShape.strokeWidth}
                      onChange={(e) => handleChange('strokeWidth', Math.max(0, Number(e.target.value)))}
                      onBlur={commitChange}
                      bg="transparent"
                      border="none"
                      p={0}
                      h="full"
                      fontSize="11px"
                      color="#E5E2E1"
                      _focus={{ outline: 'none', boxShadow: 'none' }}
                      minW={0}
                      title="Espessura da linha"
                    />
                  </Flex>
                </Flex>
              ) : (
                <Text fontSize="11px" color="#918F9F" fontStyle="italic">Sem Contorno</Text>
              )}
            </Box>

            <Box h="1px" bg="#3F3F464D" my={2.5} />

            {/* Section: Opacidade */}
            <Box>
              <Flex align="center" justify="space-between" mb={2}>
                <Text fontSize="10px" tracking="wider" textTransform="uppercase" fontWeight="bold" color="#A1A1AA">
                  Opacidade
                </Text>
              </Flex>

              <Flex align="center" justify="space-between" gap={2.5}>
                <Slider.Root
                  flex={1}
                  value={[Math.round((activeShape.opacity ?? 1) * 100)]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(details) => handleChange('opacity', details.value[0] / 100)}
                  onValueChangeEnd={commitChange}
                >
                  <Slider.Control cursor="pointer" h="20px" display="flex" alignItems="center">
                    <Slider.Track bg="#27272A" h="4px" rounded="full" flex={1}>
                      <Slider.Range bg="#818CF8" />
                    </Slider.Track>
                    <Slider.Thumbs>
                      <Slider.Thumb index={0} boxSize="14px" bg="#818CF8" border="2px solid #FFFFFF" rounded="full" />
                    </Slider.Thumbs>
                  </Slider.Control>
                </Slider.Root>
                <Text fontSize="11px" fontFamily="mono" color="#C7C4D6" w="36px" textAlign="right">
                  {Math.round(activeShape.opacity * 100)}%
                </Text>
                <KeyframeButton shapeId={activeShape.id} property="opacity" value={activeShape.opacity} isSplit={false} />
              </Flex>
            </Box>

          </>
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

              <PresetGallery shapeId={activeShape.id} />
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
