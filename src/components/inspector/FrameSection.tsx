import React, { useEffect, useRef, useState } from 'react';
import { Box, Flex, Text, Portal } from '@chakra-ui/react';
import { RectangleHorizontal, RectangleVertical, ChevronDown, Check } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { BaseShape } from '../../types';
import { Section, IconButton } from './fields';

export const FRAME_PRESETS: { group: string; items: { name: string; w: number; h: number }[] }[] = [
  {
    group: 'Redes sociais',
    items: [
      { name: 'Instagram Post', w: 1080, h: 1080 },
      { name: 'Instagram Retrato', w: 1080, h: 1350 },
      { name: 'Instagram Story / Reels', w: 1080, h: 1920 },
      { name: 'TikTok', w: 1080, h: 1920 },
      { name: 'YouTube Shorts', w: 1080, h: 1920 },
      { name: 'YouTube Vídeo', w: 1920, h: 1080 },
      { name: 'YouTube Thumbnail', w: 1280, h: 720 },
      { name: 'X / Twitter Post', w: 1600, h: 900 },
      { name: 'LinkedIn Post', w: 1200, h: 1200 },
      { name: 'Facebook Post', w: 1200, h: 630 },
    ],
  },
  {
    group: 'Telas',
    items: [
      { name: 'iPhone 16', w: 393, h: 852 },
      { name: 'iPhone 16 Pro Max', w: 440, h: 956 },
      { name: 'Android', w: 412, h: 915 },
      { name: 'iPad', w: 820, h: 1180 },
      { name: 'Desktop', w: 1440, h: 1024 },
      { name: 'MacBook Air', w: 1280, h: 832 },
    ],
  },
  {
    group: 'Vídeo e apresentação',
    items: [
      { name: 'HD 720p', w: 1280, h: 720 },
      { name: 'Full HD 1080p', w: 1920, h: 1080 },
      { name: '4K', w: 3840, h: 2160 },
      { name: 'Slide 16:9', w: 1920, h: 1080 },
      { name: 'Slide 4:3', w: 1024, h: 768 },
    ],
  },
  {
    group: 'Impressão',
    items: [
      { name: 'A4', w: 595, h: 842 },
      { name: 'Carta (Letter)', w: 612, h: 792 },
    ],
  },
];

type FramePreset = { name: string; w: number; h: number };

/** Tiny box with the preset's aspect ratio. */
const AspectGlyph = ({ w, h, active }: { w: number; h: number; active?: boolean }) => {
  const max = 14;
  const bw = w >= h ? max : Math.max(5, (w / h) * max);
  const bh = h >= w ? max : Math.max(5, (h / w) * max);
  return (
    <Flex w="16px" h="16px" align="center" justify="center" flexShrink={0}>
      <Box w={`${bw}px`} h={`${bh}px`} border="1.5px solid" borderColor={active ? '#A5B4FC' : '#71717A'} rounded="2px" />
    </Flex>
  );
};

