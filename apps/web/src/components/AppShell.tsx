'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import {
  ActionIcon,
  Anchor,
  Box,
  Breadcrumbs,
  Burger,
  Group,
  NavLink,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useDisclosure, useLocalStorage, useMediaQuery } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconBriefcase,
  IconCalendarEvent,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarResizeHandle } from '@/components/app-shell/SidebarResizeHandle';
import { BrandLogo } from '@/components/BrandLogo';
import { PageTransition } from '@/components/PageTransition';
import { SignOutButton } from '@/components/SignOutButton';
import { ROLE, labelOf } from '@/lib/labels';
import {
  motionTransitionFast,
  shellVariants,
  sidebarOverlayVariants,
} from '@/lib/motion';
import { density, palette, shadows } from '@/theme';
import type { Role } from '@/types/domain';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV_PRIMARY: NavItem[] = [
  { href: '/hr', label: 'Dashboard', icon: <IconLayoutDashboard size={18} aria-hidden /> },
  { href: '/hr/candidates', label: 'Candidates', icon: <IconUsers size={18} aria-hidden /> },
  { href: '/hr/jobs', label: 'Jobs', icon: <IconBriefcase size={18} aria-hidden /> },
  { href: '/hr/interviews', label: 'Interviews', icon: <IconCalendarEvent size={18} aria-hidden /> },
];

const NAV_SETTINGS: NavItem[] = [
  { href: '/hr/settings', label: 'Settings', icon: <IconSettings size={18} aria-hidden /> },
];

const NAV_OPS: NavItem[] = [
  { href: '/hr/errors', label: 'Errors', icon: <IconAlertTriangle size={18} aria-hidden /> },
];

const CRUMB_LABELS: Record<string, string> = {
  hr: 'Home',
  candidates: 'Candidates',
  jobs: 'Jobs',
  interviews: 'Interviews',
  settings: 'Settings',
  errors: 'Errors',
  new: 'New job',
  login: 'Sign in',
};

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
    <Stack gap={2}>
      {!collapsed ? (
        <Text
          size="xs"
          tt="uppercase"
          fw={600}
          style={{ color: `${palette.surface}66`, letterSpacing: '0.06em' }}
          px="sm"
          mb={2}
        >
          {label}
        </Text>
      ) : null}
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const link = (
          <motion.div
            whileHover={{ x: collapsed ? 0 : 1 }}
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
              aria-current={active ? 'page' : undefined}
              styles={{
                root: {
                  borderRadius: 8,
                  color: active ? palette.surface : `${palette.surface}b3`,
                  backgroundColor: active ? `${palette.accent}` : 'transparent',
                  justifyContent: collapsed ? 'center' : undefined,
                  paddingInline: collapsed ? 10 : 12,
                  minHeight: 36,
                  '&:hover': {
                    backgroundColor: active ? palette.accent : `${palette.surface}12`,
                  },
                },
                label: { color: 'inherit', fontWeight: active ? 600 : 500, fontSize: 13 },
                section: { color: 'inherit', marginInlineEnd: collapsed ? 0 : 10 },
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

function HeaderBreadcrumbs({ pathname }: { pathname: string }) {
  const crumbs = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] !== 'hr') return [];
    const items: { title: string; href: string }[] = [];
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc += `/${part}`;
      const isId = /^[0-9a-f-]{8,}$/i.test(part) || /^\d+$/.test(part);
      let title = CRUMB_LABELS[part] ?? (isId ? 'Detail' : part);
      if (i === 0) title = 'Dashboard';
      items.push({ title, href: acc });
    }
    return items;
  }, [pathname]);

  if (crumbs.length <= 1) {
    return (
      <Text size="sm" fw={500} style={{ color: palette.muted }}>
        {crumbs[0]?.title ?? 'Dashboard'}
      </Text>
    );
  }

  return (
    <Breadcrumbs separator="›" separatorMargin={6}>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        if (last) {
          return (
            <Text key={c.href} size="sm" fw={600} style={{ color: palette.ink }}>
              {c.title}
            </Text>
          );
        }
        return (
          <Anchor
            key={c.href}
            component={Link}
            href={c.href}
            size="sm"
            c="dimmed"
            underline="hover"
            aria-label={`Go to ${c.title}`}
          >
            {c.title}
          </Anchor>
        );
      })}
    </Breadcrumbs>
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
              padding: '14px 10px',
              overflow: 'hidden',
              borderRight: `1px solid ${palette.ink}`,
            }}
          >
            <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
              {railCollapsed ? (
                <Stack gap="xs" align="center">
                  <BrandLogo height={28} markOnly />
                  {!isMobile ? (
                    <Tooltip label="Expand sidebar" position="right">
                      <ActionIcon
                        className="cursor-pointer rounded-lg"
                        aria-label="Expand sidebar"
                        variant="subtle"
                        onClick={() => setCollapsed(false)}
                        style={{ color: palette.surface }}
                      >
                        <IconLayoutSidebarLeftCollapse
                          size={18}
                          aria-hidden
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      </ActionIcon>
                    </Tooltip>
                  ) : null}
                </Stack>
              ) : (
                <Group
                  justify="space-between"
                  wrap="nowrap"
                  gap="xs"
                  px={4}
                  align="center"
                >
                  <BrandLogo height={28} />
                  {!isMobile ? (
                    <Tooltip label="Collapse sidebar" position="right">
                      <motion.div
                        whileHover={{ scale: density.motion.hoverScale }}
                        whileTap={{ scale: density.motion.tapScale }}
                      >
                        <ActionIcon
                          className="cursor-pointer rounded-lg"
                          aria-label="Collapse sidebar"
                          variant="subtle"
                          onClick={() => setCollapsed(true)}
                          style={{ color: `${palette.surface}99` }}
                        >
                          <IconLayoutSidebarLeftCollapse size={18} aria-hidden />
                        </ActionIcon>
                      </motion.div>
                    </Tooltip>
                  ) : null}
                </Group>
              )}

              <NavSection
                label="Recruit"
                items={NAV_PRIMARY}
                pathname={pathname}
                collapsed={railCollapsed}
              />
              <Box style={{ flex: 1 }} />
              <NavSection
                label="Workspace"
                items={NAV_SETTINGS}
                pathname={pathname}
                collapsed={railCollapsed}
              />
              <NavSection
                label="Ops"
                items={NAV_OPS}
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
            background: palette.surface,
            borderBottom: `1px solid ${palette.border}`,
            paddingInline: 'var(--mantine-spacing-md)',
            boxShadow: shadows.sm,
            zIndex: 50,
          }}
        >
          <Group h="100%" w="100%" justify="space-between" wrap="nowrap" gap="md">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              {isMobile ? (
                <Burger
                  opened={mobileOpened}
                  onClick={toggleMobile}
                  size="sm"
                  aria-label="Toggle navigation"
                  color={palette.ink}
                />
              ) : null}
              <HeaderBreadcrumbs pathname={pathname} />
            </Group>
            <Group gap="md" wrap="nowrap">
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
          p={density.pagePadding}
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
