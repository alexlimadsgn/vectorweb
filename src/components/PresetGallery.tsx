import React from 'react';
import { Box, Flex, Grid, Text } from '@chakra-ui/react';
import { useStore } from '../store/useStore';

interface Preset {
  name: string;
  label: string;
  // CSS keyframes body used by the live thumbnail preview
  keyframes: string;
  easing: string;
}

const CATEGORIES: { title: string; presets: Preset[] }[] = [
  {
    title: 'Entrada',
    presets: [
      { name: 'Fade In', label: 'Fade', easing: 'ease-in-out', keyframes: 'from{opacity:0}to{opacity:1}' },
      { name: 'Slide Right', label: 'Slide', easing: 'cubic-bezier(.16,1,.3,1)', keyframes: 'from{transform:translateX(-22px);opacity:0}to{transform:none;opacity:1}' },
      { name: 'Rise', label: 'Subir', easing: 'cubic-bezier(.16,1,.3,1)', keyframes: 'from{transform:translateY(18px);opacity:0}to{transform:none;opacity:1}' },
      { name: 'Grow', label: 'Crescer', easing: 'cubic-bezier(.33,1,.68,1)', keyframes: 'from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}' },
      { name: 'Pop', label: 'Pop', easing: 'linear', keyframes: '0%{transform:scale(.2)}40%{transform:scale(1.18)}60%{transform:scale(.94)}80%{transform:scale(1.03)}100%{transform:scale(1)}' },
      { name: 'Zoom', label: 'Zoom', easing: 'cubic-bezier(.16,1,.3,1)', keyframes: 'from{transform:scale(2.2);opacity:0}to{transform:scale(1);opacity:1}' },
      { name: 'Drop', label: 'Quicar', easing: 'linear', keyframes: '0%{transform:translateY(-24px)}50%{transform:translateY(0)}65%{transform:translateY(-8px)}80%{transform:translateY(0)}90%{transform:translateY(-3px)}100%{transform:translateY(0)}' },
      { name: 'Spin In', label: 'Girar', easing: 'cubic-bezier(.34,1.56,.64,1)', keyframes: 'from{transform:rotate(-180deg) scale(0)}to{transform:none}' },
    ],
  },
  {
    title: 'Ênfase',
    presets: [
      { name: 'Pulse', label: 'Pulsar', easing: 'ease-in-out', keyframes: '0%,100%{transform:scale(1)}50%{transform:scale(1.15)}' },
      { name: 'Wiggle', label: 'Balançar', easing: 'ease-in-out', keyframes: '0%,100%{transform:rotate(0)}20%{transform:rotate(-12deg)}40%{transform:rotate(10deg)}60%{transform:rotate(-6deg)}80%{transform:rotate(3deg)}' },
      { name: 'Float', label: 'Flutuar', easing: 'ease-in-out', keyframes: '0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}' },
      { name: 'Spin', label: 'Rodar 360°', easing: 'linear', keyframes: 'from{transform:rotate(0)}to{transform:rotate(360deg)}' },
    ],
  },
  {
    title: 'Saída',
    presets: [
      { name: 'Fade Out', label: 'Sumir', easing: 'ease-in-out', keyframes: 'from{opacity:1}to{opacity:0}' },
      { name: 'Scale Out', label: 'Encolher', easing: 'cubic-bezier(.32,0,.67,0)', keyframes: 'from{transform:scale(1);opacity:1}to{transform:scale(0);opacity:0}' },
      { name: 'Slide Out', label: 'Sair', easing: 'cubic-bezier(.7,0,.84,0)', keyframes: 'from{transform:none;opacity:1}to{transform:translateX(22px);opacity:0}' },
    ],
  },
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const previewCss = CATEGORIES.flatMap(c => c.presets)
  .map(p => `@keyframes vw-preset-${slug(p.name)}{${p.keyframes}}`)
  .join('\n');

export default function PresetGallery({ shapeId }: { shapeId: string }) {
  const applyPresetAnimation = useStore(s => s.applyPresetAnimation);

  return (
    <Box>
      <style>{previewCss}</style>
      {CATEGORIES.map(category => (
        <Box key={category.title} mb={3}>
          <Text fontSize="10px" fontWeight="semibold" color="#918F9F" mb={1.5}>
            {category.title}
          </Text>
          <Grid templateColumns="repeat(3, 1fr)" gap={1.5}>
            {category.presets.map(preset => (
              <Flex
                key={preset.name}
                as="button"
                onClick={() => applyPresetAnimation(shapeId, preset.name)}
                title={`Aplicar "${preset.label}"`}
                flexDir="column"
                align="center"
                gap={1}
                p={1.5}
                bg="#1F1F23"
                border="1px solid"
                borderColor="#3F3F4680"
                rounded="md"
                transition="all 0.15s"
                _hover={{ bg: '#27272A', borderColor: '#818CF8' }}
                _active={{ transform: 'scale(0.96)' }}
                role="group"
              >
                <Flex w="full" h="40px" align="center" justify="center" bg="#121214" rounded="sm" overflow="hidden">
                  <Box
                    w="14px"
                    h="14px"
                    rounded="3px"
                    bg="#818CF8"
                    style={{
                      animation: `vw-preset-${slug(preset.name)} 1.4s ${preset.easing} infinite`,
                      animationDelay: '0.2s',
                    }}
                  />
                </Flex>
                <Text fontSize="10px" color="#C7C4D6" _groupHover={{ color: 'white' }} lineClamp={1}>
                  {preset.label}
                </Text>
              </Flex>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
