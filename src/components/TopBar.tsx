import React, { useState, useRef } from 'react';
import { Box, Flex, Text, Button, Badge, Menu } from '@chakra-ui/react';
import { useStore } from '../store/useStore';
import { MousePointer2, Square, Circle, Pen, Hand, Download, ChevronDown, Undo2, Redo2, Check, Code } from 'lucide-react';
import { ToolType, BaseShape } from '../types';
import { exportAnimatedSvg } from '../lib/exportAnimatedSvg';
import ExportVideoDialog from './ExportVideoDialog';
import AboutDialog from './AboutDialog';
import { exportLottie } from '../lib/exportLottie';
import { Info } from 'lucide-react';

export default function TopBar() {
  const activeTool = useStore((s) => s.activeTool);
  const setTool = useStore((s) => s.setTool);
  const viewport = useStore((s) => s.viewport);
  const shapes = useStore((s) => s.shapes);
  const selectedIds = useStore((s) => s.selectedIds);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const past = useStore((s) => s.past);
  const future = useStore((s) => s.future);
  const zoomIn = useStore((s) => s.zoomIn);
  const zoomOut = useStore((s) => s.zoomOut);
  const zoomTo100 = useStore((s) => s.zoomTo100);
  const zoomToFit = useStore((s) => s.zoomToFit);
  const zoomToSelection = useStore((s) => s.zoomToSelection);
  const showRulers = useStore((s) => s.showRulers);
  const showWireframe = useStore((s) => s.showWireframe);
  const snapEnabled = useStore((s) => s.snapEnabled);
  const toggleRulers = useStore((s) => s.toggleRulers);
  const toggleWireframe = useStore((s) => s.toggleWireframe);
  const toggleSnap = useStore((s) => s.toggleSnap);
  const bringToFront = useStore((s) => s.bringToFront);
  const bringForward = useStore((s) => s.bringForward);
  const sendBackward = useStore((s) => s.sendBackward);
  const sendToBack = useStore((s) => s.sendToBack);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const cutSelected = useStore((s) => s.cutSelected);
  const copySelected = useStore((s) => s.copySelected);
  const pasteCopied = useStore((s) => s.pasteCopied);
  const convertToPath = useStore((s) => s.convertToPath);
  const reorientPath = useStore((s) => s.reorientPath);
  const clearDocument = useStore((s) => s.clearDocument);

  const svgInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [activeMenu, setActiveMenu] = useState<'file' | 'edit' | 'view' | 'object' | null>(null);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sourceCode, setSourceCode] = useState("");
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // SVG parser and importer
  const parseSVGAndLoad = (svgText: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, "image/svg+xml");
      const svgElement = doc.querySelector("svg");
      if (!svgElement) return;

      const newShapes: BaseShape[] = [];
      const rects = doc.querySelectorAll("rect");
      const ellipses = doc.querySelectorAll("ellipse, circle");
      const paths = doc.querySelectorAll("path");

      rects.forEach(r => {
        const x = parseFloat(r.getAttribute("x") || "0");
        const y = parseFloat(r.getAttribute("y") || "0");
        const w = parseFloat(r.getAttribute("width") || "100");
        const h = parseFloat(r.getAttribute("height") || "100");
        const fill = r.getAttribute("fill") || "#FFFFFF";
        const stroke = r.getAttribute("stroke") || "transparent";
        const strokeWidth = parseFloat(r.getAttribute("stroke-width") || "0");
        const opacity = parseFloat(r.getAttribute("opacity") || "1");
        const rx = parseFloat(r.getAttribute("rx") || "0");

        newShapes.push({
          id: Math.random().toString(36).substring(2, 9),
          type: "rectangle",
          x, y, width: w, height: h, fill, stroke, strokeWidth, opacity, rx,
          rotation: 0
        });
      });

      ellipses.forEach(e => {
        const cx = parseFloat(e.getAttribute("cx") || "50");
        const cy = parseFloat(e.getAttribute("cy") || "50");
        const rx = parseFloat(e.getAttribute("rx") || e.getAttribute("r") || "25");
        const ry = parseFloat(e.getAttribute("ry") || e.getAttribute("r") || "25");
        const fill = e.getAttribute("fill") || "#FFFFFF";
        const stroke = e.getAttribute("stroke") || "transparent";
        const strokeWidth = parseFloat(e.getAttribute("stroke-width") || "0");
        const opacity = parseFloat(e.getAttribute("opacity") || "1");

        newShapes.push({
          id: Math.random().toString(36).substring(2, 9),
          type: "ellipse",
          x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2, fill, stroke, strokeWidth, opacity,
          rotation: 0
        });
      });

      paths.forEach(p => {
        const d = p.getAttribute("d") || "";
        const fill = p.getAttribute("fill") || "#FFFFFF";
        const stroke = p.getAttribute("stroke") || "transparent";
        const strokeWidth = parseFloat(p.getAttribute("stroke-width") || "0");
        const opacity = parseFloat(p.getAttribute("opacity") || "1");

        if (d) {
          newShapes.push({
            id: Math.random().toString(36).substring(2, 9),
            type: "path",
            x: 0, y: 0, width: 200, height: 200, fill, stroke, strokeWidth, opacity, d,
            rotation: 0
          });
        }
      });

      if (newShapes.length > 0) {
        useStore.setState({ shapes: newShapes, selectedIds: [] });
      }
    } catch (err) {
      console.error("Failed to parse imported SVG:", err);
    }
  };

  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const newShape: BaseShape = {
          id: Math.random().toString(36).substring(2, 9),
          type: "image",
          x: 100, y: 100,
          width: img.width > 400 ? 400 : img.width,
          height: img.width > 400 ? (img.height * 400) / img.width : img.height,
          fill: "none",
          stroke: "none",
          strokeWidth: 0,
          src: event.target?.result as string,
          rotation: 0,
          opacity: 1
        };
        useStore.setState(state => ({ shapes: [...state.shapes, newShape], selectedIds: [newShape.id] }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const generateFullSVGCode = () => {
    const frame = shapes.find(s => s.type === 'frame');
    let minX = 0, minY = 0, width = 800, height = 600;

    if (frame) {
      minX = frame.x;
      minY = frame.y;
      width = Math.abs(frame.width) || 800;
      height = Math.abs(frame.height) || 600;
    } else {
      const minXCalc = Math.min(...shapes.map(s => s.x), 0);
      const minYCalc = Math.min(...shapes.map(s => s.y), 0);
      const maxXCalc = Math.max(...shapes.map(s => s.x + s.width), 800);
      const maxYCalc = Math.max(...shapes.map(s => s.y + s.height), 600);
      minX = minXCalc;
      minY = minYCalc;
      width = maxXCalc - minXCalc || 800;
      height = maxYCalc - minYCalc || 600;
    }

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">\n`;
    
    shapes.forEach(s => {
      if (s.hidden) return;
      if (s.type === 'rectangle' || s.type === 'frame') {
        svgContent += `  <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx || s.radius || 0}" fill="${s.fill || 'none'}" stroke="${s.stroke || 'none'}" stroke-width="${s.strokeWidth || 0}" opacity="${s.opacity ?? 1}" transform="rotate(${s.rotation || 0} ${s.x + s.width/2} ${s.y + s.height/2})" />\n`;
      } else if (s.type === 'ellipse') {
        svgContent += `  <ellipse cx="${s.x + s.width/2}" cy="${s.y + s.height/2}" rx="${s.width/2}" ry="${s.height/2}" fill="${s.fill || 'none'}" stroke="${s.stroke || 'none'}" stroke-width="${s.strokeWidth || 0}" opacity="${s.opacity ?? 1}" transform="rotate(${s.rotation || 0} ${s.x + s.width/2} ${s.y + s.height/2})" />\n`;
      } else if (s.type === 'path') {
        let d = s.d || '';
        if (!d && s.points && s.points.length > 0) {
          d = `M ${s.points[0].x * s.width + s.x + s.width/2} ${s.points[0].y * s.height + s.y + s.height/2} ` +
            s.points.slice(1).map((p) => `L ${p.x * s.width + s.x + s.width/2} ${p.y * s.height + s.y + s.height/2}`).join(' ');
          if (s.closed) d += ' Z';
        }
        if (d) {
          svgContent += `  <path d="${d}" fill="${s.fill || 'none'}" stroke="${s.stroke || 'none'}" stroke-width="${s.strokeWidth || 0}" opacity="${s.opacity ?? 1}" transform="rotate(${s.rotation || 0} ${s.x + s.width/2} ${s.y + s.height/2})" />\n`;
        }
      } else if (s.type === 'image' && s.src) {
        svgContent += `  <image href="${s.src}" x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" opacity="${s.opacity ?? 1}" />\n`;
      }
    });

    svgContent += `</svg>`;
    return svgContent;
  };

  const handleGenerateSource = () => {
    const code = generateFullSVGCode();
    setSourceCode(code);
    setSourceModalOpen(true);
  };

  const handleCopySource = () => {
    navigator.clipboard.writeText(sourceCode);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  const handleExport = (selectedOnly = false) => {
    const targetShapes = selectedOnly 
      ? shapes.filter(s => selectedIds.includes(s.id))
      : shapes;

    if (targetShapes.length === 0) return;

    const frame = targetShapes.find(s => s.type === 'frame') || shapes.find(s => s.type === 'frame');
    let minX = 0, minY = 0, width = 800, height = 600;

    if (frame) {
      minX = frame.x;
      minY = frame.y;
      width = Math.abs(frame.width) || 800;
      height = Math.abs(frame.height) || 600;
    } else {
      minX = Math.min(...targetShapes.map(s => s.x));
      minY = Math.min(...targetShapes.map(s => s.y));
      const maxX = Math.max(...targetShapes.map(s => s.x + s.width));
      const maxY = Math.max(...targetShapes.map(s => s.y + s.height));
      width = maxX - minX || 100;
      height = maxY - minY || 100;
    }

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">\n`;

    targetShapes.forEach(s => {
      if (s.hidden) return;
      if (s.type === 'rectangle' || s.type === 'frame') {
        svgContent += `  <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx || s.radius || 0}" fill="${s.fill || 'none'}" stroke="${s.stroke || 'none'}" stroke-width="${s.strokeWidth || 0}" opacity="${s.opacity ?? 1}" transform="rotate(${s.rotation || 0} ${s.x + s.width/2} ${s.y + s.height/2})" />\n`;
      } else if (s.type === 'ellipse') {
        svgContent += `  <ellipse cx="${s.x + s.width/2}" cy="${s.y + s.height/2}" rx="${s.width/2}" ry="${s.height/2}" fill="${s.fill || 'none'}" stroke="${s.stroke || 'none'}" stroke-width="${s.strokeWidth || 0}" opacity="${s.opacity ?? 1}" transform="rotate(${s.rotation || 0} ${s.x + s.width/2} ${s.y + s.height/2})" />\n`;
      } else if (s.type === 'path') {
        let d = s.d || '';
        if (!d && s.points && s.points.length > 0) {
          d = `M ${s.points[0].x * s.width + s.x + s.width/2} ${s.points[0].y * s.height + s.y + s.height/2} ` +
            s.points.slice(1).map((p) => `L ${p.x * s.width + s.x + s.width/2} ${p.y * s.height + s.y + s.height/2}`).join(' ');
          if (s.closed) d += ' Z';
        }
        if (d) {
          svgContent += `  <path d="${d}" fill="${s.fill || 'none'}" stroke="${s.stroke || 'none'}" stroke-width="${s.strokeWidth || 0}" opacity="${s.opacity ?? 1}" transform="rotate(${s.rotation || 0} ${s.x + s.width/2} ${s.y + s.height/2})" />\n`;
        }
      } else if (s.type === 'image' && s.src) {
        svgContent += `  <image href="${s.src}" x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" opacity="${s.opacity ?? 1}" />\n`;
      }
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vectorweb-export.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderToolButton = (tool: ToolType, title: string, icon: React.ReactNode) => {
    const isActive = activeTool === tool;
    return (
      <Button
        key={tool}
        id={`tool-${tool}`}
        onClick={() => setTool(tool)}
        title={title}
        size="sm"
        minW="36px"
        h="36px"
        p={0}
        rounded="md"
        variant={isActive ? "subtle" : "ghost"}
        bg={isActive ? '#818CF833' : 'transparent'}
        color={isActive ? '#818CF8' : '#C7C4D6'}
        fontWeight={isActive ? 'bold' : 'normal'}
        _hover={{ bg: isActive ? '#818CF833' : '#2A2A2A', color: 'white' }}
        _active={{ transform: 'scale(0.95)' }}
        transition="all 0.15s"
      >
        {icon}
      </Button>
    );
  };

  return (
    <>
    <Box
      as="header"
      id="topbar-header"
      pos="fixed"
      top={0}
      w="full"
      h="52px"
      zIndex={50}
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      px={4}
      bg="#18181B"
      borderBottom="1px solid"
      borderColor="#3F3F4680"
    >
      <Flex align="center" gap={4}>
        <Flex align="center" gap={2} color="white" fontWeight="bold" fontSize="md" letterSpacing="tight">
          <Box w="10px" h="10px" rounded="full" bg="#818CF8" shrink={0} /> VectorWeb
        </Flex>
        <Flex display={{ base: 'none', md: 'flex' }} gap={1} pos="relative">
          
          {/* Hidden File Inputs */}
          <input 
            ref={svgInputRef}
            type="file" 
            accept=".svg" 
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  if (ev.target?.result) {
                    parseSVGAndLoad(ev.target.result as string);
                  }
                };
                reader.readAsText(file);
              }
              e.target.value = '';
            }} 
          />
          <input 
            ref={imageInputRef}
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }}
            onChange={(e) => {
              handleImageImport(e);
              e.target.value = '';
            }} 
          />

          {/* File Menu */}
          <Box pos="relative" style={{ position: 'relative' }}>
            <Button
              id="menu-file"
              onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
              onMouseEnter={() => { if (activeMenu && activeMenu !== 'file') setActiveMenu('file'); }}
              pos="relative"
              zIndex={activeMenu ? 1001 : undefined}
              size="xs"
              px={3}
              h="28px"
              fontSize="xs"
              rounded="md"
              variant="ghost"
              color={activeMenu === 'file' ? '#FFFFFF' : '#C7C4D6'}
              bg={activeMenu === 'file' ? '#3F3F46' : 'transparent'}
              fontWeight={activeMenu === 'file' ? 'semibold' : 'normal'}
              _hover={{ bg: '#27272A', color: 'white' }}
            >
              File
            </Button>
            {activeMenu === 'file' && (
              <>
                                  <Box pos="fixed" inset={0} zIndex={999} onClick={() => setActiveMenu(null)} />
                <Box
                  pos="absolute"
                  left={0}
                  top="100%"
                  mt="4px"
                  style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000 }}
                  w="220px"
                  bg="#18181B"
                  border="1px solid #3F3F46"
                  boxShadow="0 10px 30px rgba(0,0,0,0.8)"
                  rounded="md"
                  py={1}
                  zIndex={1000}
                  display="flex"
                  flexDir="column"
                  fontSize="xs"
                  color="#F4F4F5"
                >
                  <Flex 
                    as="button"
                    id="file-action-new"
                    onClick={() => { clearDocument(); setActiveMenu(null); }}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    color="#F4F4F5"
                    _hover={{ bg: '#27272A', color: '#FFFFFF' }}
                    cursor="pointer"
                  >
                    <Text fontWeight="medium" color="#F4F4F5">Novo Documento</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="file-action-open"
                    onClick={() => { svgInputRef.current?.click(); setActiveMenu(null); }}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    color="#F4F4F5"
                    _hover={{ bg: '#27272A', color: '#FFFFFF' }}
                    cursor="pointer"
                  >
                    <Text fontWeight="medium" color="#F4F4F5">Abrir SVG...</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="file-action-import"
                    onClick={() => { imageInputRef.current?.click(); setActiveMenu(null); }}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    color="#F4F4F5"
                    _hover={{ bg: '#27272A', color: '#FFFFFF' }}
                    cursor="pointer"
                  >
                    <Text fontWeight="medium" color="#F4F4F5">Importar Imagem...</Text>
                  </Flex>
                  <Box h="1px" bg="#3F3F46" my={1} />
                  <Flex 
                    as="button"
                    id="file-action-close"
                    onClick={() => { clearDocument(); setActiveMenu(null); }}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    color="#F4F4F5"
                    _hover={{ bg: '#27272A', color: '#FFFFFF' }}
                    cursor="pointer"
                  >
                    <Text fontWeight="medium" color="#F4F4F5">Fechar</Text>
                  </Flex>
                </Box>
              </>
            )}
          </Box>

          {/* Edit Menu */}
          <Box pos="relative" style={{ position: 'relative' }}>
            <Button
              id="menu-edit"
              onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
              onMouseEnter={() => { if (activeMenu && activeMenu !== 'edit') setActiveMenu('edit'); }}
              pos="relative"
              zIndex={activeMenu ? 1001 : undefined}
              size="xs" px={3} h="28px" fontSize="xs" rounded="md" variant="ghost"
              color={activeMenu === 'edit' ? '#FFFFFF' : '#C7C4D6'}
              bg={activeMenu === 'edit' ? '#3F3F46' : 'transparent'}
              fontWeight={activeMenu === 'edit' ? 'semibold' : 'normal'}
              _hover={{ bg: '#27272A', color: 'white' }}>
              Edit
            </Button>
            {activeMenu === 'edit' && (
              <>
                                  <Box pos="fixed" inset={0} zIndex={999} onClick={() => setActiveMenu(null)} />
                <Box pos="absolute" left={0} top="100%" mt="4px" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000 }} w="220px" bg="#18181B" border="1px solid #3F3F46" boxShadow="0 10px 30px rgba(0,0,0,0.8)" rounded="md" py={1} zIndex={1000} display="flex" flexDir="column" fontSize="xs" color="#F4F4F5">
                  <Flex 
                    as="button"
                    id="edit-action-undo"
                    onClick={() => { undo(); setActiveMenu(null); }}
                    disabled={past.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={past.length === 0 ? 0.35 : 1}
                    cursor={past.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: past.length > 0 ? '#27272A' : 'transparent', color: past.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Undo</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+Z</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="edit-action-redo"
                    onClick={() => { redo(); setActiveMenu(null); }}
                    disabled={future.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={future.length === 0 ? 0.35 : 1}
                    cursor={future.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: future.length > 0 ? '#27272A' : 'transparent', color: future.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Redo</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+Y</Text>
                  </Flex>
                  <Box h="1px" bg="#3F3F46" my={1} />
                  <Flex 
                    as="button"
                    id="edit-action-cut"
                    onClick={() => { cutSelected(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: selectedIds.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Cut</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+X</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="edit-action-copy"
                    onClick={() => { copySelected(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: selectedIds.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Copy</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+C</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="edit-action-paste"
                    onClick={() => { pasteCopied(); setActiveMenu(null); }}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    cursor="pointer"
                    color="#F4F4F5"
                    _hover={{ bg: '#27272A', color: '#FFFFFF' }}>
                    <Text fontWeight="medium">Paste</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+V</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="edit-action-duplicate"
                    onClick={() => { duplicateSelected(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: selectedIds.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Duplicate</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+D</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="edit-action-delete"
                    onClick={() => { useStore.getState().removeSelected(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: selectedIds.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Delete</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1.5} py={0.5} rounded="sm" fontFamily="mono">⌫</Text>
                  </Flex>
                </Box>
              </>
            )}
          </Box>

          {/* View Menu */}
          <Box pos="relative" style={{ position: 'relative' }}>
            <Button 
              id="menu-view"
              onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
              onMouseEnter={() => { if (activeMenu && activeMenu !== 'view') setActiveMenu('view'); }}
              pos="relative"
              zIndex={activeMenu ? 1001 : undefined}
              size="xs" px={3} h="28px" fontSize="xs" rounded="md" variant="ghost"
              color={activeMenu === 'view' ? '#FFFFFF' : '#C7C4D6'}
              bg={activeMenu === 'view' ? '#3F3F46' : 'transparent'}
              fontWeight={activeMenu === 'view' ? 'semibold' : 'normal'}
              _hover={{ bg: '#27272A', color: 'white' }}>
              View
            </Button>
            {activeMenu === 'view' && (
              <>
                                  <Box pos="fixed" inset={0} zIndex={999} onClick={() => setActiveMenu(null)} />
                <Box pos="absolute" left={0} top="100%" mt="4px" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000 }} w="220px" bg="#18181B" border="1px solid #3F3F46" boxShadow="0 10px 30px rgba(0,0,0,0.8)" rounded="md" py={1} zIndex={1000} display="flex" flexDir="column" fontSize="xs" color="#F4F4F5">
                  <Flex 
                    as="button"
                    id="view-action-rulers"
                    onClick={() => { toggleRulers(); setActiveMenu(null); }}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    cursor="pointer"
                    color="#F4F4F5"
                    _hover={{ bg: '#27272A', color: '#FFFFFF' }}>
                    <Flex align="center" gap={1.5}>
                      {showRulers && <Check size={12} color="#818CF8" />}
                      <Text pl={showRulers ? 0 : '18px'} fontWeight="medium">View Rulers</Text>
                    </Flex>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">⇧R</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="view-action-wireframe"
                    onClick={() => { toggleWireframe(); setActiveMenu(null); }}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    cursor="pointer"
                    color="#F4F4F5"
                    _hover={{ bg: '#27272A', color: '#FFFFFF' }}>
                    <Flex align="center" gap={1.5}>
                      {showWireframe && <Check size={12} color="#818CF8" />}
                      <Text pl={showWireframe ? 0 : '18px'} fontWeight="medium">View Wireframe</Text>
                    </Flex>
                  </Flex>
                  <Flex 
                    as="button"
                    id="view-action-snap"
                    onClick={() => { toggleSnap(); setActiveMenu(null); }}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    cursor="pointer"
                    color="#F4F4F5"
                    _hover={{ bg: '#27272A', color: '#FFFFFF' }}>
                    <Flex align="center" gap={1.5}>
                      {snapEnabled && <Check size={12} color="#818CF8" />}
                      <Text pl={snapEnabled ? 0 : '18px'} fontWeight="medium">Snap (Guia Magnética)</Text>
                    </Flex>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">⇧S</Text>
                  </Flex>
                  <Box h="1px" bg="#3F3F46" my={1} />
                  <Flex 
                    as="button"
                    id="view-action-source"
                    onClick={() => { handleGenerateSource(); setActiveMenu(null); }}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    cursor="pointer"
                    color="#F4F4F5"
                    _hover={{ bg: '#27272A', color: '#FFFFFF' }}>
                    <Text pl="18px" fontWeight="medium">Source...</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+U</Text>
                  </Flex>
                </Box>
              </>
            )}
          </Box>

          {/* Object Menu */}
          <Box pos="relative" style={{ position: 'relative' }}>
            <Button 
              id="menu-object"
              onClick={() => setActiveMenu(activeMenu === 'object' ? null : 'object')}
              onMouseEnter={() => { if (activeMenu && activeMenu !== 'object') setActiveMenu('object'); }}
              pos="relative"
              zIndex={activeMenu ? 1001 : undefined}
              size="xs" px={3} h="28px" fontSize="xs" rounded="md" variant="ghost"
              color={activeMenu === 'object' ? '#FFFFFF' : '#C7C4D6'}
              bg={activeMenu === 'object' ? '#3F3F46' : 'transparent'}
              fontWeight={activeMenu === 'object' ? 'semibold' : 'normal'}
              _hover={{ bg: '#27272A', color: 'white' }}>
              Object
            </Button>
            {activeMenu === 'object' && (
              <>
                                  <Box pos="fixed" inset={0} zIndex={999} onClick={() => setActiveMenu(null)} />
                <Box pos="absolute" left={0} top="100%" mt="4px" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000 }} w="230px" bg="#18181B" border="1px solid #3F3F46" boxShadow="0 10px 30px rgba(0,0,0,0.8)" rounded="md" py={1} zIndex={1000} display="flex" flexDir="column" fontSize="xs" color="#F4F4F5">
                  <Flex 
                    as="button"
                    id="object-action-front"
                    onClick={() => { bringToFront(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: selectedIds.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Bring to Front</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+⇧↑</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="object-action-forward"
                    onClick={() => { bringForward(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: selectedIds.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Bring Forward</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+↑</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="object-action-backward"
                    onClick={() => { sendBackward(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: selectedIds.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Send Backward</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+↓</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="object-action-back"
                    onClick={() => { sendToBack(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: selectedIds.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Send to Back</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+⇧↓</Text>
                  </Flex>
                  <Box h="1px" bg="#3F3F46" my={1} />
                  <Flex 
                    as="button"
                    id="object-action-group"
                    onClick={() => { useStore.getState().groupShapes(); setActiveMenu(null); }}
                    disabled={selectedIds.length < 2}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length < 2 ? 0.35 : 1}
                    cursor={selectedIds.length >= 2 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length >= 2 ? '#27272A' : 'transparent', color: selectedIds.length >= 2 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Group Elements</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+G</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="object-action-ungroup"
                    onClick={() => { useStore.getState().ungroupShapes(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: selectedIds.length > 0 ? '#FFFFFF' : '#918F9F' }}>
                    <Text fontWeight="medium">Ungroup Elements</Text>
                    <Text fontSize="10px" color="#A1A1AA" bg="#27272A" border="1px solid #3F3F46" px={1} py={0.5} rounded="sm" fontFamily="mono">Ctrl+⇧G</Text>
                  </Flex>
                  <Box h="1px" bg="#3F3F46" my={1} />
                  <Flex 
                    as="button"
                    id="object-action-convert"
                    onClick={() => { convertToPath(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0 || !shapes.some(s => selectedIds.includes(s.id) && (s.type === 'rectangle' || s.type === 'ellipse'))}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: '#FFFFFF' }}>
                    <Text fontWeight="medium">Convert to Path</Text>
                  </Flex>
                  <Flex 
                    as="button"
                    id="object-action-reorient"
                    onClick={() => { reorientPath(); setActiveMenu(null); }}
                    disabled={selectedIds.length === 0 || !shapes.some(s => selectedIds.includes(s.id) && s.type === 'path')}
                    align="center" justify="space-between" px={3} py={1.5} w="full" textAlign="left"
                    opacity={selectedIds.length === 0 ? 0.35 : 1}
                    cursor={selectedIds.length > 0 ? "pointer" : "not-allowed"}
                    color="#F4F4F5"
                    _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: '#FFFFFF' }}>
                    <Text fontWeight="medium">Reorient path</Text>
                  </Flex>
                </Box>
              </>
            )}
          </Box>

          {/* About / credits */}
          <Box
            as="button"
            type="button"
            onClick={() => setAboutOpen(true)}
            title="Sobre o VectorWeb"
            aria-label="Sobre o VectorWeb"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="28px"
            h="28px"
            ml={1}
            rounded="md"
            color="#C7C4D6"
            _hover={{ bg: '#27272A', color: 'white' }}
            transition="all 0.15s"
          >
            <Info size={16} />
          </Box>

          {/* GitHub repository link */}
          <Box
            as="a"
            href="https://github.com/alexlimadsgn/vectorweb"
            target="_blank"
            rel="noopener noreferrer"
            title="Ver o código no GitHub"
            aria-label="Repositório no GitHub"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="28px"
            h="28px"
            ml={1}
            rounded="md"
            color="#C7C4D6"
            _hover={{ bg: '#27272A', color: 'white' }}
            transition="all 0.15s"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          </Box>
        </Flex>
      </Flex>

      <Flex id="actions-right" align="center" gap={2.5}>
        {/* Undo / Redo */}
        <Flex gap={1.5} mr={1}>
            <Box 
                as="button"
                id="hud-action-undo"
                onClick={undo} disabled={past.length === 0} 
                p={2} rounded="lg" border="1px solid" transition="all 0.15s"
                color={past.length > 0 ? '#E5E2E1' : '#666666'}
                bg={past.length > 0 ? '#27272A' : 'transparent'}
                borderColor={past.length > 0 ? '#3F3F4680' : '#27272A'}
                cursor={past.length > 0 ? 'pointer' : 'not-allowed'}
                opacity={past.length > 0 ? 1 : 0.4}
                _hover={{ bg: past.length > 0 ? '#323238' : 'transparent' }}
                title="Undo (Ctrl+Z)">
                <Undo2 size={15} />
            </Box>
            <Box 
                as="button"
                id="hud-action-redo"
                onClick={redo} disabled={future.length === 0} 
                p={2} rounded="lg" border="1px solid" transition="all 0.15s"
                color={future.length > 0 ? '#E5E2E1' : '#666666'}
                bg={future.length > 0 ? '#27272A' : 'transparent'}
                borderColor={future.length > 0 ? '#3F3F4680' : '#27272A'}
                cursor={future.length > 0 ? 'pointer' : 'not-allowed'}
                opacity={future.length > 0 ? 1 : 0.4}
                _hover={{ bg: future.length > 0 ? '#323238' : 'transparent' }}
                title="Redo (Ctrl+Y)">
                <Redo2 size={15} />
            </Box>
        </Flex>

        {/* Zoom Dropdown */}
        <Box pos="relative" style={{ position: 'relative' }}>
          <Box 
             as="button"
             id="zoom-dropdown-trigger"
             onClick={() => setZoomMenuOpen(!zoomMenuOpen)}
             display="flex" align="center" gap={2} px={3} py={1.5} bg={zoomMenuOpen ? "#3F3F46" : "#27272A"} rounded="md" border="1px solid" borderColor={zoomMenuOpen ? "#818CF8" : "#3F3F4680"} _hover={{ borderColor: '#818CF8' }} cursor="pointer" transition="all 0.15s" fontSize="xs" fontFamily="mono" color="#FFFFFF">
            <Text fontFamily="mono" fontSize="xs" color="#FFFFFF" w="40px" textAlign="right">{Math.round(viewport.transform.scale * 100)}%</Text>
            <ChevronDown size={14} color="#C7C4D6" />
          </Box>
          
          {zoomMenuOpen && (
             <>
                                <Box pos="fixed" inset={0} zIndex={999} onClick={() => setZoomMenuOpen(false)} />
               <Box pos="absolute" top="100%" right={0} mt="4px" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 1000 }} w="220px" border="1px solid #3F3F46" bg="#18181B" boxShadow="0 10px 30px rgba(0,0,0,0.8)" rounded="md" py={1.5} zIndex={1000} display="flex" flexDir="column" fontSize="xs" color="#F4F4F5">
                  <Flex as="button" onClick={() => { zoomIn(); setZoomMenuOpen(false); }} px={3} py={1.5} _hover={{ bg: '#27272A', color: 'white' }} textAlign="left" align="center" justify="space-between" w="full" cursor="pointer" color="#F4F4F5">
                      <Text fontWeight="medium">Zoom in</Text>
                      <Text color="#A1A1AA" fontSize="xs" fontFamily="mono">+</Text>
                  </Flex>
                  <Flex as="button" onClick={() => { zoomOut(); setZoomMenuOpen(false); }} px={3} py={1.5} _hover={{ bg: '#27272A', color: 'white' }} textAlign="left" align="center" justify="space-between" w="full" cursor="pointer" color="#F4F4F5">
                      <Text fontWeight="medium">Zoom out</Text>
                      <Text color="#A1A1AA" fontSize="xs" fontFamily="mono">-</Text>
                  </Flex>
                  <Box h="1px" bg="#3F3F46" my={1} />
                  <Flex as="button" onClick={() => { zoomTo100(); setZoomMenuOpen(false); }} px={3} py={1.5} _hover={{ bg: '#27272A', color: 'white' }} textAlign="left" align="center" justify="space-between" w="full" cursor="pointer" color="#F4F4F5">
                      <Text fontWeight="medium">Zoom to 100%</Text>
                      <Text color="#A1A1AA" fontSize="xs" fontFamily="mono">Shift + 0</Text>
                  </Flex>
                  <Flex as="button" onClick={() => { zoomToFit(); setZoomMenuOpen(false); }} px={3} py={1.5} _hover={{ bg: '#27272A', color: 'white' }} textAlign="left" align="center" justify="space-between" w="full" cursor="pointer" color="#F4F4F5">
                      <Text fontWeight="medium">Zoom to fit</Text>
                      <Text color="#A1A1AA" fontSize="xs" fontFamily="mono">Shift + 1</Text>
                  </Flex>
                  <Flex as="button" onClick={() => { zoomToSelection(); setZoomMenuOpen(false); }} px={3} py={1.5} _hover={{ bg: '#27272A', color: 'white' }} textAlign="left" align="center" justify="space-between" w="full" cursor="pointer" color="#F4F4F5">
                      <Text fontWeight="medium">Zoom to selection</Text>
                      <Text color="#A1A1AA" fontSize="xs" fontFamily="mono">Shift + 2</Text>
                  </Flex>
               </Box>
             </>
          )}
        </Box>

        {/* Export Dropdown */}
        <Box pos="relative" style={{ position: 'relative' }}>
          <Box
            as="button"
            id="export-dropdown-trigger"
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            bg="#818CF8"
            _hover={{ bg: '#6366F1' }}
            color="white"
            px={4}
            py={1.5}
            rounded="md"
            fontWeight="bold"
            fontSize="xs"
            _active={{ transform: 'scale(0.95)' }}
            transition="all 0.15s"
            display="flex"
            align="center"
            gap={2}
            cursor="pointer"
          >
            <Download size={15} />
            <Text>Exportar</Text>
            <ChevronDown size={12} style={{ transform: exportMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </Box>
          
          {exportMenuOpen && (
            <>
                              <Box pos="fixed" inset={0} zIndex={999} onClick={() => setExportMenuOpen(false)} />
              <Box
                pos="absolute"
                top="100%"
                right={0}
                mt="6px"
                style={{ position: 'absolute', top: '100%', right: 0, zIndex: 1000 }}
                w="240px"
                border="1px solid"
                borderColor="#3F3F46"
                bg="#18181B"
                boxShadow="0 10px 30px rgba(0,0,0,0.8)"
                rounded="lg"
                py={1.5}
                display="flex"
                flexDir="column"
                fontSize="xs"
              >
                 <Box
                   as="button"
                   onClick={() => { handleExport(false); setExportMenuOpen(false); }}
                   px={3.5}
                   py={2}
                   textAlign="left"
                   color="#F4F4F5"
                   fontWeight="medium"
                   cursor="pointer"
                   transition="all 0.15s"
                   _hover={{ bg: '#27272A', color: '#818CF8' }}
                   display="flex"
                   align="center"
                   justify="space-between"
                 >
                     <Text>Exportar tudo (SVG Estático)</Text>
                 </Box>
                 
                 <Box
                   as="button"
                   onClick={() => { handleExport(true); setExportMenuOpen(false); }}
                   disabled={selectedIds.length === 0}
                   px={3.5}
                   py={2}
                   textAlign="left"
                   color="#F4F4F5"
                   fontWeight="medium"
                   opacity={selectedIds.length === 0 ? 0.35 : 1}
                   cursor={selectedIds.length === 0 ? 'not-allowed' : 'pointer'}
                   transition="all 0.15s"
                   _hover={{ bg: selectedIds.length > 0 ? '#27272A' : 'transparent', color: selectedIds.length > 0 ? '#818CF8' : '#918F9F' }}
                   display="flex"
                   align="center"
                   justify="space-between"
                 >
                     <Text>Exportar seleção (SVG Estático)</Text>
                 </Box>

                 <Box h="1px" bg="#3F3F46" my={1.5} />

                 <Box
                   as="button"
                   onClick={() => { setVideoDialogOpen(true); setExportMenuOpen(false); }}
                   px={3.5}
                   py={2}
                   textAlign="left"
                   color="#F4F4F5"
                   fontWeight="bold"
                   cursor="pointer"
                   transition="all 0.15s"
                   _hover={{ bg: '#27272A', color: '#818CF8' }}
                   display="flex"
                   align="center"
                   justify="space-between"
                 >
                   <Text color="inherit">Exportar vídeo (MP4)</Text>
                 </Box>

                 <Box
                   as="button"
                   onClick={() => {
                     const state = useStore.getState();
                     exportLottie(state.shapes, state.animations, state.duration);
                     setExportMenuOpen(false);
                   }}
                   px={3.5}
                   py={2}
                   textAlign="left"
                   color="#F4F4F5"
                   fontWeight="bold"
                   cursor="pointer"
                   transition="all 0.15s"
                   _hover={{ bg: '#27272A', color: '#818CF8' }}
                 >
                   <Text color="inherit">Lottie Json</Text>
                 </Box>

                 <Box
                   as="button"
                   onClick={() => {
                     const state = useStore.getState();
                     exportAnimatedSvg(state.shapes, state.animations, state.duration, state.isLooping, false, state.selectedIds);
                     setExportMenuOpen(false);
                   }}
                   px={3.5}
                   py={2}
                   textAlign="left"
                   color="#818CF8"
                   fontWeight="bold"
                   cursor="pointer"
                   transition="all 0.15s"
                   _hover={{ bg: '#818CF820', color: '#A5B4FC' }}
                   display="flex"
                   align="center"
                   justify="space-between"
                 >
                   <Text color="inherit">Exportar SVG Animado</Text>
                   <Badge bg="#581C87" color="#E9D5FF" fontSize="9px" px={1.5} py={0.5} rounded="md" fontFamily="mono">
                     NOVO
                   </Badge>
                 </Box>
              </Box>
            </>
          )}
        </Box>
      </Flex>

      {videoDialogOpen && <ExportVideoDialog onClose={() => setVideoDialogOpen(false)} />}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}

      {/* SVG Source code modal viewer */}
      {sourceModalOpen && (
        <Box id="source-code-modal" pos="fixed" inset={0} zIndex={9999} display="flex" align="center" justify="center" bg="blackAlpha.600" backdropFilter="blur(4px)">
          <Box bg="#18181B" border="1px solid" borderColor="#3F3F4680" rounded="lg" w="600px" maxW="full" m={4} display="flex" flexDir="column" overflow="hidden" maxH="80vh">
            <Flex px={4} py={3} borderBottom="1px solid #2D2D30" align="center" justify="space-between">
              <Flex align="center" gap={1.5} fontWeight="bold" fontSize="sm" color="#E5E2E1">
                <Code size={16} color="#818CF8" />
                SVG Document Source Code
              </Flex>
              <Box as="button" fontSize="lg" color="#C7C4D6" _hover={{ color: 'white' }} p={1} onClick={() => setSourceModalOpen(false)}>×</Box>
            </Flex>
            <Box p={4} overflowY="auto" maxH="50vh">
              <Box as="pre" p={3} bg="#121214" color="#A78BFA" border="1px solid #2D2D30" rounded="lg" fontSize="xs" overflowX="auto" fontFamily="mono" whiteSpace="pre-wrap" userSelect="all">
                {sourceCode}
              </Box>
            </Box>
            <Flex px={4} py={3} bg="#151516" borderTop="1px solid #2D2D30" align="center" justify="flex-end" gap={3}>
              <Button 
                id="btn-copy-svg"
                onClick={handleCopySource}
                bg="#818CF8" _hover={{ bg: '#6366F1' }} color="white" fontSize="xs" fontWeight="bold" py={1.5} px={4} rounded="lg" transition="all 0.15s">
                {copiedFeedback ? "Copiado!" : "Copy SVG Code"}
              </Button>
              <Button 
                id="btn-close-svg"
                onClick={() => setSourceModalOpen(false)}
                border="1px solid #2D2D30" color="#C7C4D6" _hover={{ bg: '#2D2D30', color: 'white' }} transition="all 0.15s" py={1.5} px={4} rounded="lg" fontSize="xs" bg="transparent">
                Fechar
              </Button>
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
    </>
  );
}
