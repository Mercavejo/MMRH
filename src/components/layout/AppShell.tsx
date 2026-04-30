'use client';

import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  useTheme,
  useMediaQuery,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Description as DescriptionIcon,
  Dashboard as DashboardIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  SwitchAccount as SwitchIcon,
  Group as GroupIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Error as ErrorIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { tokens } from '@/lib/theme/tokens';

const DRAWER_WIDTH = 280;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  role: 'colaborador' | 'rh' | 'all';
  allowedTenantRoles?: Array<'colaborador' | 'rh_operator' | 'rh_gestor' | 'suporte' | 'admin_plataforma' | 'rh'>;
}

const NAV_ITEMS: NavItem[] = [
  // Colaborador
  { label: 'Meus Documentos', icon: <DescriptionIcon />, path: '/documents', role: 'colaborador', allowedTenantRoles: ['colaborador', 'rh_gestor', 'rh_operator', 'admin_plataforma', 'rh'] },
  { label: 'Notificações', icon: <NotificationsIcon />, path: '/notifications', role: 'all', allowedTenantRoles: ['colaborador', 'rh_gestor', 'rh_operator', 'admin_plataforma', 'rh'] },
  
  // RH
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/rh', role: 'rh', allowedTenantRoles: ['rh_gestor', 'rh_operator', 'suporte', 'admin_plataforma', 'rh'] },
  { label: 'Indicadores RH', icon: <AnalyticsIcon />, path: '/rh/indicadores', role: 'rh', allowedTenantRoles: ['admin_plataforma', 'rh'] },
  { label: 'Processamento de Lotes', icon: <ReceiptIcon />, path: '/rh/lotes', role: 'rh', allowedTenantRoles: ['rh_gestor', 'rh_operator', 'admin_plataforma', 'rh'] },
  { label: 'Colaboradores', icon: <PeopleIcon />, path: '/rh/colaboradores', role: 'rh', allowedTenantRoles: ['rh_gestor', 'rh_operator', 'admin_plataforma', 'rh'] },
  { label: 'Integrações', icon: <SettingsIcon />, path: '/rh/integracoes', role: 'rh', allowedTenantRoles: ['rh_gestor', 'rh_operator', 'admin_plataforma', 'rh'] },
  { label: 'Fila de Exceções', icon: <ErrorIcon />, path: '/rh/excecoes', role: 'rh', allowedTenantRoles: ['admin_plataforma', 'rh'] },
  { label: 'Auditoria', icon: <GroupIcon />, path: '/rh/auditoria', role: 'rh', allowedTenantRoles: ['suporte', 'admin_plataforma', 'rh'] },
];

interface AppShellProps {
  children: React.ReactNode;
  userRole: 'colaborador' | 'rh';
  userName: string;
  hasAccessToBoth?: boolean;
  isSimulating?: boolean;
  tenantRole?: 'colaborador' | 'rh_operator' | 'rh_gestor' | 'suporte' | 'admin_plataforma' | 'rh';
}

function getUserRoleLabel(role: AppShellProps['tenantRole'], userRole: AppShellProps['userRole']) {
  if (role === 'admin_plataforma') return 'Admin Mercavejo';
  if (role === 'suporte') return 'Suporte Interno';
  if (role === 'rh_operator') return 'Operador Cliente';
  if (role === 'rh_gestor') return 'Gestor Cliente';
  if (userRole === 'rh') return 'Operação RH';
  return 'Colaborador';
}

