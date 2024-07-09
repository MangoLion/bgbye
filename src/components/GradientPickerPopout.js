import React from 'react';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import ColorPicker from 'react-best-gradient-color-picker';
import ColorizeIcon from '@mui/icons-material/Colorize';

function GradientPickerPopout({ buttonLabel, color, onChange }) {
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (newColor) => {
    if (onChange) {
      onChange(newColor);
    }
  };

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  return (
    <div>
      <Button aria-describedby={id} variant="contained" onClick={handleClick} endIcon={<ColorizeIcon/>} fullWidth>
        {buttonLabel}
      </Button>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <ColorPicker value={color} onChange={handleChange} />
      </Popover>
    </div>
  );
}

export default GradientPickerPopout;
