import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#be5683', // Rose/pink color
      light: '#d47a9d',
      dark: '#a73d69',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ffffff',
      contrastText: '#be5683',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#be5683',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 600,
      marginBottom: '1.5rem',
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
      marginBottom: '1.25rem',
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      marginBottom: '1rem',
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      marginBottom: '0.75rem',
    },
    h5: {
      fontSize: '1.1rem',
      fontWeight: 600,
      marginBottom: '0.5rem',
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      marginBottom: '0.5rem',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 500,
          textTransform: 'none',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(190, 86, 131, 0.2)',
            backgroundColor: '#d47a9d',
          },
        },
        outlined: {
          borderWidth: 1,
          borderColor: '#be5683',
          color: '#be5683',
          '&:hover': {
            backgroundColor: 'rgba(190, 86, 131, 0.04)',
            borderColor: '#a73d69',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: 'rgba(190, 86, 131, 0.04)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f0f0f0',
          borderRadius: 12,
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0px 8px 16px rgba(190, 86, 131, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderRadius: 12,
        },
        elevation1: {
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
        },
        elevation2: {
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
        },
        elevation3: {
          boxShadow: '0px 6px 16px rgba(190, 86, 131, 0.1)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&.Mui-focused fieldset': {
              borderColor: '#be5683',
            },
            '&:hover fieldset': {
              borderColor: '#d47a9d',
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#be5683',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid #f0f0f0',
        },
        colorPrimary: {
          backgroundColor: '#ffffff',
          color: '#333333',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#f0f0f0',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
        colorPrimary: {
          backgroundColor: 'rgba(190, 86, 131, 0.1)',
          color: '#be5683',
        },
        outlined: {
          borderColor: '#be5683',
          color: '#be5683',
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#be5683',
          '&:hover': {
            color: '#a73d69',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#666666',
          '&:hover': {
            backgroundColor: 'rgba(190, 86, 131, 0.04)',
          },
        },
      },
    },
  },
});

export default theme;
