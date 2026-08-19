'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  ActionIcon,
  Box,
  Burger,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure, useLocalStorage, useMediaQuery } from '@mantine/hooks';
import {
  IconBriefcase,
  IconCalendarEvent,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarResizeHandle } from '@/components/app-shell/SidebarResizeHandle';
import { PageTransition } from '@/components/PageTransition';
import { SignOutButton } from '@/components/SignOutButton';
import { ROLE, labelOf } from '@/lib/labels';
import {
  motionTransitionFast,
  shellVariants,
  sidebarOverlayVariants,
} from '@/lib/motion';
import { density, palette } from '@/theme';
import type { Role } from '@/types/domain';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV_PRIMARY: NavItem[] = [
  { href: '/hr', label: 'Dashboard', icon: <IconLayoutDashboard size={20} aria-hidden /> },
  { href: '/hr/candidates', label: 'Candidates', icon: <IconUsers size={20} aria-hidden /> },
  { href: '/hr/jobs', label: 'Jobs', icon: <IconBriefcase size={20} aria-hidden /> },
  { href: '/hr/settings', label: 'Settings', icon: <IconSettings size={20} aria-hidden /> },
];

const NAV_WORK: NavItem[] = [
  {
    href: '/hr/interviews',
    label: 'Interviews',
    icon: <IconCalendarEvent size={20} aria-hidden />,
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/hr') return pathname === '/hr';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavSection({
  label,
  items,
  pathname,
  collapsed,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <Stack gap={4}>
      {!collapsed ? (
        <Text
          size="xs"
          tt="uppercase"
          fw={600}
          style={{ color: `${palette.paper}99`, letterSpacing: '0.06em' }}
          px="sm"
        >
          {label}
        </Text>
      ) : null}
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const link = (
          <motion.div
            whileHover={{ x: collapsed ? 0 : 2 }}
            whileTap={{ scale: density.motion.tapScale }}
            transition={motionTransitionFast}
          >
            <NavLink
              component={Link}
              href={item.href}
              label={collapsed ? undefined : item.label}
              leftSection={item.icon}
              active={active}
              aria-label={item.label}
              variant={active ? 'filled' : 'subtle'}
              color="accent"
              styles={{
                root: {
                  borderRadius: `var(--mantine-radius-${density.defaultRadius})`,
                  color: active ? palette.paper : `${palette.paper}cc`,
                  backgroundColor: active ? palette.accent : 'transparent',
                  justifyContent: collapsed ? 'center' : undefined,
                },
                label: { color: 'inherit' },
                section: { color: 'inherit', marginInlineEnd: collapsed ? 0 : undefined },
              }}
            />
          </motion.div>
        );

        return collapsed ? (
          <Tooltip key={item.href} label={item.label} position="right" withArrow>
            {link}
          </Tooltip>
        ) : (
          <Box key={item.href}>{link}</Box>
        );
      })}
    </Stack>
  );
}

