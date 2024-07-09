import React, { useState } from 'react';
import { Button, Popover, FormGroup, FormControlLabel, Checkbox, Typography, Divider, IconButton } from '@mui/material';
import ChecklistIcon from '@mui/icons-material/Checklist';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ModelsInfo from './ModelsInfo';

const MethodSelector = ({ selectedModels, handleModelChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'method-selector-popover' : undefined;

  const handleInfoClick = (apiUrl) => {
    window.open(apiUrl, '_blank');
  };

  return (
    <>
      <Button variant="contained" onClick={handleClick} endIcon={<ChecklistIcon/>} size='small' sx={{mt:1}}>
        Select Methods
      </Button>
      <Popover
        elevation={2}
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <FormGroup sx={{ p: 1 }}>
          {Object.keys(selectedModels).map((model, index) => (
            <React.Fragment key={model}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedModels[model]}
                    onChange={handleModelChange}
                    name={model}
                  />
                }
                label={
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span>{ModelsInfo[model].displayName}</span>
                    <IconButton
                      size="small"
                      onClick={() => handleInfoClick(ModelsInfo[model].sourceUrl)}
                      style={{ marginLeft: '8px' }}
                    >
                      <HelpOutlineIcon fontSize="small" />
                    </IconButton>
                  </div>
                }
              />
              {index < Object.keys(selectedModels).length - 1 && (
                <Divider orientation="horizontal" flexItem />
              )}
            </React.Fragment>
          ))}
        </FormGroup>
      </Popover>
    </>
  );
};

export default MethodSelector;