/** Custom dropdown with the frame size presets, grouped by category. */
function FramePresetPicker({ current, width, height, onPick }: {
  current?: FramePreset;
  width: number;
  height: number;
  onPick: (p: FramePreset) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = () => {
    setRect(btnRef.current?.getBoundingClientRect() || null);
    setOpen(o => !o);
  };

  // Open upwards when there isn't room below
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
  const maxH = Math.min(380, Math.max(spaceBelow, rect ? rect.top : 0) - 16);
  const placeBelow = rect ? spaceBelow >= 260 || spaceBelow >= rect.top : true;

  return (
    <>
      <Flex
        as="button"
        type="button"
        ref={btnRef}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Tamanho predefinido"
        w="full"
        h="30px"
        px={2}
        gap={2}
        align="center"
        bg={open ? '#323238' : '#27272A'}
        border="1px solid"
        borderColor={open ? '#818CF8' : '#3F3F4680'}
        rounded="md"
        _hover={{ bg: '#323238' }}
        transition="all 0.15s"
      >
        <AspectGlyph w={width} h={height} />
        <Text flex={1} textAlign="left" fontSize="11px" color="#E5E2E1" truncate>
          {current ? current.name : 'Personalizado'}
        </Text>
        <Text fontSize="10px" color="#8B8A97" fontFamily="mono">{width}×{height}</Text>
        <ChevronDown size={13} color="#A1A1AA" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </Flex>

      {open && rect && (
        <Portal>
          <Box pos="fixed" inset={0} zIndex={1000} onClick={() => setOpen(false)} />
          <Box
            role="listbox"
            pos="fixed"
            zIndex={1001}
            bg="#18181B"
            border="1px solid #3F3F46"
            rounded="lg"
            boxShadow="0 12px 32px rgba(0,0,0,0.6)"
            py={1}
            overflowY="auto"
            style={{
              left: rect.left,
              width: rect.width,
              maxHeight: maxH,
              ...(placeBelow ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
            }}
          >
            {FRAME_PRESETS.map(g => (
              <Box key={g.group} pb={1}>
                <Text px={3} pt={2} pb={1} fontSize="10px" fontWeight="semibold" color="#8B8A97" textTransform="uppercase" letterSpacing="wider">
                  {g.group}
                </Text>
                {g.items.map(p => {
                  const active = current?.name === p.name;
                  return (
                    <Flex
                      key={p.name}
                      as="button"
                      type="button"
                      role="option"
                      aria-selected={active}
                      w="full"
                      align="center"
                      gap={2}
                      px={3}
                      py={1.5}
                      bg={active ? '#818CF81F' : 'transparent'}
                      _hover={{ bg: '#27272A' }}
                      onClick={() => { onPick(p); setOpen(false); }}
                    >
                      <AspectGlyph w={p.w} h={p.h} active={active} />
                      <Text flex={1} textAlign="left" fontSize="11px" color={active ? 'white' : '#D4D4D8'} truncate>{p.name}</Text>
                      <Text fontSize="10px" color="#71717A" fontFamily="mono">{p.w}×{p.h}</Text>
                      <Box w="12px" flexShrink={0}>{active && <Check size={12} color="#A5B4FC" />}</Box>
                    </Flex>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Portal>
      )}
    </>
  );
}

export default function FrameSection({ shape }: { shape: BaseShape }) {
  const updateShape = useStore((s) => s.updateShape);
  const pushHistory = useStore((s) => s.pushHistory);

  const w = Math.round(Math.abs(shape.width));
  const h = Math.round(Math.abs(shape.height));
  const allPresets = FRAME_PRESETS.flatMap(g => g.items);
  // Exact size first; a rotated match (e.g. a story turned landscape) only as fallback
  const current = allPresets.find(p => p.w === w && p.h === h) || allPresets.find(p => p.w === h && p.h === w);
  const clip = shape.clipContent !== false;

  const setSize = (width: number, height: number) => {
    pushHistory();
    updateShape(shape.id, { width, height });
  };

  return (
    <Section title="Frame">
      <FramePresetPicker
        current={current}
        width={w}
        height={h}
        onPick={(p) => setSize(p.w, p.h)}
      />

      <Flex align="center" justify="space-between">
        <Flex gap={1}>
          <IconButton title="Paisagem" active={w > h} onClick={() => { if (h > w) setSize(h, w); }}>
            <RectangleHorizontal size={15} />
          </IconButton>
          <IconButton title="Retrato" active={h > w} onClick={() => { if (w > h) setSize(h, w); }}>
            <RectangleVertical size={15} />
          </IconButton>
        </Flex>

        <Flex
          as="button"
          type="button"
          align="center"
          gap={2}
          onClick={() => { pushHistory(); updateShape(shape.id, { clipContent: !clip }); }}
          title="Esconde o que passar dos limites do frame"
        >
          <Text fontSize="11px" color={clip ? '#E5E2E1' : '#A1A1AA'}>Recortar conteúdo</Text>
          <Box w="26px" h="14px" rounded="full" bg={clip ? '#818CF8' : '#3F3F46'} pos="relative" transition="background 0.15s">
            <Box pos="absolute" top="2px" left={clip ? '14px' : '2px'} w="10px" h="10px" rounded="full" bg="white" transition="left 0.15s" />
          </Box>
        </Flex>
      </Flex>
    </Section>
  );
}
