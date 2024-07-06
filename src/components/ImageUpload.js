import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  useTheme,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Paper,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import axios from 'axios';
import { ImgComparisonSlider } from '@img-comparison-slider/react';
import pLimit from 'p-limit';


const ImageUpload = ({ onProcessed, fileID, selectedModels, showErrorToast }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [originalFilename, setOriginalFilename] = useState('');
  const [processedFiles, setProcessedFiles] = useState({});
  const [activeMethod, setActiveMethod] = useState(null);
  const [processing, setProcessing] = useState({});
  const [localSelectedModels, setLocalSelectedModels] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [videoMethod, setVideoMethod] = useState('');
  const [videoId, setVideoId] = useState(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const theme = useTheme();

  const fileInputID = "fileInput" + fileID.toString();

  useEffect(() => {
    if (!localSelectedModels) {
      setLocalSelectedModels(selectedModels);
    }
  }, [selectedModels, localSelectedModels]);

  const processFile = useCallback(async (file, method) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('method', method);
    const isVideo = file.type.startsWith('video');
    const endpoint = isVideo ? 'remove_background_video' : 'remove_background';
    
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/${endpoint}/`, formData, {
        responseType: 'blob',
        withCredentials: false,
      });

      if (response) {
        const fileUrl = URL.createObjectURL(response.data);
        return fileUrl;
      }
    } catch (error) {
      console.error(`Error processing ${isVideo ? 'video' : 'image'} with ${method}:`, error);
      showErrorToast(`Error processing ${isVideo ? 'video' : 'image'} with ${method}`);
    }
    return null;
  }, [showErrorToast]);

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video');
    setFileType(isVideo ? 'video' : 'image');
    setSelectedFile(URL.createObjectURL(file));
    setOriginalFilename(file.name);
    setProcessedFiles({});
    setActiveMethod(null);
    
    const currentSelectedModels = {...selectedModels};
    setLocalSelectedModels(currentSelectedModels);

    if (!isVideo) {
      const initialProcessing = Object.fromEntries(
        Object.entries(currentSelectedModels)
          .filter(([_, isSelected]) => isSelected)
          .map(([method, _]) => [method, true])
      );
      setProcessing(initialProcessing);
  
      // Create a limit function that allows only 3 concurrent operations
      const limit = pLimit(3);
  
      // Create an array of promises
      const promises = Object.entries(currentSelectedModels)
        .filter(([_, isSelected]) => isSelected)
        .map(([method, _]) => 
          limit(() => processFile(file, method).then(result => {
            setProcessedFiles(prev => ({...prev, [method]: result}));
            setProcessing(prev => ({...prev, [method]: false}));
            if (!activeMethod) {
              setActiveMethod(method);
            }
          }))
        );
  
      // Wait for all promises to resolve
      await Promise.all(promises);
    }
  
    onProcessed();
  }, [processFile, onProcessed, selectedModels, activeMethod]);

  const handleMethodChange = (event, newMethod) => {
    if (newMethod !== null) {
      setActiveMethod(newMethod);
    }
  };

  const handleVideoMethodChange = (event) => {
    setVideoMethod(event.target.value);
  };

  const pollVideoStatus = useCallback(async (id) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/status/${id}`, {
        responseType: 'blob',
        withCredentials:false
      });

      // Check if the response is JSON (status update) or blob (completed video)
      const contentType = response.headers['content-type'];
      if (contentType && contentType.indexOf('application/json') !== -1) {
        // It's a JSON response (status update)
        const data = await response.data.text().then(JSON.parse);
        if (data.status === 'processing') {
          setVideoProgress(data.progress);
          setStatusMessage(data.message);
          setTimeout(() => pollVideoStatus(id), 4000); // Poll every second
        } else if (data.status === 'error') {
          showErrorToast('Error processing video: ' + data.message);
          setProcessing({ [videoMethod]: false });
          setStatusMessage('Error: ' + data.message);
        }
      } else {
        // It's a blob response (completed video)
        setVideoProgress(100);
        setProcessing({ [videoMethod]: false });
        setActiveMethod(videoMethod);
        setStatusMessage('Processing complete');

        const url = URL.createObjectURL(response.data);
        setProcessedFiles({ [videoMethod]: url });
      }
    } catch (error) {
      console.error('Error polling video status:', error);
      setProcessing({ [videoMethod]: false });
      setStatusMessage('Error: Failed to get status update');
      showErrorToast('Error: Failed to get status update');
    }
  }, [videoMethod, showErrorToast]);

  const getVideoDuration = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = function() {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      }

      video.onerror = function() {
        reject("Invalid video. Please select another video file.");
      }

      video.src = URL.createObjectURL(file);
    });
  }

  const handleProcessVideo = async () => {
    if (!selectedFile || !videoMethod) return;

    setProcessing({ [videoMethod]: true });
    setVideoProgress(0);

    try {
      const file = await fetch(selectedFile).then(r => r.blob());
      
      // Estimate frame count
      const duration = await getVideoDuration(file);
      const estimatedFrameCount = Math.ceil(duration * 24); // Assuming 24 fps

      if (estimatedFrameCount > 250) {
        showErrorToast(`Video too long (${estimatedFrameCount} estimated frames). Maximum allowed: 250 frames.`);
        setProcessing({ [videoMethod]: false });
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('method', videoMethod);

      const response = await axios.post('${process.env.REACT_APP_API_URL}/remove_background_video/', formData, {
        withCredentials: false,
      });

      setVideoId(response.data.video_id);
      pollVideoStatus(response.data.video_id);
    } catch (error) {
      console.error('Error processing video:', error);
      setProcessing({ [videoMethod]: false });
      showErrorToast('Error processing video: ', error);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = processedFiles[activeMethod];
    
    // Get the file extension
    const fileExtension = fileType === 'video' ? 'webm' : 'png';
    
    // Create the new filename
    const newFilename = `${originalFilename.split('.')[0]}_${activeMethod}.${fileExtension}`;
    
    link.download = newFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: (!selectedFile) ? '2px dashed' : 'none',
        borderColor: theme.palette.text.disabled,
        borderRadius: 1,
        p: 4,
        textAlign: 'center',
        cursor: !selectedFile && !processing ? 'pointer' : 'default',
        position: 'relative',
      }}
      onClick={() => !selectedFile && !Object.values(processing).some(Boolean) && document.getElementById(fileInputID).click()}
    >
      {!selectedFile && <input
        type="file"
        id={fileInputID}
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />}

      {selectedFile ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', maxWidth: '1024px' }}>
           
          <Box sx={{ flex: 1, maxWidth: '1280px', mr: 2,//border: '2px dashed' ,
        borderColor: theme.palette.text.disabled, }}>
            {fileType === 'image' ? (
              processedFiles[activeMethod] ? (
                <ImgComparisonSlider class="slider-example-focus">
                  <img slot="first" src={selectedFile} alt="Original" style={{ width: '100%' }} />
                  <img slot="second" src={processedFiles[activeMethod]} alt="Processed" style={{ width: '100%' }} />
                  {true && <svg slot="handle" xmlns="http://www.w3.org/2000/svg" width="100" viewBox="-8 -3 16 6">
                    <path stroke="#549ef7" d="M -5 -2 L -7 0 L -5 2 M -5 -2 L -5 2 M 5 -2 L 7 0 L 5 2 M 5 -2 L 5 2" strokeWidth="1" fill="#549ef7" vector-effect="non-scaling-stroke"></path>
                  </svg>}
                </ImgComparisonSlider>
              ) : (
                <>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <CircularProgress style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              <img src={selectedFile} alt="Uploaded" style={{ width: '100%', display: "block", boxShadow: '0px 0px 10px 5px #6464647a' }} />
            </div>
          </>

              )
            ) : (
              <video src={processedFiles[activeMethod] || selectedFile} controls style={{ width: '100%' }}>
                Your browser does not support the video tag.
              </video>
            )}
          </Box>
          
          
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Paper  sx={{backgroundColor:'rgba(0,0,0,0)'}} elevation={2}>
          <Typography variant="body2" color="text.secondary" align="center">
                Methods
                </Typography>
            {selectedFile && localSelectedModels && fileType === 'image' && (
               
              <ToggleButtonGroup
                orientation="vertical"
                value={activeMethod}
                exclusive
                
                color="warning"
                onChange={handleMethodChange}
                aria-label="background removal method"
              >
                
                {Object.entries(localSelectedModels)
                  .filter(([_, isSelected]) => isSelected)
                  .map(([method, _]) => (
                    <ToggleButton 
                      key={method} 
                      value={method} 
                      aria-label={`${method} method`}
                      disabled={processing[method]}
                      sx={{ justifyContent: 'flex-start', paddingY: 1 }}
                    >
                      {method}
                      {processing[method] && <CircularProgress size={16} sx={{ ml: 1 }} />}
                    </ToggleButton>
                  ))
                }
              </ToggleButtonGroup>
              
            )}
            </Paper>
          {selectedFile && fileType === 'video' && (
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="video-method-label" >Method</InputLabel>
            <Select
              disabled={processing[videoMethod] || Object.keys(processedFiles).length > 0}
              labelId="video-method-label"
              value={videoMethod}
              label="Method"
              onChange={handleVideoMethodChange}
            >
              {Object.entries(localSelectedModels)
                .filter(([_, isSelected]) => isSelected)
                .map(([method, _]) => (
                  <MenuItem key={method} value={method}>{method}</MenuItem>
                ))
              }
            </Select>
          </FormControl>
          {Object.keys(processedFiles).length === 0 && <Button
            variant="contained"
            color="primary"
            onClick={handleProcessVideo}
            disabled={!videoMethod || Object.values(processing).some(Boolean)}
            sx={{ mt: 2 }}
          >
            Process Video
            {processing[videoMethod] && <CircularProgress size={16} sx={{ ml: 1 }} />}
          </Button>}
          {processing[videoMethod] && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress
                variant={videoProgress === 100 ? "indeterminate" : "determinate"}
                value={videoProgress}
              />
              <Typography variant="body2" color="text.secondary" align="center">
                {statusMessage} {videoProgress < 100 && `(${Math.round(videoProgress)}%)`}
              </Typography>
            </Box>
          )}
        </Box>
      )}
            
            {processedFiles[activeMethod] && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleDownload}
                endIcon={<DownloadIcon />}
                sx={{ mt: 2 }}
              >
                Download
              </Button>
            )}
          </Box>
        </Box>
        
      ) : (
        <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
          Click here to upload an image or video
        </Typography>
      )}
    </Box>
  );
};

export default ImageUpload;