export function AppShell({ children, userRole, userName, hasAccessToBoth = false, isSimulating = false, tenantRole }: AppShellProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleProfileMenuClose = () => setAnchorEl(null);
  const handleLogout = async () => {
    handleProfileMenuClose();
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const filteredNavItems = NAV_ITEMS.filter(
    (item) =>
      (item.role === 'all' || item.role === userRole) &&
      (!item.allowedTenantRoles || item.allowedTenantRoles.includes(tenantRole ?? userRole))
  );
  const isNavItemActive = (path: string) => path === '/rh'
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);
  const currentNavItem = NAV_ITEMS.find((item) => isNavItemActive(item.path));

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 3, py: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px', color: tokens.colors.primary }}>
          ADALTO
          <Box component="span" sx={{ color: tokens.colors.action }}>.</Box>
        </Typography>
      </Toolbar>
      
      <Box sx={{ px: 2, mb: 4 }}>
        <Box sx={{ 
          p: 2, 
          borderRadius: 4, 
          background: `linear-gradient(135deg, ${tokens.colors.primary} 0%, ${tokens.colors.secondary} 100%)`,
          color: 'white',
          boxShadow: tokens.effects.shadow.md
        }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', fontWeight: 700, flexShrink: 0 }}>{userName[0]}</Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600, opacity: 0.9 }}>{userName}</Typography>
              <Chip 
                label={getUserRoleLabel(tenantRole, userRole)} 
                size="small" 
                sx={{ 
                  height: 20, 
                  fontSize: '0.65rem', 
                  bgcolor: 'rgba(255,255,255,0.15)', 
                  color: 'white',
                  mt: 0.5,
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }} 
              />
            </Box>
          </Stack>
        </Box>
      </Box>

      <List sx={{ px: 2, flex: 1 }}>
        {filteredNavItems.map((item) => {
          const isActive = isNavItemActive(item.path);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  router.push(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 3,
                  py: 1.5,
                  position: 'relative',
                  overflow: 'hidden',
                  bgcolor: 'transparent',
                  color: isActive ? tokens.colors.action : tokens.colors.text.muted,
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 4,
                    height: isActive ? '60%' : '0%',
                    borderRadius: '0 4px 4px 0',
                    backgroundColor: tokens.colors.action,
                    opacity: isActive ? 1 : 0,
                    transition: 'height 0.3s ease, opacity 0.3s ease',
                  },
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.02)',
                  },
                }}
              >
                <ListItemIcon sx={{ 
                  minWidth: 40, 
                  color: isActive ? tokens.colors.action : tokens.colors.text.muted 
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  slotProps={{ primary: { variant: 'body2', sx: { fontWeight: isActive ? 700 : 500 } } }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ p: 2 }}>
        <Divider sx={{ mb: 2, opacity: 0.6 }} />
        <ListItemButton onClick={handleLogout} sx={{ borderRadius: 3, color: tokens.colors.error }}>
          <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}><LogoutIcon /></ListItemIcon>
          <ListItemText primary="Sair" slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 600 } } }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: tokens.colors.surface.background }}>
      <CssBaseline />
      
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 4 } }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            {currentNavItem?.label || 'Sistema'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {hasAccessToBoth && (
              <>
                {/* Mobile: Icon-only toggle with tooltip */}
                <Tooltip title={pathname.startsWith('/rh') ? 'Alternar para Visão Colaborador' : 'Alternar para Visão RH'}>
                  <IconButton
                    size="small"
                    aria-label={pathname.startsWith('/rh') ? 'Alternar para Visão Colaborador' : 'Alternar para Visão RH'}
                    onClick={() => {
                      const isInRhView = pathname.startsWith('/rh');
                      router.push(isInRhView ? '/documents' : '/rh');
                    }}
                    sx={{
                      display: { xs: 'flex', sm: 'none' },
                      color: tokens.colors.primary,
                      border: `1px solid ${tokens.colors.surface.border}`,
                      '&:hover': {
                        borderColor: tokens.colors.action,
                        bgcolor: 'rgba(20,184,166,0.08)',
                      }
                    }}
                  >
                    <SwitchIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {/* Desktop: Full button with text */}
                <Button
                  variant="outlined"
                  startIcon={<SwitchIcon />}
                  size="small"
                  onClick={() => {
                    const isInRhView = pathname.startsWith('/rh');
                    router.push(isInRhView ? '/documents' : '/rh');
                  }}
                  sx={{ 
                    borderRadius: 10, 
                    fontSize: '0.75rem',
                    display: { xs: 'none', sm: 'flex' },
                    color: tokens.colors.primary,
                    borderColor: tokens.colors.surface.border,
                    '&:hover': {
                      borderColor: tokens.colors.action,
                      bgcolor: 'rgba(20,184,166,0.08)',
                    }
                  }}
                >
                  {pathname.startsWith('/rh') ? 'Visão Colaborador' : 'Visão RH'}
                </Button>
              </>
            )}
            {isSimulating && (
              <Chip
                label="Modo Simulação"
                size="small"
                sx={{
                  bgcolor: tokens.colors.warning,
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                  },
                }}
              />
            )}
            <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0.5, border: `1px solid ${tokens.colors.surface.border}` }}>
              <Avatar src="" sx={{ width: 32, height: 32, bgcolor: tokens.colors.secondary }}>{userName[0]}</Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, border: 'none' },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: DRAWER_WIDTH, 
              border: 'none',
              borderRight: `1px solid ${tokens.colors.surface.border}`,
              bgcolor: 'white'
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 4 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8
        }}
      >
        {children}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.5,
              minWidth: 180,
              borderRadius: 3,
              boxShadow: tokens.effects.shadow.lg,
              border: `1px solid ${tokens.colors.surface.border}`,
            },
          },
        }}
      >
        <MenuItem onClick={handleProfileMenuClose} sx={{ py: 1.5 }}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          Configurações
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: tokens.colors.error }}>
          <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: 'inherit' }} /></ListItemIcon>
          Sair
        </MenuItem>
      </Menu>
    </Box>
  );
}

interface LocalStackProps {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  spacing?: number;
  alignItems?: React.CSSProperties['alignItems'];
}

function Stack({ children, direction = 'row', spacing = 0, alignItems = 'flex-start' }: LocalStackProps) {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: direction === 'row' ? 'row' : 'column', 
      gap: spacing,
      alignItems 
    }}>
      {children}
    </Box>
  );
}
