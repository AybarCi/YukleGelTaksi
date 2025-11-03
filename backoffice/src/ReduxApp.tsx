import React, { ReactNode, useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';

const theme = createTheme({
  palette: {
    primary: {
      main: '#FFD700', // Sarı (kurumsal renk)
      dark: '#FFC107',
      light: '#FFEB3B',
      contrastText: '#000000', // Siyah metin
    },
    secondary: {
      main: '#000000', // Siyah (kurumsal renk)
      dark: '#212121',
      light: '#424242',
      contrastText: '#FFFFFF', // Beyaz metin
    },
    background: {
      default: '#FAFAFA', // Açık gri-beyaz
      paper: '#FFFFFF', // Beyaz (kurumsal renk)
    },
    text: {
      primary: '#000000', // Siyah metin
      secondary: '#424242', // Koyu gri
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
});

interface AppProvidersProps {
  children: ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
};

const ReduxApp: React.FC = () => {
  return (
    <AppProviders>
      <App />
    </AppProviders>
  );
};

export default ReduxApp;