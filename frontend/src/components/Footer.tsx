import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Link,
  Stack
} from '@mui/material';

const Footer: React.FC = () => {

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        borderTop: '1px solid #eaeaea'
      }}
    >
      <Container maxWidth="lg">
        <Stack direction="row" spacing={3} justifyContent="center" sx={{ width: '100%' }}>
          <Link component={RouterLink} to="/" color="inherit" underline="hover">
            Home
          </Link>
          <Link component={RouterLink} to="/my-collection" color="inherit" underline="hover">
            Saved & Explore
          </Link>
          <Link component={RouterLink} to="/contact" color="inherit" underline="hover">
            Contact
          </Link>
          <Link component={RouterLink} to="/signin" color="inherit" underline="hover">
            Sign In
          </Link>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;
