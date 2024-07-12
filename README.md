# BGBye

## Installation

### Prerequisites

- Latest Node.js and npm
- python3 and python3-pip
- Windows users must use **Windows Subsystem for Linux (WSL)**
- Concurrently (optional): for running both server and client at once.
  `npm i concurrently -g`

### Steps

1. Clone the repository:
   ```
   git clone https://github.com/MangoLion/bgbye
   cd bgbye
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up the server:
   ```
   npm run setup-server
   ```
   **Make sure to restart your terminal after!**

### AMD GPU
Goto `./server/setp.sh` and replace the index url with
`--index-url https://download.pytorch.org/whl/rocm6.0`

Do this **before** calling `npm run setup-server`

### Diagnosis
- NPM takes forever to install? (WSL)
  - You probably didn't install npm on WSL, so its using npm on windows. Install npm on WSL first.
- Internal server error 500 whenever submit an image/video
  - Could be CUDA issues, make sure your cuda GPU is visible (nvidia-smi)?
- Internal server error 500 whenever submit a video, but image works
  - Check if ffmpeg is installed

## Running the App

To start both the web app and server, run:

```
npm start
```

## Moar notes

I'm so sorry this is using the long dead create-react-app template! Was setting up Cloudflare Pages for the first time and their tutorial installed CRA 💀

I'll move this stuff to Vite later