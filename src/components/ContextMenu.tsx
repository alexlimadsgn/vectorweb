import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Flex, Text, Portal } from '@chakra-ui/react';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isOpen,
  onClose,
  items
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);

  const [adjustedPos, setAdjustedPos] = useState(() => ({
    left: Math.max(10, Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 220)),
    top: Math.max(10, Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 1000) - 300))
  }));

  const [prevCoords, setPrevCoords] = useState({ x, y });
  if (prevCoords.x !== x || prevCoords.y !== y) {
    setPrevCoords({ x, y });
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const winHeight = typeof window !== 'undefined' ? window.innerHeight : 1000;
    setAdjustedPos({
      left: Math.max(10, Math.min(x, winWidth - 220)),
      top: Math.max(10, Math.min(y, winHeight - 300))
    });
  }

  useLayoutEffect(() => {
    if (isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      let newLeft = x;
      let newTop = y;

      if (x + rect.width > winWidth - 10) {
        newLeft = winWidth - rect.width - 10;
      }
      if (y + rect.height > winHeight - 10) {
        newTop = winHeight - rect.height - 10;
      }

      setAdjustedPos({
        left: Math.max(10, newLeft),
        top: Math.max(10, newTop)
      });
    }
  }, [x, y, isOpen, items]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Portal>
      {/* Invisible backdrop to dismiss menu */}
      <Box
        pos="fixed"
        inset={0}
        zIndex={9990}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Main Context Menu Box */}
      <Box
        ref={menuRef}
        pos="fixed"
        left={`${adjustedPos.left}px`}
        top={`${adjustedPos.top}px`}
        zIndex={9991}
        bg="#18181B"
        border="1px solid"
        borderColor="#3F3F46"
        rounded="lg"
        p={1.5}
        minW="210px"
        boxShadow="0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 4px 12px -2px rgba(0, 0, 0, 0.4)"
        userSelect="none"
        animation="fadeIn 0.12s ease-out"
        sx={{
          '@keyframes fadeIn': {
            '0%': { opacity: 0, transform: 'scale(0.96)' },
            '100%': { opacity: 1, transform: 'scale(1)' }
          }
        }}
      >
        <Flex flexDir="column" gap={0.5}>
          {items.map((item, index) => {
            if (item.divider) {
              return <Box key={`divider-${index}`} h="1px" bg="#3F3F4680" my={1} mx={1} />;
            }

            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const isSubmenuOpen = activeSubmenuId === item.id;

            return (
              <Box
                key={item.id}
                pos="relative"
                onMouseEnter={() => {
                  if (hasSubmenu) {
                    setActiveSubmenuId(item.id);
                  } else {
                    setActiveSubmenuId(null);
                  }
                }}
              >
                <Flex
                  as="button"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    if (item.onClick) {
                      item.onClick();
                      onClose();
                    }
                  }}
                  align="center"
                  justify="space-between"
                  w="full"
                  px={2.5}
                  py={1.5}
                  rounded="md"
                  fontSize="12px"
                  fontWeight="medium"
                  cursor={item.disabled ? 'not-allowed' : 'pointer'}
                  opacity={item.disabled ? 0.4 : 1}
                  transition="all 0.1s"
                  bg={
                    isSubmenuOpen
                      ? item.danger ? '#EF444426' : '#27272A'
                      : 'transparent'
                  }
                  color={
                    item.danger ? '#F87171' : 'white'
                  }
                  _hover={
                    item.disabled
                      ? {}
                      : {
                          bg: item.danger ? '#EF444426' : '#27272A',
                          color: item.danger ? '#F87171' : 'white'
                        }
                  }
                >
                  <Flex align="center" gap={2.5} minW={0}>
                    {item.icon && (
                      <Box
                        shrink={0}
                        color={item.danger ? '#F87171' : '#A1A1AA'}
                        fontSize="14px"
                        display="flex"
                        alignItems="center"
                      >
                        {item.icon}
                      </Box>
                    )}
                    <Text truncate color="inherit" fontSize="12px">
                      {item.label}
                    </Text>
                  </Flex>

                  <Flex align="center" gap={2} shrink={0} ml={3}>
                    {item.shortcut && (
                      <Text fontSize="10px" color="#A1A1AA" fontFamily="mono">
                        {item.shortcut}
                      </Text>
                    )}
                    {hasSubmenu && <ChevronRight size={13} color="#A1A1AA" />}
                  </Flex>
                </Flex>

                {/* Submenu Popout */}
                {hasSubmenu && isSubmenuOpen && (
                  <Box
                    pos="absolute"
                    left={adjustedPos.left + 210 + 190 > (typeof window !== 'undefined' ? window.innerWidth : 1000) ? undefined : "100%"}
                    right={adjustedPos.left + 210 + 190 > (typeof window !== 'undefined' ? window.innerWidth : 1000) ? "100%" : undefined}
                    top="-6px"
                    ml={adjustedPos.left + 210 + 190 > (typeof window !== 'undefined' ? window.innerWidth : 1000) ? 0 : 1.5}
                    mr={adjustedPos.left + 210 + 190 > (typeof window !== 'undefined' ? window.innerWidth : 1000) ? 1.5 : 0}
                    bg="#18181B"
                    border="1px solid"
                    borderColor="#3F3F46"
                    rounded="lg"
                    p={1.5}
                    minW="180px"
                    boxShadow="0 10px 30px -5px rgba(0, 0, 0, 0.6)"
                    zIndex={9992}
                  >
                    <Flex flexDir="column" gap={0.5}>
                      {item.submenu!.map((subItem) => (
                        <Flex
                          key={subItem.id}
                          as="button"
                          disabled={subItem.disabled}
                          onClick={() => {
                            if (subItem.disabled) return;
                            if (subItem.onClick) {
                              subItem.onClick();
                              onClose();
                            }
                          }}
                          align="center"
                          justify="space-between"
                          w="full"
                          px={2.5}
                          py={1.5}
                          rounded="md"
                          fontSize="12px"
                          fontWeight="medium"
                          cursor={subItem.disabled ? 'not-allowed' : 'pointer'}
                          opacity={subItem.disabled ? 0.4 : 1}
                          transition="all 0.1s"
                          color="white"
                          _hover={
                            subItem.disabled
                              ? {}
                              : {
                                  bg: '#27272A'
                                }
                          }
                        >
                          <Flex align="center" gap={2.5}>
                            {subItem.icon && (
                              <Box color="#A1A1AA" fontSize="14px" display="flex">
                                {subItem.icon}
                              </Box>
                            )}
                            <Text fontSize="12px">{subItem.label}</Text>
                          </Flex>
                          {subItem.shortcut && (
                            <Text fontSize="10px" color="#A1A1AA" fontFamily="mono">
                              {subItem.shortcut}
                            </Text>
                          )}
                        </Flex>
                      ))}
                    </Flex>
                  </Box>
                )}
              </Box>
            );
          })}
        </Flex>
      </Box>
    </Portal>
  );
};
