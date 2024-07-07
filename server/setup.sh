#!/bin/bash

# Update package list
sudo apt update

# Install system dependencies
sudo apt install -y python3-pip python3-venv pngcrush libjpeg-turbo-progs jpegoptim \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev ffmpeg

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install fastapi uvicorn transformers pillow scikit-image transparent-background rembg opencv-python-headless python-multipart requests

# Ensure stuff is in the PATH
echo 'export PATH=$PATH:$HOME/.local/bin' >> ~/.bashrc
source ~/.bashrc

# Install additional requirements if there's a requirements.txt file
if [ -f requirements.txt ]; then
    pip install -r requirements.txt
fi

echo "Setup completed successfully!"