export function AppShell({
  children,
  userName,
  userRole,
}: {
  children: React.ReactNode;
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const roleLabel = labelOf(ROLE, userRole as Role, userRole || '—');
  const isMobile = useMediaQuery('(max-width: 48em)', false, { getInitialValueInEffect: true });
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);

  const [collapsed, setCollapsed] = useLocalStorage({
    key: 'hr-sidebar-collapsed',
    defaultValue: false,
  });
  const [navbarWidth, setNavbarWidth] = useLocalStorage<number>({
    key: 'hr-sidebar-width',
    defaultValue: density.shellNavbarWidth,
  });

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  const railCollapsed = !isMobile && collapsed;
  const sidebarWidth = railCollapsed
    ? density.shellNavbarCollapsedWidth
    : Math.min(
        density.shellNavbarMaxWidth,
        Math.max(density.shellNavbarMinWidth, navbarWidth),
      );

  const showSidebar = isMobile ? mobileOpened : true;

  return (
    <motion.div
      variants={shellVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: density.motion.durationSlow, ease: density.motion.ease }}
      style={{
        display: 'flex',
        minHeight: '100dvh',
        background: palette.paper,
        color: palette.ink,
      }}
    >
      <AnimatePresence>
        {isMobile && mobileOpened ? (
          <motion.div
            key="sidebar-overlay"
            variants={sidebarOverlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={motionTransitionFast}
            onClick={closeMobile}
            aria-hidden
            style={{
              position: 'fixed',
              inset: 0,
              background: `${palette.ink}66`,
              zIndex: 90,
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showSidebar ? (
          <motion.aside
            key="sidebar"
            aria-label="Main navigation"
            initial={isMobile ? { x: -sidebarWidth, opacity: 0 } : false}
            animate={{ width: sidebarWidth, x: 0, opacity: 1 }}
            exit={isMobile ? { x: -sidebarWidth, opacity: 0 } : undefined}
            transition={density.motion.sidebarSpring}
            style={{
              flexShrink: 0,
              background: palette.ink,
              display: 'flex',
              flexDirection: 'column',
              position: isMobile ? 'fixed' : 'sticky',
              top: 0,
              left: 0,
              height: '100dvh',
              zIndex: 100,
              padding: 'var(--mantine-spacing-md)',
              overflow: 'hidden',
            }}
          >
            <Stack gap="lg" style={{ flex: 1, minHeight: 0 }}>
              <Group justify={railCollapsed ? 'center' : 'space-between'} wrap="nowrap" gap="xs">
                <AnimatePresence initial={false}>
                  {!railCollapsed ? (
                    <motion.div
                      key="brand"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={motionTransitionFast}
                    >
                      <Title
                        order={4}
                        style={{ color: palette.paper, letterSpacing: density.titleLetterSpacing }}
                      >
                        Hiring
                      </Title>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                {!isMobile ? (
                  <Tooltip
                    label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    position="right"
                  >
                    <motion.div
                      whileHover={{ scale: density.motion.hoverScale }}
                      whileTap={{ scale: density.motion.tapScale }}
                    >
                      <ActionIcon
                        className="cursor-pointer rounded-lg"
                        aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        variant="subtle"
                        onClick={() => setCollapsed((value) => !value)}
                        style={{ color: palette.paper }}
                      >
                        {railCollapsed ? (
                          <IconLayoutSidebarLeftExpand size={20} aria-hidden />
                        ) : (
                          <IconLayoutSidebarLeftCollapse size={20} aria-hidden />
                        )}
                      </ActionIcon>
                    </motion.div>
                  </Tooltip>
                ) : null}
              </Group>

              <NavSection
                label="Oversee"
                items={NAV_PRIMARY}
                pathname={pathname}
                collapsed={railCollapsed}
              />
              <NavSection
                label="Schedule"
                items={NAV_WORK}
                pathname={pathname}
                collapsed={railCollapsed}
              />
            </Stack>

            {!isMobile ? (
              <SidebarResizeHandle disabled={railCollapsed} onResize={setNavbarWidth} />
            ) : null}
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <Box
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100dvh',
        }}
      >
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: density.motion.duration, ease: density.motion.ease, delay: 0.05 }}
          style={{
            height: density.shellHeaderHeight,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            background: palette.paper,
            borderBottom: `1px solid ${palette.ink}14`,
            paddingInline: 'var(--mantine-spacing-md)',
          }}
        >
          <Group h="100%" w="100%" justify="space-between" wrap="nowrap">
            {isMobile ? (
              <Burger
                opened={mobileOpened}
                onClick={toggleMobile}
                size="sm"
                aria-label="Toggle navigation"
                color={palette.ink}
              />
            ) : (
              <span />
            )}
            <Group gap="md" wrap="nowrap" ml="auto">
              <Box ta="right">
                <Text size="sm" fw={600} style={{ color: palette.ink }} lh={1.2}>
                  {userName}
                </Text>
                <Text size="xs" c="dimmed">
                  {roleLabel}
                </Text>
              </Box>
              <SignOutButton />
            </Group>
          </Group>
        </motion.header>

        <Box
          component="main"
          p="md"
          style={{
            flex: 1,
            background: palette.paper,
          }}
        >
          <PageTransition>{children}</PageTransition>
        </Box>
      </Box>
    </motion.div>
  );
}
