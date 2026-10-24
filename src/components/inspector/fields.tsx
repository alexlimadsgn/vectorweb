import React, { useRef, useState } from 'react';
import { Box, Flex, Text, Portal } from '@chakra-ui/react';
import { useStore } from '../../store/useStore';
import { AnimatableProperty } from '../../types';

export const KeyframeButton = ({
  shapeId,
  property,
  value,
  attached = true,
}: {
  shapeId: string;
  property: AnimatableProperty;
  value: any;
  attached?: boolean; // glued to the right side of a field
}) => {
  const animations = useStore((s) => s.animations);
  const currentTime = useStore((s) => s.currentTime);
  const addOrUpdateKeyframe = useStore((s) => s.addOrUpdateKeyframe);
  const deleteKeyframe = useStore((s) => s.deleteKeyframe);
  const propKfs = animations[shapeId]?.[property];
  const currentKf = propKfs?.find(k => Math.abs(k.time - currentTime) < 0.05);
  const hasAnimation = !!propKfs?.length;

  const color = currentKf ? '#FBBF24' : hasAnimation ? '#818CF8' : '#6B6B76';

  return (
    <Box
      as="button"
      type="button"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentKf) deleteKeyframe(shapeId, property, currentKf.id);
        else addOrUpdateKeyframe(shapeId, property, currentTime, value);
      }}
      w="24px"
      h="28px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      color={color}
      bg={attached ? '#27272A' : 'transparent'}
      roundedRight={attached ? 'md' : 'md'}
      roundedLeft={attached ? 'none' : 'md'}
      border={attached ? '1px solid #3F3F4680' : 'none'}
      borderLeft="none"
      _hover={{ color: currentKf ? '#FCD34D' : '#E5E2E1', bg: '#323238' }}
      transition="all 0.15s"
      title={currentKf ? `Remover keyframe em ${currentTime.toFixed(2)}s` : `Adicionar keyframe em ${currentTime.toFixed(2)}s`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill={currentKf ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
        <polygon points="12 2 22 12 12 22 2 12" />
      </svg>
    </Box>
  );
};

/**
 * Compact numeric field. Dragging horizontally on the label scrubs the value.
 */
export function NumField({
  label,
  value,
  onChange,
  onCommit,
  step = 1,
  min,
  max,
  suffix,
  keyframe,
  title,
}: {
  label: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  onCommit: () => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  keyframe?: { shapeId: string; property: AnimatableProperty };
  title?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const scrubRef = useRef<{ startX: number; startValue: number } | null>(null);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const decimals = step < 1 ? 2 : 0;
  const display = draft ?? String(Number(value.toFixed(decimals)));

  return (
    <Flex flex={1} minW={0} align="center" title={title}>
      <Flex
        flex={1}
        minW={0}
        align="center"
        h="28px"
        px={2}
        gap={1.5}
        bg="#27272A"
        border="1px solid"
        borderColor="#3F3F4680"
        rounded="md"
        roundedRight={keyframe ? 'none' : 'md'}
        _focusWithin={{ borderColor: '#818CF8' }}
        transition="border-color 0.15s"
      >
        <Box
          fontSize="10px"
          fontWeight="bold"
          color="#8B8A97"
          cursor="ew-resize"
          userSelect="none"
          flexShrink={0}
          display="flex"
          alignItems="center"
          onPointerDown={(e: React.PointerEvent) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            scrubRef.current = { startX: e.clientX, startValue: value };
          }}
          onPointerMove={(e: React.PointerEvent) => {
            if (!scrubRef.current) return;
            const dx = e.clientX - scrubRef.current.startX;
            const factor = e.shiftKey ? 10 : 1;
            const next = clamp(scrubRef.current.startValue + Math.round(dx / 2) * step * factor);
            onChange(Number(next.toFixed(decimals)));
          }}
          onPointerUp={() => {
            if (scrubRef.current) onCommit();
            scrubRef.current = null;
          }}
        >
          {label}
        </Box>
        <input
          value={display}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() !== '' && !Number.isNaN(n)) onChange(clamp(n));
          }}
          onBlur={() => { setDraft(null); onCommit(); }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
              onChange(clamp(Number((value + delta).toFixed(decimals))));
              setDraft(null);
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#E5E2E1',
            fontSize: 11,
            fontFamily: 'inherit',
          }}
        />
        {suffix && <Text fontSize="10px" color="#6B6B76" flexShrink={0}>{suffix}</Text>}
      </Flex>
      {keyframe && <KeyframeButton shapeId={keyframe.shapeId} property={keyframe.property} value={value} />}
    </Flex>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Box py={3} borderTop="1px solid #3F3F4640" _first={{ borderTop: 'none', pt: 1 }}>
      <Flex align="center" justify="space-between" mb={children ? 2 : 0} minH="20px">
        <Text fontSize="11px" fontWeight="semibold" color="#E5E2E1">{title}</Text>
        {action}
      </Flex>
      {children && <Flex direction="column" gap={2}>{children}</Flex>}
    </Box>
  );
}

interface IconButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  size?: number;
}

