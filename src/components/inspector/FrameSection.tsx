import React from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { RectangleHorizontal, RectangleVertical } from 'lucide-react';
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

export default function FrameSection({ shape }: { shape: BaseShape }) {
  const updateShape = useStore((s) => s.updateShape);
  const pushHistory = useStore((s) => s.pushHistory);

  const w = Math.round(Math.abs(shape.width));
  const h = Math.round(Math.abs(shape.height));
  const current = FRAME_PRESETS.flatMap(g => g.items).find(p => (p.w === w && p.h === h) || (p.w === h && p.h === w));
  const clip = shape.clipContent !== false;

  const setSize = (width: number, height: number) => {
    pushHistory();
    updateShape(shape.id, { width, height });
  };

  return (
    <Section title="Frame">
      <Box pos="relative">
        <select
          aria-label="Tamanho predefinido"
          value={current ? `${current.w}x${current.h}` : ''}
          onChange={(e) => {
            const [pw, ph] = e.target.value.split('x').map(Number);
            if (pw && ph) setSize(pw, ph);
          }}
          style={{
            width: '100%',
            height: 28,
            background: '#27272A',
            color: '#E5E2E1',
            border: '1px solid #3F3F4680',
            borderRadius: 6,
            padding: '0 8px',
            fontSize: 11,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">{current ? current.name : `Personalizado (${w}×${h})`}</option>
          {FRAME_PRESETS.map(g => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map(p => (
                <option key={p.name} value={`${p.w}x${p.h}`}>{`${p.name} — ${p.w}×${p.h}`}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Box>

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
