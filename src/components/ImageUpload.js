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
  Checkbox,
  FormControlLabel,
  useMediaQuery,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import axios from 'axios';
import { ImgComparisonSlider } from '@img-comparison-slider/react';
import pLimit from 'p-limit';
import GradientPickerPopout from './GradientPickerPopout';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import Magnifier from 'react18-image-magnifier'
import ModelsInfo from './ModelsInfo';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import GradientIcon from '@mui/icons-material/Gradient';

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
  const [dragOver, setDragOver] = useState(false);

  const [doZoom, setDoZoom] = useState(false);

  const [transparent, setTransparent] = useState(true);
  const [colorBG, setColorBG] = useState('radial-gradient(circle, #fcdfa4 0%, #ffd83b 100%)'); //useState('radial-gradient(circle, #87CEFA 0%, #1E90FF 100%)');

  const [imageWidth, setImageWidth] = useState('500px'); // Default width

  useEffect(() => {
    if (selectedFile) {
      const image = new Image();
      image.onload = () => {
        setImageWidth(`${image.width}px`);
      };
      image.src = selectedFile;
    }
  }, [selectedFile]);


  const theme = useTheme();
  const isPortrait = useMediaQuery('(orientation: portrait)');

  const fileInputID = "fileInput" + fileID.toString();

  const getModelAPIURL = (method)=>{
    console.log(method, ModelsInfo[method].apiUrlVar, process.env[ModelsInfo[method].apiUrlVar]);

    return process.env[ModelsInfo[method].apiUrlVar];
  }

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
      const response = await axios.post(`${getModelAPIURL(method)}/${endpoint}/`, formData, {
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

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } };
      handleFileUpload(fakeEvent);
    }
  }, [handleFileUpload]);

  const handleMethodChange = (event, newMethod) => {
    if (newMethod !== null) {
      setActiveMethod(newMethod);
    }
  };

  const handleVideoMethodChange = (event) => {
    setVideoMethod(event.target.value);
  };

  const pollVideoStatus = useCallback(async (id, url) => {
    try {
      const response = await axios.get(`${url}/status/${id}`, {
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
          setTimeout(() => pollVideoStatus(id, url), 4000); // Poll every second
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

      //DISABLED VIDEO LENGTH LIMIT
      //if (estimatedFrameCount > 250) {
      //  showErrorToast(`Video too long (${estimatedFrameCount} estimated frames). Maximum allowed: 250 frames.`);
      //  setProcessing({ [videoMethod]: false });
      //  return;
      //}

      const formData = new FormData();
      formData.append('file', file);
      formData.append('method', videoMethod);

      const response = await axios.post(`${getModelAPIURL(videoMethod)}/remove_background_video/`, formData, {
        withCredentials: false,
      });


      setVideoId(response.data.video_id);
      pollVideoStatus(response.data.video_id, getModelAPIURL(videoMethod));
    } catch (error) {
      console.error('Error processing video:', error);
      setProcessing({ [videoMethod]: false });
      showErrorToast('Error processing video: ', error);
    }
  };

  const handleDownload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const image = new Image();
    image.src = processedFiles[activeMethod];

    image.onload = () => {
        canvas.width = image.width;
        canvas.height = image.height;

        if (fileType === 'image' && transparent === false) {
            if (colorBG.includes("gradient")) {
                const tempDiv = document.createElement("div");
                tempDiv.style.display = 'none'; // Hide the div while it's appended
                tempDiv.style.background = colorBG;
                document.body.appendChild(tempDiv);
                const computedStyle = window.getComputedStyle(tempDiv);
                const bgImage = computedStyle.backgroundImage;
                document.body.removeChild(tempDiv);

                if (bgImage.startsWith('linear-gradient')) {
                    parseLinearGradient(ctx, bgImage, canvas.width, canvas.height);
                } else if (bgImage.startsWith('radial-gradient')) {
                    parseRadialGradient(ctx, bgImage, canvas.width, canvas.height);
                }
            } else {
                ctx.fillStyle = colorBG;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }

        ctx.drawImage(image, 0, 0);

        const fileExtension = fileType === 'video' ? 'webm' : 'png';
        const newFilename = `${originalFilename.split('.')[0]}_${activeMethod}.${fileExtension}`;

        const link = document.createElement('a');
        link.href = canvas.toDataURL(`image/${fileExtension}`);
        link.download = newFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
};

function parseLinearGradient(ctx, bgImage, width, height) {
    const colors = bgImage.match(/rgba?\([^)]+\)/g);
    const linearGradient = ctx.createLinearGradient(0, 0, width, 0);
    colors.forEach((color, index) => {
        const position = index / (colors.length - 1);
        linearGradient.addColorStop(position, color);
    });
    ctx.fillStyle = linearGradient;
    ctx.fillRect(0, 0, width, height);
}

function parseRadialGradient(ctx, bgImage, width, height) {
    const colors = bgImage.match(/rgba?\([^)]+\)/g);
    const radialGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
    colors.forEach((color, index) => {
        const position = index / (colors.length - 1);
        radialGradient.addColorStop(position, color);
    });
    ctx.fillStyle = radialGradient;
    ctx.fillRect(0, 0, width, height);
}


return (
  <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: (!selectedFile) ? '2px dashed' : 'none',
        borderColor: dragOver ? theme.palette.primary.main : theme.palette.text.disabled,
        borderRadius: 1,
        p: isPortrait ? 0 : 2,
        mt: 2,
        textAlign: 'center',
        cursor: !selectedFile && !processing ? 'pointer' : 'default',
        position: 'relative',
        backgroundColor: dragOver ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
        transition: 'all 0.3s ease',
      }}
      onClick={() => !selectedFile && !Object.values(processing).some(Boolean) && document.getElementById(fileInputID).click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
     {!selectedFile && (
        <input
          type="file"
          id={fileInputID}
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      )}

    {selectedFile ? (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: isPortrait ? 'column' : 'row',
        alignItems: 'flex-start', 
        width: '100%', 
        maxWidth: '1024px',
        position: 'relative',
      }}>
         
        <Box sx={{ 
          flex: 1, 
          maxWidth: '1280px', 
          mr: isPortrait ? 0 : 2,
          mb: isPortrait ? 2 : 0,
          width: '100%',
        }}>
            {fileType === 'image' ? (
              processedFiles[activeMethod] ? (
                <div 
                  className={transparent ? "checkerboard" : ""}
                  style={!transparent ? { background: colorBG } : {}}
                >
                  <ToggleButton
                    value="zoom"
                    selected={doZoom}
                    onChange={() => setDoZoom(!doZoom)}
                    aria-label="zoom in"
                    size='small'
                    color='primary'
                    sx={{
                      position: 'absolute',
                      top: '3em', 
                      left: '3em', 
                      zIndex: 9999
                    }}
                  >
                    <ZoomInIcon color='primary'/>
                  </ToggleButton>

                  {doZoom && <Magnifier src={processedFiles[activeMethod]} width={imageWidth}/>}
               
                {!doZoom && <ImgComparisonSlider class="slider-example-focus">
                  <img slot="first" src={selectedFile} alt="Original" style={{ width: '100%' }} />
                  <img slot="second" src={processedFiles[activeMethod]} alt="Processed" style={{ width: '100%' }} />
                  {false && <svg slot="handle" xmlns="http://www.w3.org/2000/svg" width="100" viewBox="-8 -3 16 6">
                    <path stroke="#549ef7" d="M -5 -2 L -7 0 L -5 2 M -5 -2 L -5 2 M 5 -2 L 7 0 L 5 2 M 5 -2 L 5 2" strokeWidth="1" fill="#549ef7" vectorEffect="non-scaling-stroke"></path>
                  </svg>}
                </ImgComparisonSlider>}
                </div>
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
          
          
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            position: isPortrait ? 'absolute' : 'static',
            top: isPortrait ? '1em' : 'auto',
            right: isPortrait ? '1em' : 'auto',
            zIndex: isPortrait ? 1000 : 'auto',
          }}>
           {(!isPortrait || fileType !== 'video') && <Paper sx={{
              backgroundColor: isPortrait ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0)',
              padding: isPortrait ? 1 : 0,
            }} elevation={2}>
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
                  sx={{
                    flexDirection: 'column',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                  }}
                >
                  {Object.entries(localSelectedModels)
                    .filter(([_, isSelected]) => isSelected)
                    .map(([method, _]) => (
                      <ToggleButton 
                      size="small"
                        key={method} 
                        value={method} 
                        aria-label={`${method} method`}
                        disabled={processing[method]}
                        sx={{ 
                          justifyContent: 'space-between', 
                        }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="flex-start" width="100%">
                          {isPortrait ? ModelsInfo[method].shortName : ModelsInfo[method].displayName}
                          {processing[method] && <CircularProgress size={16} sx={{ ml: 1 }} />}
                        </Box>
                      </ToggleButton>
                    ))
                  }
                </ToggleButtonGroup>
              )}
            </Paper>}
          {selectedFile && fileType === 'video' && (
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="video-method-label" >Method</InputLabel>
            <Select
              disabled={processing[videoMethod] || Object.keys(processedFiles).length > 0}
              labelId="video-method-label"
              value={videoMethod}
              label="Method"
              sx={{backgroundColor:isPortrait? theme.palette.info.contrastText :''}}
              onChange={handleVideoMethodChange}
            >
              {Object.entries(localSelectedModels)
                .filter(([_, isSelected]) => isSelected)
                .map(([method, _]) => (
                  <MenuItem key={method} value={method}>{ModelsInfo[method].displayName}</MenuItem>
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
              <>
             

              {!isPortrait && <FormControlLabel
                  control={<Checkbox checked={transparent} onChange={(e)=>setTransparent(e.target.checked)} />}
                  label="Transparent"
                  sx={{color:theme.palette.text.primary}}
              />}

              {isPortrait && <ToggleButton sx={{backgroundColor:theme.palette.divider, p:0}}  value="transparent" selected={!transparent} onChange={()=>{setTransparent(!transparent)}}><GradientIcon fontSize='large' color='primary'/></ToggleButton>}

              {!transparent && <GradientPickerPopout
                buttonLabel={!isPortrait ? "Background" : ""}
                
                color={colorBG}
                onChange={newColor => setColorBG(newColor)}
              />}

                <Button
                variant="contained"
                color="primary"
                onClick={handleDownload}
                endIcon={<DownloadIcon />}
                sx={{ mt: 2 }}
              >
                {!isPortrait && "Download"}
              </Button>
              </>
            )}
          </Box>
        </Box>
      ) : (
        <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
          {dragOver ? "Drop your image or video here" : "Click or drag and drop to upload an image or video"}
        </Typography>
      )}
    </Box>
  );
};

export default ImageUpload;