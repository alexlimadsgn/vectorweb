import React from 'react';
import { Box } from '@chakra-ui/react';
import TopBar from './components/TopBar';
import VerticalToolbar from './components/VerticalToolbar';
import LayersPanel from './components/LayersPanel';
import InspectorPanel from './components/InspectorPanel';
import CanvasRenderer from './components/CanvasRenderer';
import TimelinePanel from './components/TimelinePanel';

export default function App() {
  return (
    <Box w="100vw" h="100vh" overflow="hidden" bg="#121214" userSelect="none" pos="relative">
      <CanvasRenderer />
      
      <TopBar />
      <VerticalToolbar />
      <LayersPanel />
      <InspectorPanel />
      
      <TimelinePanel />
    </Box>
  );
}

