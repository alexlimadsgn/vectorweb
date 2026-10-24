import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Box, Flex, Text, Button, Input } from '@chakra-ui/react';
import { Pipette, Check, ChevronDown, Sparkles } from 'lucide-react';
import {
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  rgbToHex,
  isValidHex,
  formatHex,
  HSV
} from '../lib/colorUtils';
import { useStore } from '../store/useStore';

interface CustomColorPickerProps {
  color: string; // Hex string e.g. '#818CF8' or 'transparent'
  onChange: (color: string) => void;
  onCommit?: () => void;
  label?: string;
  allowTransparent?: boolean;
}

const PRESET_PALETTE = [
  '#818CF8', '#6366F1', '#3B82F6', '#06B6D4',
  '#10B981', '#059669', '#F59E0B', '#EF4444',
  '#EC4899', '#A855F7', '#1F2937', '#4B5563',
  '#9CA3AF', '#E5E7EB', '#FFFFFF', '#000000'
];

export default function CustomColorPicker({
  color,
  onChange,
  onCommit,
  label,
  allowTransparent = true
}: CustomColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; right: number }>({ top: 0, right: 16 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const shapes = useStore((state) => state.shapes);

  const togglePicker = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const calculatedTop = rect.top;
      const maxTop = window.innerHeight - 420;
      const top = Math.max(16, Math.min(calculatedTop, maxTop));
      
      // Compute right position: float popover to the left of the Inspector Panel if on right side
      let right = Math.max(16, window.innerWidth - rect.right);
      if (rect.left > 300) {
        right = Math.max(16, window.innerWidth - rect.left + 12);
      }
      setPopoverCoords({ top, right });
    }
    setIsOpen(!isOpen);
  };

  // Extract unique colors used in current canvas
  const canvasColors = Array.from(
    new Set(
      shapes
        .flatMap((s) => [s.fill, s.stroke])
        .filter((c): c is string => !!c && c !== 'transparent')
    )
  ).slice(0, 8);

  const isTransparent = color === 'transparent';
  const effectiveHex = isTransparent ? '#818CF8' : (isValidHex(color) ? formatHex(color) : '#818CF8');

  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(effectiveHex));
  const [hexInput, setHexInput] = useState(() => effectiveHex.replace('#', ''));
  const [isDraggingSatVal, setIsDraggingSatVal] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);

  const satValRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Sync internal state when external color prop changes
  useEffect(() => {
    if (color !== 'transparent' && isValidHex(color)) {
      const formatted = formatHex(color);
      setHsv(hexToHsv(formatted));
      setHexInput(formatted.replace('#', ''));
    }
  }, [color]);

  // Handle Saturation / Value 2D Box Drag
  const updateSatValFromPointer = useCallback((e: PointerEvent | React.PointerEvent) => {
    if (!satValRef.current) return;
    const rect = satValRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);

    const newHsv = { ...hsv, s, v };
    setHsv(newHsv);
    const newHex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
    setHexInput(newHex.replace('#', ''));
    onChange(newHex);
  }, [hsv, onChange]);

  // Handle Hue 1D Slider Drag
  const updateHueFromPointer = useCallback((e: PointerEvent | React.PointerEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const h = Math.round((x / rect.width) * 360);

    const newHsv = { ...hsv, h: Math.min(360, h) };
    setHsv(newHsv);
    const newHex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
    setHexInput(newHex.replace('#', ''));
    onChange(newHex);
  }, [hsv, onChange]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingSatVal) {
        updateSatValFromPointer(e);
      } else if (isDraggingHue) {
        updateHueFromPointer(e);
      }
    };

    const handlePointerUp = () => {
      if (isDraggingSatVal || isDraggingHue) {
        setIsDraggingSatVal(false);
        setIsDraggingHue(false);
        if (onCommit) onCommit();
      }
    };

    if (isDraggingSatVal || isDraggingHue) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingSatVal, isDraggingHue, updateSatValFromPointer, updateHueFromPointer, onCommit]);

  // Eyedropper Tool
  const handleEyeDropper = async () => {
    if ('EyeDropper' in window) {
      try {
        // @ts-ignore
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          const picked = formatHex(result.sRGBHex);
          setHsv(hexToHsv(picked));
          setHexInput(picked.replace('#', ''));
          onChange(picked);
          if (onCommit) onCommit();
        }
      } catch (err) {
        // User cancelled eye dropper
      }
    }
  };

  const handleHexInputChange = (val: string) => {
    const clean = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
    setHexInput(clean);
    if (clean.length === 6 || clean.length === 3) {
      const fullHex = formatHex(clean);
      if (isValidHex(fullHex)) {
        setHsv(hexToHsv(fullHex));
        onChange(fullHex);
      }
    }
  };

  const handleHexInputBlur = () => {
    if (isValidHex('#' + hexInput)) {
      const formatted = formatHex('#' + hexInput);
      setHexInput(formatted.replace('#', ''));
      onChange(formatted);
      if (onCommit) onCommit();
    } else {
      setHexInput(effectiveHex.replace('#', ''));
    }
  };

  const selectColor = (newHex: string) => {
    if (newHex === 'transparent') {
      onChange('transparent');
    } else {
      const formatted = formatHex(newHex);
      setHsv(hexToHsv(formatted));
      setHexInput(formatted.replace('#', ''));
      onChange(formatted);
    }
    if (onCommit) onCommit();
  };

  const currentRgb = hsvToRgb(hsv.h, hsv.s, hsv.v);

  return (
    <Box userSelect="none">
      {/* Trigger Button */}
      <Flex
        ref={triggerRef}
        as="button"
        type="button"
        onClick={togglePicker}
        align="center"
        gap={2}
        px={2}
        py={1}
        bg="#18181B"
        border="1px solid"
        borderColor={isOpen ? '#818CF8' : '#3F3F4680'}
        rounded="md"
        cursor="pointer"
        transition="all 0.15s"
        _hover={{ bg: '#27272A', borderColor: '#818CF880' }}
        h="30px"
      >
        {/* Swatch Preview Square */}
        <Box
          w="18px"
          h="18px"
          rounded="sm"
          shrink={0}
          border="1px solid #FFFFFF33"
          pos="relative"
          overflow="hidden"
          style={{
            background: isTransparent
              ? 'repeating-conic-gradient(#333 0% 25%, #1f1f1f 0% 50%) 50% / 8px 8px'
              : effectiveHex
          }}
        >
          {isTransparent && (
            <Box pos="absolute" inset={0} bg="linear-gradient(45deg, transparent 45%, #F87171 45%, #F87171 55%, transparent 55%)" />
          )}
        </Box>

        <Text fontSize="11px" fontFamily="monospace" fontWeight="semibold" color="#E5E2E1" textTransform="uppercase">
          {isTransparent ? 'TRANSPARENTE' : effectiveHex}
        </Text>

        <ChevronDown size={12} color="#918F9F" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </Flex>

      {/* Popover Card */}
      {isOpen && createPortal(
        <>
          {/* Backdrop overlay */}
          <Box pos="fixed" inset={0} zIndex={99998} onClick={() => { setIsOpen(false); if (onCommit) onCommit(); }} />

          <Box
            pos="fixed"
            top={`${popoverCoords.top}px`}
            right={`${popoverCoords.right}px`}
            w="240px"
            bg="#18181B"
            border="1px solid"
            borderColor="#3F3F4680"
            rounded="md"
            zIndex={99999}
            p={3}
            display="flex"
            flexDir="column"
            gap={3}
            backdropFilter="blur(16px)"
          >
            {/* Top Bar: Title & EyeDropper */}
            <Flex align="center" justify="space-between">
              <Text fontSize="10px" uppercase tracking="wider" fontWeight="bold" color="#918F9F">
                {label || 'Seletor de Cor'}
              </Text>

              <Flex align="center" gap={1}>
                {'EyeDropper' in window && (
                  <Box
                    as="button"
                    type="button"
                    onClick={handleEyeDropper}
                    p={1.5}
                    rounded="md"
                    color="#C7C4D6"
                    bg="#2A2935"
                    _hover={{ bg: '#353445', color: '#818CF8' }}
                    transition="colors"
                    title="Conta-gotas (Capturar cor da tela)"
                  >
                    <Pipette size={13} />
                  </Box>
                )}

                {allowTransparent && (
                  <Box
                    as="button"
                    type="button"
                    onClick={() => selectColor('transparent')}
                    px={2}
                    py={1}
                    rounded="md"
                    fontSize="10px"
                    fontWeight="bold"
                    bg={isTransparent ? '#F8717133' : '#2A2935'}
                    color={isTransparent ? '#F87171' : '#C7C4D6'}
                    border="1px solid"
                    borderColor={isTransparent ? '#F8717166' : 'transparent'}
                    _hover={{ bg: '#353445' }}
                    transition="colors"
                  >
                    Transparente
                  </Box>
                )}
              </Flex>
            </Flex>

            {/* 2D Saturation / Value Box */}
            <Box
              ref={satValRef}
              onPointerDown={(e) => {
                setIsDraggingSatVal(true);
                updateSatValFromPointer(e);
              }}
              pos="relative"
              w="full"
              h="120px"
              rounded="md"
              overflow="hidden"
              cursor="crosshair"
              style={{
                backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)'
              }}
            >
              {/* Handle Indicator Handle */}
              <Box
                pos="absolute"
                w="14px"
                h="14px"
                rounded="full"
                border="2px solid #FFFFFF"
                pointerEvents="none"
                style={{
                  left: `${hsv.s}%`,
                  top: `${100 - hsv.v}%`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: hsvToHex(hsv.h, hsv.s, hsv.v)
                }}
              />
            </Box>

            {/* Hue Slider Bar */}
            <Box
              ref={hueRef}
              onPointerDown={(e) => {
                setIsDraggingHue(true);
                updateHueFromPointer(e);
              }}
              pos="relative"
              w="full"
              h="12px"
              rounded="full"
              cursor="pointer"
              style={{
                background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
              }}
            >
              {/* Slider Handle */}
              <Box
                pos="absolute"
                top="50%"
                w="14px"
                h="14px"
                rounded="full"
                bg="#FFFFFF"
                border="2px solid #18171C"
                pointerEvents="none"
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            </Box>

            {/* HEX & RGB Inputs Row */}
            <Flex align="center" gap={1.5}>
              <Flex flex={1} align="center" bg="#27272A" border="1px solid" borderColor="#3F3F4680" rounded="md" px={2} h="28px" gap={1} _focusWithin={{ borderColor: '#818CF8', boxShadow: '0 0 0 1px #818CF8' }} transition="all 0.15s">
                <Text fontSize="10px" color="#818CF8" fontWeight="bold">#</Text>
                <Input
                  size="xs"
                  type="text"
                  value={hexInput}
                  onChange={(e) => handleHexInputChange(e.target.value)}
                  onBlur={handleHexInputBlur}
                  bg="transparent"
                  border="none"
                  p={0}
                  h="full"
                  fontSize="11px"
                  color="#E5E2E1"
                  fontFamily="monospace"
                  textTransform="uppercase"
                  _focus={{ outline: 'none', boxShadow: 'none' }}
                />
              </Flex>

              <Flex w="110px" align="center" justify="space-around" bg="#27272A" border="1px solid" borderColor="#3F3F4680" rounded="md" px={1.5} h="28px" fontSize="10px" fontFamily="monospace" color="#918F9F">
                <Text><span style={{ color: '#F87171' }}>R</span>{currentRgb.r}</Text>
                <Text><span style={{ color: '#4ADE80' }}>G</span>{currentRgb.g}</Text>
                <Text><span style={{ color: '#60A5FA' }}>B</span>{currentRgb.b}</Text>
              </Flex>
            </Flex>

            {/* Canvas Used Colors */}
            {canvasColors.length > 0 && (
              <Box>
                <Text fontSize="9px" uppercase tracking="wider" fontWeight="bold" color="#918F9F" mb={1}>
                  Cores do Canvas
                </Text>
                <Flex align="center" gap={1.5} flexWrap="wrap">
                  {canvasColors.map((c) => (
                    <Box
                      key={c}
                      as="button"
                      type="button"
                      onClick={() => selectColor(c)}
                      w="20px"
                      h="20px"
                      rounded="md"
                      bg={c}
                      border="1px solid"
                      borderColor={effectiveHex === formatHex(c) ? '#818CF8' : '#FFFFFF20'}
                      boxShadow={effectiveHex === formatHex(c) ? '0 0 6px #818CF8' : 'none'}
                      transition="transform 0.15s"
                      _hover={{ transform: 'scale(1.15)' }}
                      title={c}
                    />
                  ))}
                </Flex>
              </Box>
            )}

            {/* Standard Preset Swatches Palette */}
            <Box>
              <Text fontSize="9px" uppercase tracking="wider" fontWeight="bold" color="#918F9F" mb={1}>
                Paleta Padrão
              </Text>
              <Flex align="center" gap={1.5} flexWrap="wrap">
                {PRESET_PALETTE.map((c, idx) => (
                  <Box
                    key={`${c}-${idx}`}
                    as="button"
                    type="button"
                    onClick={() => selectColor(c)}
                    w="18px"
                    h="18px"
                    rounded="md"
                    bg={c}
                    border="1px solid"
                    borderColor={effectiveHex === formatHex(c) ? '#818CF8' : '#FFFFFF20'}
                    boxShadow={effectiveHex === formatHex(c) ? '0 0 6px #818CF8' : 'none'}
                    transition="transform 0.15s"
                    _hover={{ transform: 'scale(1.2)' }}
                    title={c}
                  />
                ))}
              </Flex>
            </Box>
          </Box>
        </>,
        document.body
      )}
    </Box>
  );
}
