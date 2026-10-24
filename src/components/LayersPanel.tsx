import React, { useEffect, useRef, useState } from 'react';
import { Box, Flex, Text, Badge, Button } from '@chakra-ui/react';
import { useStore } from '../store/useStore';
import { BaseShape } from '../types';
import { Layers, Eye, EyeOff, Lock, Unlock, ChevronDown, ChevronRight, Folder, Frame } from 'lucide-react';

type DropPosition = 'above' | 'below' | 'inside';

const defaultName = (shape: BaseShape) => {
  if (shape.type === 'frame') return `Frame ${shape.id.substring(0, 4)}`;
  if (shape.type === 'group') return `Group ${shape.id.substring(0, 4)}`;
  return `${shape.type.charAt(0).toUpperCase() + shape.type.slice(1)} ${shape.id.substring(0, 4)}`;
};

const ShapeIcon = ({ shape }: { shape: BaseShape }) => {
  if (shape.type === 'frame') return <Frame size={14} color="#818CF8" />;
  if (shape.type === 'group') return <Folder size={14} color="#818CF8" />;
  if (shape.type === 'rectangle') return <Box w="11px" h="11px" border="1px solid #C7C4D6" rounded="xs" />;
  if (shape.type === 'ellipse') return <Box w="12px" h="12px" rounded="full" border="1px solid #C7C4D6" />;
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C7C4D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17c3-8 6 4 9-4s6 4 9-4" />
    </svg>
  );
};

