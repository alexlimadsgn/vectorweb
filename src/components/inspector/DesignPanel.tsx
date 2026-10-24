import React from 'react';
import { Box, Flex, Text, Slider } from '@chakra-ui/react';
import { Lock, Unlock, Minus, Plus, RotateCw } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { BaseShape } from '../../types';
import CustomColorPicker from '../CustomColorPicker';
import { NumField, Section, IconButton, Segmented, AnchorPicker, KeyframeButton } from './fields';

type AlignType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

const ALIGN_ICONS: { type: AlignType; title: string; path: React.ReactNode }[] = [
  { type: 'left', title: 'Alinhar à esquerda', path: <><path d="M3 3v18" /><rect x="7" y="6" width="12" height="4" rx="1" /><rect x="7" y="14" width="7" height="4" rx="1" /></> },
  { type: 'center', title: 'Centralizar na horizontal', path: <><path d="M12 3v18" /><rect x="5" y="6" width="14" height="4" rx="1" /><rect x="8" y="14" width="8" height="4" rx="1" /></> },
  { type: 'right', title: 'Alinhar à direita', path: <><path d="M21 3v18" /><rect x="5" y="6" width="12" height="4" rx="1" /><rect x="10" y="14" width="7" height="4" rx="1" /></> },
  { type: 'top', title: 'Alinhar ao topo', path: <><path d="M3 3h18" /><rect x="6" y="7" width="4" height="12" rx="1" /><rect x="14" y="7" width="4" height="7" rx="1" /></> },
  { type: 'middle', title: 'Centralizar na vertical', path: <><path d="M3 12h18" /><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="8" width="4" height="8" rx="1" /></> },
  { type: 'bottom', title: 'Alinhar à base', path: <><path d="M3 21h18" /><rect x="6" y="5" width="4" height="12" rx="1" /><rect x="14" y="10" width="4" height="7" rx="1" /></> },
];