export const IconButton: React.FC<IconButtonProps> = ({ onClick, active, title, children, size = 28 }) => {
  return (
    <Box
      as="button"
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      w={`${size}px`}
      h={`${size}px`}
      flexShrink={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      rounded="md"
      color={active ? '#818CF8' : '#A1A1AA'}
      bg={active ? '#818CF826' : 'transparent'}
      _hover={{ bg: active ? '#818CF840' : '#27272A', color: active ? '#A5B4FC' : 'white' }}
      transition="all 0.15s"
    >
      {children}
    </Box>
  );
};

/** Segmented control of icon options, e.g. line caps. */
export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; title: string; icon: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <Flex flex={1} bg="#27272A" border="1px solid #3F3F4680" rounded="md" p="2px" gap="2px" h="28px">
      {options.map(o => (
        <Box
          key={o.value}
          as="button"
          type="button"
          flex={1}
          title={o.title}
          aria-label={o.title}
          display="flex"
          alignItems="center"
          justifyContent="center"
          rounded="sm"
          color={value === o.value ? 'white' : '#8B8A97'}
          bg={value === o.value ? '#3F3F46' : 'transparent'}
          _hover={{ color: 'white' }}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
        </Box>
      ))}
    </Flex>
  );
}

const ANCHOR_GRID: [number, number, string, string][] = [
  [0, 0, 'top-left', 'Superior esquerdo'], [0.5, 0, 'top-middle', 'Superior centro'], [1, 0, 'top-right', 'Superior direito'],
  [0, 0.5, 'middle-left', 'Meio esquerdo'], [0.5, 0.5, 'middle', 'Centro'], [1, 0.5, 'middle-right', 'Meio direito'],
  [0, 1, 'bottom-left', 'Inferior esquerdo'], [0.5, 1, 'bottom-middle', 'Inferior centro'], [1, 1, 'bottom-right', 'Inferior direito'],
];

/** Small 3×3 icon showing which anchor is active. */
export const AnchorIcon = ({ ax, ay, manual }: { ax: number; ay: number; manual?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    {[0, 0.5, 1].map(r => [0, 0.5, 1].map(c => {
      const active = !manual && Math.abs(c - ax) < 0.01 && Math.abs(r - ay) < 0.01;
      return <circle key={`${r}-${c}`} cx={2 + c * 10} cy={2 + r * 10} r={active ? 2 : 1.1} fill={active ? '#818CF8' : 'currentColor'} opacity={active ? 1 : 0.6} />;
    }))}
    {manual && <circle cx="7" cy="7" r="2.5" stroke="#818CF8" strokeWidth="1.4" />}
  </svg>
);

/**
 * Anchor (transform origin) picker: a button that opens a 3×3 grid popover.
 */
export function AnchorPicker({
  anchorX, anchorY, manual, onSelect, onToggleManual,
}: {
  anchorX: number;
  anchorY: number;
  manual: boolean;
  onSelect: (anchor: string) => void;
  onToggleManual: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.min(window.innerWidth - 184, r.right - 176) });
    setOpen(o => !o);
  };

  return (
    <>
      <Box
        as="button"
        type="button"
        ref={btnRef}
        onClick={toggle}
        title="Ponto de âncora (origem da rotação e escala)"
        aria-label="Ponto de âncora"
        w="28px"
        h="28px"
        flexShrink={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        rounded="md"
        color="#A1A1AA"
        bg={open ? '#323238' : '#27272A'}
        border="1px solid"
        borderColor={open ? '#818CF8' : '#3F3F4680'}
        _hover={{ color: 'white' }}
      >
        <AnchorIcon ax={anchorX} ay={anchorY} manual={manual} />
      </Box>
      {open && (
        <Portal>
          <Box pos="fixed" inset={0} zIndex={1000} onClick={() => setOpen(false)} />
          <Box
            pos="fixed"
            top={`${pos.top}px`}
            left={`${pos.left}px`}
            zIndex={1001}
            w="176px"
            p={3}
            bg="#18181B"
            border="1px solid #3F3F46"
            rounded="lg"
            boxShadow="0 12px 32px rgba(0,0,0,0.6)"
          >
            <Text fontSize="11px" fontWeight="semibold" color="#E5E2E1" mb={2.5}>Ponto de âncora</Text>
            <Box pos="relative" w="120px" h="120px" mx="auto" mb={3}>
              <Box pos="absolute" inset="10px" border="1px dashed #52525B" rounded="sm" />
              {ANCHOR_GRID.map(([gx, gy, value, label]) => {
                const active = !manual && Math.abs(gx - anchorX) < 0.01 && Math.abs(gy - anchorY) < 0.01;
                return (
                  <Box
                    key={value}
                    as="button"
                    type="button"
                    title={label}
                    aria-label={label}
                    pos="absolute"
                    left={`${10 + gx * 100}px`}
                    top={`${10 + gy * 100}px`}
                    transform="translate(-50%, -50%)"
                    w="20px"
                    h="20px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    rounded="full"
                    _hover={{ bg: '#818CF833' }}
                    onClick={() => { onSelect(value); setOpen(false); }}
                  >
                    {active ? (
                      <Box w="12px" h="12px" rounded="full" border="2px solid #818CF8" display="flex" alignItems="center" justifyContent="center">
                        <Box w="4px" h="4px" rounded="full" bg="#818CF8" />
                      </Box>
                    ) : (
                      <Box w="5px" h="5px" rounded="full" bg="#71717A" />
                    )}
                  </Box>
                );
              })}
            </Box>
            <Flex
              as="button"
              w="full"
              align="center"
              justify="space-between"
              fontSize="11px"
              color={manual ? '#A5B4FC' : '#A1A1AA'}
              _hover={{ color: 'white' }}
              onClick={() => { onToggleManual(); setOpen(false); }}
            >
              <Text>Mover no canvas</Text>
              <Box w="26px" h="14px" rounded="full" bg={manual ? '#818CF8' : '#3F3F46'} pos="relative">
                <Box pos="absolute" top="2px" left={manual ? '14px' : '2px'} w="10px" h="10px" rounded="full" bg="white" transition="left 0.15s" />
              </Box>
            </Flex>
          </Box>
        </Portal>
      )}
    </>
  );
}