function LayerName({ shape, editing, onDone }: { shape: BaseShape; editing: boolean; onDone: () => void }) {
  const renameShape = useStore((s) => s.renameShape);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(shape.name || defaultName(shape));

  useEffect(() => {
    if (editing) {
      setValue(shape.name || defaultName(shape));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  if (!editing) {
    return (
      <Text fontSize="xs" flex={1} truncate opacity={shape.hidden ? 0.4 : 1}>
        {shape.name || defaultName(shape)}
      </Text>
    );
  }

  const commit = () => {
    if (value.trim() !== (shape.name || defaultName(shape))) renameShape(shape.id, value);
    onDone();
  };

  return (
    <input
      ref={inputRef}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation(); // keep canvas shortcuts (V, R, Delete…) from firing
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onDone();
      }}
      style={{
        flex: 1,
        minWidth: 0,
        fontSize: 12,
        background: '#0F0F11',
        color: 'white',
        border: '1px solid #818CF8',
        borderRadius: 4,
        padding: '2px 6px',
        outline: 'none',
      }}
    />
  );
}

export default function LayersPanel() {
  const shapes = useStore((s) => s.shapes);
  const selectedIds = useStore((s) => s.selectedIds);
  const hoveredId = useStore((s) => s.hoveredId);
  const selectShape = useStore((s) => s.selectShape);
  const setHovered = useStore((s) => s.setHovered);
  const toggleLock = useStore((s) => s.toggleLock);
  const toggleVisibility = useStore((s) => s.toggleVisibility);
  const moveLayer = useStore((s) => s.moveLayer);
  const showTimeline = useStore((s) => s.showTimeline);
  const timelineHeight = useStore((s) => s.timelineHeight);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const isContainer = (s: BaseShape) => s.type === 'frame' || s.type === 'group';
  const childrenOf = (parentId: string | undefined) =>
    [...shapes].reverse().filter(s => (s.groupId || undefined) === parentId && (parentId === undefined || s.id !== parentId))
      // Orphans whose parent no longer exists are shown at the root
      .concat(parentId === undefined ? [...shapes].reverse().filter(s => s.groupId && !shapes.some(p => p.id === s.groupId)) : []);

  const getDropPosition = (e: React.DragEvent, shape: BaseShape): DropPosition => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    if (isContainer(shape)) {
      if (ratio < 0.25) return 'above';
      if (ratio > 0.75) return 'below';
      return 'inside';
    }
    return ratio < 0.5 ? 'above' : 'below';
  };

  const toggleCollapsed = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderRow = (shape: BaseShape, depth: number): React.ReactNode => {
    const isSelected = selectedIds.includes(shape.id);
    const isHovered = hoveredId === shape.id;
    const children = isContainer(shape) ? childrenOf(shape.id) : [];
    const isCollapsed = collapsed.has(shape.id);
    const drop = dropTarget?.id === shape.id ? dropTarget.position : null;

    return (
      <React.Fragment key={shape.id}>
        <Flex
          pos="relative"
          draggable={editingId !== shape.id}
          onDragStart={(e) => {
            setDraggedId(shape.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', shape.id);
          }}
          onDragEnd={() => { setDraggedId(null); setDropTarget(null); }}
          onDragOver={(e) => {
            if (!draggedId || draggedId === shape.id) return;
            e.preventDefault();
            e.stopPropagation();
            const position = getDropPosition(e, shape);
            if (dropTarget?.id !== shape.id || dropTarget.position !== position) setDropTarget({ id: shape.id, position });
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (draggedId && draggedId !== shape.id) {
              const position = getDropPosition(e, shape);
              moveLayer(draggedId, shape.id, position);
              if (position === 'inside') setCollapsed(prev => { const n = new Set(prev); n.delete(shape.id); return n; });
            }
            setDraggedId(null);
            setDropTarget(null);
          }}
          onClick={(e) => selectShape(shape.id, e.shiftKey, true)}
          onDoubleClick={(e) => { e.stopPropagation(); setEditingId(shape.id); }}
          onMouseEnter={() => setHovered(shape.id)}
          onMouseLeave={() => setHovered(null)}
          align="center"
          h="32px"
          pr={2}
          pl={`${10 + depth * 16}px`}
          rounded="md"
          cursor="pointer"
          transition="background 0.15s"
          opacity={draggedId === shape.id ? 0.4 : 1}
          bg={drop === 'inside' ? '#818CF844' : isSelected ? '#818CF833' : isHovered ? '#27272A' : 'transparent'}
          outline={drop === 'inside' ? '1px solid #818CF8' : 'none'}
          color={isSelected || isHovered ? 'white' : '#C7C4D6'}
          fontWeight={isSelected ? 'medium' : 'normal'}
        >
          {drop === 'above' && <Box pos="absolute" left={`${10 + depth * 16}px`} right={2} top="-1px" h="2px" bg="#818CF8" rounded="full" />}
          {drop === 'below' && <Box pos="absolute" left={`${10 + depth * 16}px`} right={2} bottom="-1px" h="2px" bg="#818CF8" rounded="full" />}

          <Flex w="16px" h="16px" align="center" justify="center" mr={1} shrink={0}>
            {children.length > 0 && (
              <Box as="button" color="#918F9F" _hover={{ color: 'white' }} onClick={(e: React.MouseEvent) => toggleCollapsed(shape.id, e)}>
                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </Box>
            )}
          </Flex>
          <Flex w="18px" h="18px" align="center" justify="center" mr={2} shrink={0}>
            <ShapeIcon shape={shape} />
          </Flex>

          <LayerName shape={shape} editing={editingId === shape.id} onDone={() => setEditingId(null)} />

          <Flex align="center" gap={0.5} ml={1} opacity={shape.hidden || shape.locked || isSelected || isHovered ? 1 : 0}>
            <Button variant="ghost" size="xs" minW="22px" h="22px" p={0} rounded="md" _hover={{ bg: '#333' }}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleVisibility(shape.id); }}>
              {shape.hidden ? <EyeOff size={13} color="#f87171" /> : <Eye size={13} color="#C7C4D6" />}
            </Button>
            <Button variant="ghost" size="xs" minW="22px" h="22px" p={0} rounded="md" _hover={{ bg: '#333' }}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleLock(shape.id); }}>
              {shape.locked ? <Lock size={13} color="#fbbf24" /> : <Unlock size={13} color="#C7C4D6" />}
            </Button>
          </Flex>
        </Flex>
        {!isCollapsed && children.map(child => renderRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const rootShapes = childrenOf(undefined);

  return (
    <Box
      pos="fixed"
      left="82px"
      top="64px"
      w="240px"
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
      <Flex px={4} py={3} borderBottom="1px solid" borderColor="#3F3F4680" justify="space-between" align="center" shrink={0}>
        <Flex align="center" gap={2}>
          <Layers size={15} color="#818CF8" />
          <Text fontWeight="bold" fontSize="xs" letterSpacing="wider" textTransform="uppercase" color="#C7C4D6">
            Camadas
          </Text>
        </Flex>
        <Badge bg="#27272A" color="#A1A1AA" px={2} py={0.5} rounded="full" fontSize="10px" fontFamily="mono">
          {shapes.length}
        </Badge>
      </Flex>

      <Box
        p={2}
        overflowY="auto"
        flex={1}
        maxH="420px"
        display="flex"
        flexDir="column"
        gap="2px"
        onDragOver={(e) => { if (draggedId) e.preventDefault(); }}
        onDrop={(e) => {
          // Dropped on empty space: move to the bottom of the root level
          e.preventDefault();
          if (draggedId) moveLayer(draggedId, null, 'below');
          setDraggedId(null);
          setDropTarget(null);
        }}
      >
        {shapes.length === 0 ? (
          <Text py={8} px={4} textAlign="center" fontSize="xs" color="#918F9F" fontStyle="italic">
            Nenhum elemento na tela
          </Text>
        ) : (
          rootShapes.map(shape => renderRow(shape, 0))
        )}
      </Box>
    </Box>
  );
}
