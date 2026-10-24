import React from 'react';
import { Box, Flex, Button } from '@chakra-ui/react';
import { useStore } from '../store/useStore';
import { ToolType } from '../types';
import { MousePointer2, Frame, Pen, Square, Circle, Hand, Spline } from 'lucide-react';

export default function VerticalToolbar() {
  const { activeTool, setTool } = useStore();

  const tools: { id: ToolType; label: string; shortcut: string; icon: React.ReactNode }[] = [
    { id: 'select', label: 'Seleção', shortcut: 'V', icon: <MousePointer2 size={18} /> },
    { id: 'frame', label: 'Frame (Página/SVG)', shortcut: 'F', icon: <Frame size={18} /> },
    { id: 'pen', label: 'Lápis (Livre)', shortcut: 'P', icon: <Pen size={18} /> },
    { id: 'bezier', label: 'Caneta (Bézier)', shortcut: 'B', icon: <Spline size={18} /> },
    { id: 'rectangle', label: 'Retângulo', shortcut: 'R', icon: <Square size={18} /> },
    { id: 'ellipse', label: 'Elipse', shortcut: 'E', icon: <Circle size={18} /> },
  ];

  const renderToolButton = (id: ToolType, label: string, shortcut: string, icon: React.ReactNode) => {
    const isActive = activeTool === id;
    return (
      <Button
        key={id}
        id={`vertical-tool-${id}`}
        onClick={() => setTool(id)}
        size="sm"
        minW="38px"
        h="38px"
        p={0}
        rounded="md"
        variant={isActive ? "subtle" : "ghost"}
        bg={isActive ? '#818CF833' : 'transparent'}
        color={isActive ? '#818CF8' : '#C7C4D6'}
        border="1px solid"
        borderColor={isActive ? '#818CF866' : 'transparent'}
        _hover={{ bg: isActive ? '#818CF84D' : '#27272A', color: 'white' }}
        _focusVisible={{ outline: 'none', borderColor: '#818CF8' }}
        _active={{ transform: 'scale(0.96)' }}
        transition="all 0.15s cubic-bezier(0.4, 0, 0.2, 1)"
        title={`${label} (${shortcut})`}
      >
        {icon}
      </Button>
    );
  };

  return (
    <Flex
      id="vertical-toolbar"
      pos="fixed"
      left="16px"
      top="64px"
      zIndex={35}
      flexDir="column"
      align="center"
      bg="#18181B"
      border="1px solid"
      borderColor="#3F3F4680"
      rounded="lg"
      p={1.5}
      gap={1.5}
    >
      {tools.map(t => renderToolButton(t.id, t.label, t.shortcut, t.icon))}
      <Box w="24px" h="1px" bg="#3F3F4680" my={0.5} />
      {renderToolButton('hand', 'Mão (Pan)', 'H', <Hand size={18} />)}
    </Flex>
  );
}
