import React, { useState } from 'react';
import { Button, Popover, FormGroup, FormControlLabel, Checkbox, Typography, Divider } from '@mui/material';
import ChecklistIcon from '@mui/icons-material/Checklist';
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
                label={model}
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