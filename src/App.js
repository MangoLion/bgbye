import React, { useState } from 'react';
import { Box, ThemeProvider, createTheme, Paper, FormGroup, FormControlLabel, Checkbox, Divider, Typography } from '@mui/material';
import { Toaster, toast } from 'react-hot-toast';
import ImageUpload from './components/ImageUpload';
import ResponsiveAppBar from './components/ResponsiveAppBar';
import MethodSelector from './components/MethodSelector';
import ModelsInfo from './components/ModelsInfo';

// Utility function to show error toast
const showErrorToast = (message) => {
  toast.error(message, {
    duration: 4000,
    position: 'bottom-center',
    style: {
      background: '#FF4136',
      color: '#FFFFFF',
    },
  });
};

const APP_ID = 'bgbye';

function App() {
  const [processedPanels, setProcessedPanels] = useState(0);
  const [darkMode, setDarkMode] = useState(() => {
    const storedTheme = localStorage.getItem(APP_ID + '_theme');
    return storedTheme !== null ? storedTheme === 'true' : false;
  });
  const [selectedModels, setSelectedModels] = useState(
    Object.keys(ModelsInfo).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {})
  );

  const handleProcessed = () => {
    setProcessedPanels((prevCount) => prevCount + 1);
  };

  const toggleTheme = () => {
    setDarkMode((prevMode) => !prevMode);
    localStorage.setItem(APP_ID + '_theme', !darkMode);
  };

  const handleModelChange = (event) => {
    setSelectedModels({
      ...selectedModels,
      [event.target.name]: event.target.checked
    });
  };

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      background: {
        default: darkMode
          ? 'linear-gradient(180deg, #10364a 30%, #0d171c 90%)'
          : 'linear-gradient(180deg, #cbdbf2 30%, #b0ccff 90%)',
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
          background: theme.palette.background.default,
        }}
      >
        <ResponsiveAppBar toggleTheme={toggleTheme} darkMode={darkMode}/>
        {Array.from({ length: processedPanels + 1 }).map((_, index) => (
          <Box key={index} sx={{ mt: 4 }}>
            <ImageUpload 
              onProcessed={handleProcessed} 
              theme={theme} 
              fileID={index}
              selectedModels={selectedModels}
              showErrorToast={showErrorToast}
            />
          </Box>
        ))}
        <MethodSelector  selectedModels={selectedModels} handleModelChange={handleModelChange} />
      </Box>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
