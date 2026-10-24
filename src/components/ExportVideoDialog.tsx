import React, { useMemo, useRef, useState } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { Film, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { exportMp4, isMp4ExportSupported } from '../lib/exportMp4';
import { getExportRegion } from '../lib/renderFrame';

const FPS_OPTIONS = [24, 30, 60];
const SCALE_OPTIONS = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
];
const QUALITY_OPTIONS: { value: 'low' | 'medium' | 'high'; label: string }[] = [
  { value: 'low', label: 'Leve' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
];

function Segmented<T extends string | number>({ options, value, onChange, disabled }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <Flex bg="#121214" border="1px solid #2D2D30" rounded="md" p="2px" gap="2px">
      {options.map(o => (
        <Box
          key={String(o.value)}
          as="button"
          flex={1}
          py={1.5}
          fontSize="xs"
          fontWeight="semibold"
          rounded="sm"
          disabled={disabled}
          bg={value === o.value ? '#818CF8' : 'transparent'}
          color={value === o.value ? 'white' : '#C7C4D6'}
          _hover={{ bg: value === o.value ? '#818CF8' : '#27272A' }}
          transition="all 0.15s"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Box>
      ))}
    </Flex>
  );
}

export default function ExportVideoDialog({ onClose }: { onClose: () => void }) {
  const shapes = useStore(s => s.shapes);
  const duration = useStore(s => s.duration);
  const [fps, setFps] = useState(30);
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const region = useMemo(() => getExportRegion(shapes), [shapes]);
  const outW = Math.round((region.width * scale) / 2) * 2;
  const outH = Math.round((region.height * scale) / 2) * 2;
  const isExporting = progress !== null;
  const supported = isMp4ExportSupported();

  const handleExport = async () => {
    const { shapes, animations, duration } = useStore.getState();
    setError(null);
    setProgress(0);
    abortRef.current = new AbortController();
    try {
      const blob = await exportMp4(shapes, animations, duration, {
        fps,
        scale,
        quality,
        onProgress: setProgress,
        signal: abortRef.current.signal,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vectorweb-${fps}fps.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Falha ao exportar o vídeo.');
      setProgress(null);
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  return (
    <Box pos="fixed" inset={0} zIndex={9999} display="flex" alignItems="center" justifyContent="center" bg="blackAlpha.600" backdropFilter="blur(4px)">
      <Box bg="#18181B" border="1px solid #3F3F4680" rounded="lg" w="360px" maxW="calc(100vw - 32px)" overflow="hidden">
        <Flex px={4} py={3} borderBottom="1px solid #2D2D30" align="center" justify="space-between">
          <Flex align="center" gap={2} fontWeight="bold" fontSize="sm" color="#E5E2E1">
            <Film size={16} color="#818CF8" />
            Exportar vídeo MP4
          </Flex>
          <Box as="button" color="#C7C4D6" _hover={{ color: 'white' }} onClick={handleClose} aria-label="Fechar">
            <X size={16} />
          </Box>
        </Flex>

        <Flex direction="column" gap={3.5} p={4}>
          <Box>
            <Text fontSize="11px" color="#918F9F" mb={1.5}>Taxa de quadros</Text>
            <Segmented options={FPS_OPTIONS.map(f => ({ value: f, label: `${f} fps` }))} value={fps} onChange={setFps} disabled={isExporting} />
          </Box>
          <Box>
            <Text fontSize="11px" color="#918F9F" mb={1.5}>Resolução</Text>
            <Segmented options={SCALE_OPTIONS} value={scale} onChange={setScale} disabled={isExporting} />
          </Box>
          <Box>
            <Text fontSize="11px" color="#918F9F" mb={1.5}>Qualidade</Text>
            <Segmented options={QUALITY_OPTIONS} value={quality} onChange={setQuality} disabled={isExporting} />
          </Box>

          <Flex justify="space-between" fontSize="11px" color="#A1A1AA" fontFamily="mono" bg="#121214" rounded="md" px={3} py={2}>
            <Text>{outW}×{outH}</Text>
            <Text>{duration.toFixed(1)}s</Text>
            <Text>{Math.max(1, Math.round(duration * fps))} quadros</Text>
          </Flex>

          {!supported && (
            <Text fontSize="xs" color="#F87171">Seu navegador não suporta WebCodecs. Use Chrome, Edge ou Safari recente.</Text>
          )}
          {error && <Text fontSize="xs" color="#F87171">{error}</Text>}

          {isExporting && (
            <Box>
              <Box h="6px" bg="#27272A" rounded="full" overflow="hidden">
                <Box h="full" bg="#818CF8" w={`${Math.round(progress! * 100)}%`} transition="width 0.1s" />
              </Box>
              <Text fontSize="11px" color="#A1A1AA" mt={1}>Renderizando… {Math.round(progress! * 100)}%</Text>
            </Box>
          )}
        </Flex>

        <Flex px={4} py={3} bg="#151516" borderTop="1px solid #2D2D30" justify="flex-end" gap={2}>
          <Button onClick={handleClose} bg="transparent" border="1px solid #2D2D30" color="#C7C4D6" _hover={{ bg: '#2D2D30', color: 'white' }} size="sm" fontSize="xs">
            {isExporting ? 'Cancelar' : 'Fechar'}
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !supported} bg="#818CF8" _hover={{ bg: '#6366F1' }} color="white" size="sm" fontSize="xs" fontWeight="bold">
            Exportar MP4
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}