const svgIcon = (children: React.ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const TYPE_LABEL: Record<string, string> = {
  rectangle: 'Retângulo', ellipse: 'Elipse', path: 'Caminho', group: 'Grupo', frame: 'Frame', image: 'Imagem',
};

const AddRemove = ({ active, onAdd, onRemove, what }: { active: boolean; onAdd: () => void; onRemove: () => void; what: string }) => (
  <IconButton size={22} title={active ? `Remover ${what}` : `Adicionar ${what}`} onClick={active ? onRemove : onAdd}>
    {active ? <Minus size={13} /> : <Plus size={13} />}
  </IconButton>
);

export default function DesignPanel({
  shape,
  handleChange,
  commitChange,
  handleAlign,
  ratioLocked,
  setRatioLocked,
}: {
  shape: BaseShape;
  handleChange: (field: string, value: string | number | boolean) => void;
  commitChange: () => void;
  handleAlign: (type: AlignType) => void;
  ratioLocked: boolean;
  setRatioLocked: (v: boolean) => void;
}) {
  const selectedIds = useStore((s) => s.selectedIds);
  const updateShape = useStore((s) => s.updateShape);
  const pushHistory = useStore((s) => s.pushHistory);

  const updateAll = (partial: Partial<BaseShape>) => {
    pushHistory();
    selectedIds.forEach(id => updateShape(id, partial));
  };

  const kf = (property: Parameters<typeof KeyframeButton>[0]['property']) => ({ shapeId: shape.id, property });
  const hasFill = !!shape.fill && shape.fill !== 'transparent';
  const hasStroke = shape.stroke !== 'transparent' && shape.strokeWidth > 0;
  const hasShadow = !!shape.shadowColor && shape.shadowColor !== 'transparent';
  const canRound = shape.type === 'rectangle' || shape.type === 'frame';
  const maxRadius = Math.min(Math.abs(shape.width), Math.abs(shape.height)) / 2;

  return (
    <Box>
      <Flex align="center" justify="space-between" mb={1}>
        <Text fontSize="xs" fontWeight="semibold" color="white" truncate>
          {shape.name || TYPE_LABEL[shape.type] || shape.type}
        </Text>
        <Text fontSize="10px" color="#8B8A97">{TYPE_LABEL[shape.type] || shape.type}</Text>
      </Flex>

      {selectedIds.length > 1 && (
        <Section title="Alinhar">
          <Flex justify="space-between" bg="#27272A" rounded="md" p="2px">
            {ALIGN_ICONS.map(a => (
              <IconButton key={a.type} title={a.title} onClick={() => handleAlign(a.type)} size={30}>
                {svgIcon(a.path)}
              </IconButton>
            ))}
          </Flex>
        </Section>
      )}

      <Section title="Posição">
        <Flex gap={2}>
          <NumField label="X" value={Math.round(shape.x)} onChange={v => handleChange('x', v)} onCommit={commitChange} keyframe={kf('x')} />
          <NumField label="Y" value={Math.round(shape.y)} onChange={v => handleChange('y', v)} onCommit={commitChange} keyframe={kf('y')} />
          <AnchorPicker
            anchorX={shape.anchorX ?? 0.5}
            anchorY={shape.anchorY ?? 0.5}
            manual={!!shape.editAnchorManual}
            onSelect={(anchor) => { handleChange('anchor', anchor); commitChange(); }}
            onToggleManual={() => { handleChange('editAnchorManual', !shape.editAnchorManual); commitChange(); }}
          />
        </Flex>
        <Flex gap={2}>
          <NumField
            label={<RotateCw size={11} />}
            title="Rotação (arraste o ícone para girar)"
            value={Math.round(shape.rotation || 0)}
            suffix="°"
            onChange={v => handleChange('rotation', v)}
            onCommit={commitChange}
            keyframe={kf('rotation')}
          />
          {canRound ? (
            <NumField
              label={svgIcon(<path d="M4 20V10a6 6 0 0 1 6-6h10" />)}
              title="Raio dos cantos"
              value={Math.round(shape.radius || 0)}
              min={0}
              max={maxRadius}
              onChange={v => handleChange('radius', v)}
              onCommit={commitChange}
              keyframe={kf('radius')}
            />
          ) : <Box flex={1} />}
          <Box w="28px" flexShrink={0} />
        </Flex>
      </Section>

      <Section title="Tamanho">
        <Flex gap={2}>
          <NumField label="L" title="Largura" value={Math.round(shape.width)} onChange={v => handleChange('width', v)} onCommit={commitChange} keyframe={kf('width')} />
          <NumField label="A" title="Altura" value={Math.round(shape.height)} onChange={v => handleChange('height', v)} onCommit={commitChange} keyframe={kf('height')} />
          <Box
            as="button"
            type="button"
            onClick={() => setRatioLocked(!ratioLocked)}
            title={ratioLocked ? 'Proporção travada' : 'Travar proporção'}
            w="28px" h="28px" flexShrink={0} rounded="md"
            display="flex" alignItems="center" justifyContent="center"
            color={ratioLocked ? '#818CF8' : '#8B8A97'}
            bg={ratioLocked ? '#818CF826' : 'transparent'}
            _hover={{ color: 'white', bg: '#27272A' }}
          >
            {ratioLocked ? <Lock size={13} /> : <Unlock size={13} />}
          </Box>
        </Flex>
      </Section>

      <Section title="Opacidade">
        <Flex align="center" gap={2}>
          <Slider.Root
            flex={1}
            value={[Math.round((shape.opacity ?? 1) * 100)]}
            min={0}
            max={100}
            step={1}
            onValueChange={(d) => handleChange('opacity', d.value[0] / 100)}
            onValueChangeEnd={commitChange}
          >
            <Slider.Control cursor="pointer" h="20px" display="flex" alignItems="center">
              <Slider.Track bg="#27272A" h="4px" rounded="full" flex={1}>
                <Slider.Range bg="#818CF8" />
              </Slider.Track>
              <Slider.Thumbs>
                <Slider.Thumb index={0} boxSize="12px" bg="white" rounded="full" />
              </Slider.Thumbs>
            </Slider.Control>
          </Slider.Root>
          <Box w="76px" flexShrink={0}>
            <NumField
              label="%"
              value={Math.round((shape.opacity ?? 1) * 100)}
              min={0}
              max={100}
              onChange={v => handleChange('opacity', v / 100)}
              onCommit={commitChange}
              keyframe={kf('opacity')}
            />
          </Box>
        </Flex>
      </Section>

      <Section
        title="Preenchimento"
        action={<AddRemove what="preenchimento" active={hasFill} onAdd={() => updateAll({ fill: '#818CF8' })} onRemove={() => updateAll({ fill: 'transparent' })} />}
      >
        {hasFill && (
          <Flex align="center" justify="space-between" gap={2}>
            <CustomColorPicker color={shape.fill} label="Cor de preenchimento" onChange={(v) => handleChange('fill', v)} onCommit={commitChange} />
            <KeyframeButton shapeId={shape.id} property="fill" value={shape.fill} attached={false} />
          </Flex>
        )}
      </Section>

      <Section
        title="Contorno"
        action={<AddRemove what="contorno" active={hasStroke} onAdd={() => updateAll({ stroke: '#18181B', strokeWidth: 2 })} onRemove={() => updateAll({ stroke: 'transparent', strokeWidth: 0 })} />}
      >
        {hasStroke && (
          <>
            <Flex align="center" justify="space-between" gap={2}>
              <CustomColorPicker color={shape.stroke} label="Cor do contorno" onChange={(v) => handleChange('stroke', v)} onCommit={commitChange} />
              <KeyframeButton shapeId={shape.id} property="stroke" value={shape.stroke} attached={false} />
            </Flex>
            <Flex gap={2}>
              <NumField
                label={svgIcon(<><path d="M4 7h16" strokeWidth="1.5" /><path d="M4 13h16" strokeWidth="3" /><path d="M4 19h16" strokeWidth="4.5" /></>)}
                title="Espessura"
                value={shape.strokeWidth}
                min={0}
                step={0.5}
                onChange={v => handleChange('strokeWidth', v)}
                onCommit={commitChange}
                keyframe={kf('strokeWidth')}
              />
              <Segmented
                value={shape.strokeCap || (shape.type === 'path' ? 'round' : 'butt')}
                onChange={(v) => updateAll({ strokeCap: v })}
                options={[
                  { value: 'butt', title: 'Ponta reta', icon: svgIcon(<><path d="M8 6v12" strokeLinecap="butt" strokeWidth="5" /><path d="M14 12h6" /></>) },
                  { value: 'round', title: 'Ponta arredondada', icon: svgIcon(<><path d="M8 7v10" strokeLinecap="round" strokeWidth="5" /><path d="M14 12h6" /></>) },
                  { value: 'square', title: 'Ponta quadrada', icon: svgIcon(<rect x="5" y="5" width="7" height="14" fill="currentColor" stroke="none" />) },
                ]}
              />
            </Flex>
            <Flex gap={2}>
              <NumField
                label={svgIcon(<path d="M3 12h4M10 12h4M17 12h4" />)}
                title="Tracejado (comprimento do traço, 0 = contínuo)"
                value={shape.strokeDash || 0}
                min={0}
                onChange={v => handleChange('strokeDash', v)}
                onCommit={commitChange}
              />
              <NumField
                label={svgIcon(<><path d="M4 12h3M17 12h3" /><path d="M10 9v6M14 9v6" strokeWidth="1.5" /></>)}
                title="Espaço entre traços"
                value={shape.strokeGap ?? shape.strokeDash ?? 0}
                min={0}
                onChange={v => handleChange('strokeGap', v)}
                onCommit={commitChange}
              />
              <Box w="28px" flexShrink={0} />
            </Flex>
            <Segmented
              value={shape.strokeJoin || (shape.type === 'path' ? 'round' : 'miter')}
              onChange={(v) => updateAll({ strokeJoin: v })}
              options={[
                { value: 'miter', title: 'Junção em quina', icon: svgIcon(<path d="M5 19V5h14" strokeLinejoin="miter" strokeWidth="3" />) },
                { value: 'round', title: 'Junção arredondada', icon: svgIcon(<path d="M5 19V5h14" strokeLinejoin="round" strokeWidth="3" />) },
                { value: 'bevel', title: 'Junção chanfrada', icon: svgIcon(<path d="M5 19V5h14" strokeLinejoin="bevel" strokeWidth="3" />) },
              ]}
            />
          </>
        )}
      </Section>

      <Section
        title="Sombra"
        action={<AddRemove what="sombra" active={hasShadow} onAdd={() => updateAll({ shadowColor: '#000000', shadowOpacity: 35, shadowBlur: 16, shadowX: 0, shadowY: 8 })} onRemove={() => updateAll({ shadowColor: undefined })} />}
      >
        {hasShadow && (
          <>
            <Flex align="center" gap={2}>
              <CustomColorPicker color={shape.shadowColor!} label="Cor da sombra" onChange={(v) => handleChange('shadowColor', v)} onCommit={commitChange} />
              <Box w="72px" flexShrink={0} ml="auto">
                <NumField label="%" title="Opacidade da sombra" value={shape.shadowOpacity ?? 100} min={0} max={100} onChange={v => handleChange('shadowOpacity', v)} onCommit={commitChange} />
              </Box>
            </Flex>
            <Flex gap={2}>
              <NumField label="X" value={shape.shadowX ?? 0} onChange={v => handleChange('shadowX', v)} onCommit={commitChange} />
              <NumField label="Y" value={shape.shadowY ?? 0} onChange={v => handleChange('shadowY', v)} onCommit={commitChange} />
              <NumField label="Desf." title="Desfoque" value={shape.shadowBlur ?? 0} min={0} onChange={v => handleChange('shadowBlur', v)} onCommit={commitChange} />
            </Flex>
          </>
        )}
      </Section>
    </Box>
  );
}
