import React, { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Container,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Menu,
  MenuItem,
  Avatar
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

// Define the pages for navigation
const publicPages = [
  { name: 'Contact', path: '/contact' }
];

const authenticatedPages = [
  { name: 'Saved & Explore', path: '/my-collection' }
];

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  // State for mobile menu
  const [mobileOpen, setMobileOpen] = useState(false);

  // State for user menu
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  // Handle mobile menu toggle
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Handle opening user menu
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  // Handle closing user menu
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  // Handle sign out
  const handleSignOut = () => {
    handleCloseUserMenu();
    logout();
    navigate('/');
  };

  // Mobile drawer content
  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography
        variant="h6"
        component={RouterLink}
        to="/"
        sx={{
          my: 3,
          display: 'block',
          textDecoration: 'none',
          color: 'primary.main',
          fontWeight: 700,
          letterSpacing: '0.5px'
        }}
      >
        SightEd
      </Typography>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton
            component={RouterLink}
            to="/"
            selected={location.pathname === '/'}
            sx={{
              textAlign: 'center',
              '&.Mui-selected': {
                backgroundColor: 'rgba(190, 86, 131, 0.08)',
                color: 'primary.main',
                borderRight: '4px solid #be5683'
              },
              '&:hover': {
                backgroundColor: 'rgba(190, 86, 131, 0.04)',
              }
            }}
          >
            <ListItemText
              primary="Home"
              primaryTypographyProps={{
                fontWeight: location.pathname === '/' ? 600 : 400,
                color: location.pathname === '/' ? 'primary.main' : 'text.primary',
              }}
            />
          </ListItemButton>
        </ListItem>

        {/* Public pages always visible */}
        {publicPages.map((page) => (
          <ListItem key={page.name} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={page.path}
              selected={location.pathname === page.path}
              sx={{
                textAlign: 'center',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(190, 86, 131, 0.08)',
                  color: 'primary.main',
                  borderRight: '4px solid #be5683'
                },
                '&:hover': {
                  backgroundColor: 'rgba(190, 86, 131, 0.04)',
                }
              }}
            >
              <ListItemText
                primary={page.name}
                primaryTypographyProps={{
                  fontWeight: location.pathname === page.path ? 600 : 400,
                  color: location.pathname === page.path ? 'primary.main' : 'text.primary',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}

        {/* Authenticated pages - only shown when logged in */}
        {isAuthenticated && authenticatedPages.map((page) => (
          <ListItem key={page.name} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={page.path}
              selected={location.pathname === page.path}
              sx={{
                textAlign: 'center',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(190, 86, 131, 0.08)',
                  color: 'primary.main',
                  borderRight: '4px solid #be5683'
                },
                '&:hover': {
                  backgroundColor: 'rgba(190, 86, 131, 0.04)',
                }
              }}
            >
              <ListItemText
                primary={page.name}
                primaryTypographyProps={{
                  fontWeight: location.pathname === page.path ? 600 : 400,
                  color: location.pathname === page.path ? 'primary.main' : 'text.primary',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}

        {/* Authentication links */}
        {isAuthenticated ? (
          // Sign Out button when authenticated
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleSignOut}
              sx={{
                textAlign: 'center',
                '&:hover': {
                  backgroundColor: 'rgba(190, 86, 131, 0.04)',
                }
              }}
            >
              <ListItemText
                primary="Sign Out"
                primaryTypographyProps={{
                  color: 'text.primary',
                }}
              />
            </ListItemButton>
          </ListItem>
        ) : (
          // Sign In link when not authenticated
          <ListItem disablePadding>
            <ListItemButton
              component={RouterLink}
              to="/sign-in"
              selected={location.pathname === '/sign-in'}
              sx={{
                textAlign: 'center',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(190, 86, 131, 0.08)',
                  color: 'primary.main',
                  borderRight: '4px solid #be5683'
                },
                '&:hover': {
                  backgroundColor: 'rgba(190, 86, 131, 0.04)',
                }
              }}
            >
              <ListItemText
                primary="Sign In"
                primaryTypographyProps={{
                  fontWeight: location.pathname === '/sign-in' ? 600 : 400,
                  color: location.pathname === '/sign-in' ? 'primary.main' : 'text.primary',
                }}
              />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <AppBar position="static" color="secondary" elevation={0}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Logo for desktop */}
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontWeight: 700,
              color: 'primary.main',
              textDecoration: 'none',
              letterSpacing: '0.5px'
            }}
          >
            SightEd
          </Typography>

          {/* Mobile menu button */}
          <Box sx={{ flexGrow: 0, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="open drawer"
              edge="start"
              color="primary"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          </Box>

          {/* Logo for mobile */}
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              flexGrow: 1,
              display: { xs: 'flex', md: 'none' },
              fontWeight: 700,
              color: 'primary.main',
              textDecoration: 'none',
              letterSpacing: '0.5px'
            }}
          >
            SightEd
          </Typography>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }} />

          {/* Desktop navigation links */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
            {/* Public pages always visible */}
            {publicPages.map((page) => (
              <Button
                key={page.name}
                component={RouterLink}
                to={page.path}
                sx={{
                  mx: 1,
                  color: location.pathname === page.path ? 'primary.main' : 'text.primary',
                  fontWeight: location.pathname === page.path ? 600 : 400,
                  borderBottom: location.pathname === page.path ? '2px solid #be5683' : 'none',
                  borderRadius: 0,
                  paddingBottom: '4px',
                  '&:hover': {
                    backgroundColor: 'transparent',
                    color: 'primary.main',
                  }
                }}
              >
                {page.name}
              </Button>
            ))}

            {/* Authenticated pages - only shown when logged in */}
            {isAuthenticated && authenticatedPages.map((page) => (
              <Button
                key={page.name}
                component={RouterLink}
                to={page.path}
                sx={{
                  mx: 1,
                  color: location.pathname === page.path ? 'primary.main' : 'text.primary',
                  fontWeight: location.pathname === page.path ? 600 : 400,
                  borderBottom: location.pathname === page.path ? '2px solid #be5683' : 'none',
                  borderRadius: 0,
                  paddingBottom: '4px',
                  '&:hover': {
                    backgroundColor: 'transparent',
                    color: 'primary.main',
                  }
                }}
              >
                {page.name}
              </Button>
            ))}

            {/* Authentication buttons */}
            {isAuthenticated ? (
              // User menu when authenticated
              <Box sx={{ ml: 2 }}>
                <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                  {user?.firstName ? (
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {user.firstName.charAt(0)}
                    </Avatar>
                  ) : (
                    <AccountCircleIcon color="primary" />
                  )}
                </IconButton>
                <Menu
                  sx={{ mt: '45px' }}
                  id="menu-appbar"
                  anchorEl={anchorElUser}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                >
                  <MenuItem onClick={handleSignOut}>
                    <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                    <Typography textAlign="center">Sign Out</Typography>
                  </MenuItem>
                </Menu>
              </Box>
            ) : (
              // Sign In button when not authenticated
              <Button
                component={RouterLink}
                to="/sign-in"
                variant="outlined"
                color="primary"
                sx={{ ml: 1 }}
              >
                Sign In
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
        }}
      >
        {drawer}
      </Drawer>
    </AppBar>
  );
};

export default Navigation;
