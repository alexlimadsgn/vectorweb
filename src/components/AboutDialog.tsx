import React, { useEffect } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { X } from 'lucide-react';

const HANDLE = 'alexlimadsgn';

const LINKS = [
  {
    label: 'Instagram',
    href: `https://www.instagram.com/${HANDLE}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: `https://www.youtube.com/@${HANDLE}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="4" />
        <path d="m10 9 5 3-5 3z" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/alexlimadsgn/vectorweb',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    ),
  },
];

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Box
      pos="fixed"
      inset={0}
      zIndex={9999}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="blackAlpha.600"
      backdropFilter="blur(4px)"
      onClick={onClose}
    >
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        bg="#18181B"
        border="1px solid #3F3F4680"
        rounded="xl"
        w="340px"
        maxW="calc(100vw - 32px)"
        p={6}
        pos="relative"
        textAlign="center"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <Box
          as="button"
          pos="absolute"
          top={3}
          right={3}
          color="#A1A1AA"
          _hover={{ color: 'white' }}
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={16} />
        </Box>

        <Flex justify="center" align="center" gap={2} mb={1}>
          <Box w="10px" h="10px" rounded="full" bg="#818CF8" />
          <Text id="about-title" fontWeight="bold" fontSize="lg" color="white">VectorWeb</Text>
        </Flex>
        <Text fontSize="xs" color="#A1A1AA" mb={5}>
          Editor de animações vetoriais no navegador.
        </Text>

        <Text fontSize="sm" color="#E5E2E1">
          Desenvolvido por <Text as="span" fontWeight="bold" color="white">Alex Lima</Text>
        </Text>
        <Text fontSize="xs" color="#818CF8" mb={5}>@{HANDLE}</Text>

        <Flex direction="column" gap={2}>
          {LINKS.map(link => (
            <Flex
              key={link.label}
              as="a"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              align="center"
              gap={3}
              px={3}
              py={2.5}
              rounded="lg"
              bg="#27272A"
              color="#E5E2E1"
              fontSize="sm"
              _hover={{ bg: '#323238', color: 'white' }}
              transition="all 0.15s"
            >
              {link.icon}
              <Text flex={1} textAlign="left">{link.label}</Text>
              <Text fontSize="xs" color="#8B8A97">
                {link.label === 'GitHub' ? 'Código aberto · MIT' : `@${HANDLE}`}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}
