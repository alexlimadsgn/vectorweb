import React, { useEffect, useRef, useState } from 'react';
import { Box, Flex, Text, Portal } from '@chakra-ui/react';
import { Timer, SlidersHorizontal, Trash2, Plus, ChevronDown } from 'lucide-react';
import { Keyframe, SpringConfig } from '../types';
import { EASING_PRESETS, EasingPreset, evaluateCurve, findEasingPreset } from '../lib/easingPresets';

/** Small SVG plot of an easing curve. */
export function CurveThumb({ curve, size = 40, color = '#818CF8', strokeWidth = 1.6 }: {
  curve: Pick<Keyframe, 'easing' | 'bezier' | 'spring'>;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const pad = size * 0.18;
  const span = size - pad * 2;
  // Overshooting curves (elastic, back, spring) need headroom above 1
  const samples = Array.from({ length: 49 }, (_, i) => i / 48).map(t => [t, evaluateCurve(curve, t)] as const);
  const maxY = Math.max(1, ...samples.map(([, y]) => y));
  const minY = Math.min(0, ...samples.map(([, y]) => y));
  const pts = samples.map(([t, y]) => `${(pad + t * span).toFixed(1)},${(pad + span - ((y - minY) / (maxY - minY)) * span).toFixed(1)}`);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface EasingBarProps {
  keyframe: Keyframe;
  /** Seconds since the previous keyframe on the same track, or null for the first one */
  segmentDuration: number | null;
  count: number;
  onDurationChange: (seconds: number) => void;
  onEasingChange: (easing: string, bezier?: [number, number, number, number], spring?: SpringConfig) => void;
  onOpenCustom: (anchor: DOMRect) => void;
  onDelete: () => void;
}

/**
 * Timeline toolbar for the selected keyframe(s): segment duration, an easing
 * button that opens a grid of curve presets, and a button for the custom curve editor.
 */
export default function EasingBar({ keyframe, segmentDuration, count, onDurationChange, onEasingChange, onOpenCustom, onDelete }: EasingBarProps) {
  const [gridOpen, setGridOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const easingBtnRef = useRef<HTMLButtonElement>(null);
  const customBtnRef = useRef<HTMLButtonElement>(null);
  const preset = findEasingPreset(keyframe);

  useEffect(() => {
    if (!gridOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setGridOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gridOpen]);

  const anchor = easingBtnRef.current?.getBoundingClientRect();
  const choose = (p: EasingPreset) => {
    onEasingChange(p.easing, p.bezier, p.spring);
    setGridOpen(false);
  };

  return (
    <Flex align="center" gap={1} bg="#1F1F23" p="2px" h="30px" rounded="md" border="1px solid #3F3F4680">
      {count > 1 && (
        <Text fontSize="10px" color="#FBBF24" fontWeight="semibold" px={1.5} title={`${count} keyframes selecionados`}>
          {count}×
        </Text>
      )}

      {/* Duration of the segment leading into this keyframe */}
      <Flex
        align="center"
        gap={1}
        h="full"
        px={2}
        rounded="sm"
        bg="#27272A"
        opacity={segmentDuration === null ? 0.5 : 1}
        title={segmentDuration === null ? 'Primeiro keyframe: não há trecho antes dele' : 'Duração do trecho até este keyframe'}
      >
        <Timer size={12} color="#A1A1AA" />
        <input
          disabled={segmentDuration === null}
          value={draft ?? (segmentDuration === null ? '—' : segmentDuration.toFixed(2))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const v = Number((draft ?? '').replace(',', '.'));
            if (draft !== null && !Number.isNaN(v) && v > 0) onDurationChange(v);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); }
          }}
          aria-label="Duração do trecho em segundos"
          style={{ width: 36, background: 'transparent', border: 'none', outline: 'none', color: '#E5E2E1', fontSize: 11, textAlign: 'right' }}
        />
        <Text fontSize="10px" color="#6B6B76">s</Text>
      </Flex>

      {/* Easing preset button → grid */}
      <Flex
        as="button"
        type="button"
        ref={easingBtnRef}
        onClick={() => setGridOpen(o => !o)}
        align="center"
        gap={1.5}
        h="full"
        pl={1}
        pr={2}
        rounded="sm"
        bg={gridOpen ? '#3F3F46' : '#27272A'}
        _hover={{ bg: '#323238' }}
        title="Escolher curva de velocidade"
      >
        <Box bg="#18181B" rounded="sm">
          <CurveThumb curve={keyframe} size={22} strokeWidth={1.4} />
        </Box>
        <Text fontSize="11px" color="#E5E2E1" whiteSpace="nowrap">{preset?.label || 'Personalizada'}</Text>
        <ChevronDown size={12} color="#A1A1AA" />
      </Flex>

      {/* Custom curve (bezier / spring) */}
      <Box
        as="button"
        type="button"
        ref={customBtnRef}
        onClick={() => customBtnRef.current && onOpenCustom(customBtnRef.current.getBoundingClientRect())}
        w="26px"
        h="full"
        display="flex"
        alignItems="center"
        justifyContent="center"
        rounded="sm"
        color="#A1A1AA"
        _hover={{ bg: '#323238', color: 'white' }}
        title="Ajustar curva (Bézier / mola)"
        aria-label="Ajustar curva"
      >
        <SlidersHorizontal size={13} />
      </Box>

      <Box
        as="button"
        type="button"
        onClick={onDelete}
        w="26px"
        h="full"
        display="flex"
        alignItems="center"
        justifyContent="center"
        rounded="sm"
        color="#F87171"
        _hover={{ bg: '#F8717126' }}
        title={count > 1 ? `Excluir ${count} keyframes` : 'Excluir keyframe'}
        aria-label="Excluir keyframe"
      >
        <Trash2 size={13} />
      </Box>

      {gridOpen && anchor && (
        <Portal>
          <Box pos="fixed" inset={0} zIndex={9998} onClick={() => setGridOpen(false)} />
          <Box
            pos="fixed"
            zIndex={9999}
            w="236px"
            bg="#18181B"
            border="1px solid #3F3F46"
            rounded="xl"
            boxShadow="0 12px 40px rgba(0,0,0,0.7)"
            p={2}
            style={{
              bottom: window.innerHeight - anchor.top + 8,
              left: Math.max(8, Math.min(anchor.left, window.innerWidth - 244)),
            }}
          >
            <Text fontSize="11px" fontWeight="semibold" color="#E5E2E1" px={1} pb={2}>Curva de velocidade</Text>
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} overflowY="auto" pr={0.5} style={{ maxHeight: Math.max(120, Math.min(340, anchor.top - 64)) }}>
              <Flex
                as="button"
                type="button"
                direction="column"
                align="center"
                justify="center"
                gap={1}
                h="86px"
                rounded="lg"
                bg="#27272A"
                color="#E5E2E1"
                _hover={{ bg: '#323238' }}
                onClick={() => { setGridOpen(false); if (easingBtnRef.current) onOpenCustom(easingBtnRef.current.getBoundingClientRect()); }}
              >
                <Plus size={22} />
                <Text fontSize="10px" color="#A1A1AA">Personalizada</Text>
              </Flex>
              {EASING_PRESETS.map(p => {
                const active = preset?.id === p.id;
                return (
                  <Flex
                    key={p.id}
                    as="button"
                    type="button"
                    direction="column"
                    align="center"
                    justify="center"
                    gap={1}
                    h="86px"
                    rounded="lg"
                    bg={active ? 'linear-gradient(160deg, #818CF8, #6366F1)' : '#27272A'}
                    _hover={{ bg: active ? undefined : '#323238' }}
                    onClick={() => choose(p)}
                    title={p.label}
                  >
                    <CurveThumb curve={p} size={44} color={active ? '#FFFFFF' : '#C7C4D6'} strokeWidth={2} />
                    <Text fontSize="10px" color={active ? 'white' : '#A1A1AA'} fontWeight={active ? 'semibold' : 'normal'}>{p.label}</Text>
                  </Flex>
                );
              })}
            </Box>
          </Box>
        </Portal>
      )}
    </Flex>
  );
}
