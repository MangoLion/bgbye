from fastapi import FastAPI, UploadFile, File, Response, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image
import io
import shutil
from rembg import remove as rembg_remove, new_session
import time
import numpy as np
import tempfile
import uuid  
import os
import subprocess
from transformers import pipeline
from transparent_background import Remover
import logging
import asyncio
from datetime import datetime, timedelta
import torch
from ormbg import ORMBGProcessor 
from typing import Dict
from contextlib import contextmanager

from carvekit.ml.files.models_loc import download_all

download_all()

from carvekit.ml.wrap.u2net import U2NET
from carvekit.ml.wrap.basnet import BASNET
from carvekit.ml.wrap.fba_matting import FBAMatting
from carvekit.ml.wrap.deeplab_v3 import DeepLabV3
from carvekit.ml.wrap.tracer_b7 import TracerUniversalB7
from carvekit.api.interface import Interface
from carvekit.pipelines.postprocessing import MattingMethod
from carvekit.pipelines.preprocessing import PreprocessingStub
from carvekit.trimap.generator import TrimapGenerator


# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Add ORMBG model initialization
ormbg_model_path = os.path.expanduser("~/.ormbg/ormbg.pth")
try:
    ormbg_processor = ORMBGProcessor(ormbg_model_path)
    if torch.cuda.is_available():
        ormbg_processor.to("cuda")
    else:
        ormbg_processor.to("cpu")
except FileNotFoundError:
    logger.error(f"ORMBG model file not found: {ormbg_model_path}")
    print("Error: ORMBG model file not found. Please run 'npm run setup-server' to download it.")
    exit(1)

app = FastAPI()

# Create temp_videos folder if it doesn't exist
TEMP_VIDEOS_DIR = "temp_videos"
os.makedirs(TEMP_VIDEOS_DIR, exist_ok=True)

# Create a frames directory within temp_videos
FRAMES_DIR = os.path.join(TEMP_VIDEOS_DIR, "frames")
os.makedirs(FRAMES_DIR, exist_ok=True)

# Add a dictionary to store processing status
processing_status = {}

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def cleanup_old_videos():
    while True:
        current_time = datetime.now()
        for item in os.listdir(TEMP_VIDEOS_DIR):
            item_path = os.path.join(TEMP_VIDEOS_DIR, item)
            item_modified = datetime.fromtimestamp(os.path.getmtime(item_path))
            if current_time - item_modified > timedelta(minutes=10):
                if os.path.isfile(item_path):
                    os.remove(item_path)
                    logger.info(f"Removed old file: {item_path}")
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                    logger.info(f"Removed old directory: {item_path}")
        await asyncio.sleep(600)  # Run every 10 minutes

# Pre-load all models
bria_model = pipeline("image-segmentation", model="briaai/RMBG-1.4", trust_remote_code=True, device="cpu")
inspyrenet_model = Remover()
inspyrenet_model.model.cpu()
rembg_models = {
    'u2net': new_session('u2net'),
    'u2net_human_seg': new_session('u2net_human_seg'),
    'isnet-general-use': new_session('isnet-general-use'),
    'isnet-anime': new_session('isnet-anime')
}

def process_with_bria(image):
    result = bria_model(image, return_mask=True)
    mask = result
    if not isinstance(mask, Image.Image):
        mask = Image.fromarray((mask * 255).astype('uint8'))
    no_bg_image = Image.new("RGBA", image.size, (0, 0, 0, 0))
    no_bg_image.paste(image, mask=mask)
    return no_bg_image

def process_with_ormbg(image):
    result = ormbg_processor.process_image(image)
    return result

def process_with_inspyrenet(image):
    return inspyrenet_model.process(image, type='rgba')

def process_with_rembg(image, model='u2net'):
    return rembg_remove(image, session=rembg_models[model])

def process_with_carvekit(image, model='u2net'):
    # Initialize segmentation network based on model input
    if model == 'u2net':
        seg_net = U2NET(device='cuda', batch_size=1)
    elif model == 'tracer':
        seg_net = TracerUniversalB7(device='cuda', batch_size=1)
    elif model == 'basnet':
        seg_net = BASNET(device='cuda', batch_size=1)
    elif model == 'deeplab':
        seg_net = DeepLabV3(device='cuda', batch_size=1)
    else:
        raise ValueError("Unsupported model type")

    # Setup the post-processing components
    fba = FBAMatting(device='cuda', input_tensor_size=2048, batch_size=1)
    trimap = TrimapGenerator()
    preprocessing = PreprocessingStub()
    postprocessing = MattingMethod(matting_module=fba, trimap_generator=trimap, device='cuda')

    interface = Interface(pre_pipe=preprocessing, post_pipe=postprocessing, seg_pipe=seg_net)
    processed_image = interface([image])[0]
    
    return processed_image

@contextmanager
def inspyrenet_video_model_context():
    try:
        model = Remover()
        model.model.cuda()
        yield model
    finally:
        model.model.cpu()
        del model
        torch.cuda.empty_cache()

@contextmanager
def carvekit_video_model_context(model_name):
    try:
        if model_name == 'u2net':
            seg_net = U2NET(device='cuda', batch_size=1)
        elif model_name == 'tracer':
            seg_net = TracerUniversalB7(device='cuda', batch_size=1)
        elif model_name == 'basnet':
            seg_net = BASNET(device='cuda', batch_size=1)
        elif model_name == 'deeplab':
            seg_net = DeepLabV3(device='cuda', batch_size=1)
        else:
            raise ValueError("Unsupported model type")

        fba = FBAMatting(device='cuda', input_tensor_size=2048, batch_size=1)
        trimap = TrimapGenerator()
        preprocessing = PreprocessingStub()
        postprocessing = MattingMethod(matting_module=fba, trimap_generator=trimap, device='cuda')

        interface = Interface(pre_pipe=preprocessing, post_pipe=postprocessing, seg_pipe=seg_net)
        yield interface
    finally:
        del seg_net, fba, trimap, preprocessing, postprocessing, interface
        torch.cuda.empty_cache()

@app.post("/remove_background/")
async def remove_background(file: UploadFile = File(...), method: str = Form(...)):
    try:
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        start_time = time.time()

        # Create a lock for GPU operations
        gpu_lock = asyncio.Lock()
        
        async def process_image():
            if method == 'bria':
                return await asyncio.to_thread(process_with_bria, image)
            elif method == 'inspyrenet':
                async with gpu_lock:
                    with inspyrenet_video_model_context() as inspyrenet_model:
                        return await asyncio.to_thread(inspyrenet_model.process, image, type='rgba')
            elif method in ['u2net_human_seg', 'isnet-general-use', 'isnet-anime']:
                return await asyncio.to_thread(process_with_rembg, image, model=method)
            elif method == 'ormbg':
                async with gpu_lock:
                    return await asyncio.to_thread(process_with_ormbg, image)
            elif method in ['u2net', 'tracer', 'basnet', 'deeplab']:
                async with gpu_lock:
                    with carvekit_video_model_context(method) as carvekit_model:
                        result = await asyncio.to_thread(carvekit_model, [image])
                        return result[0]
            else:
                raise HTTPException(status_code=400, detail="Invalid method")

        no_bg_image = await process_image()
        
        process_time = time.time() - start_time
        print(f"Background removal time ({method}): {process_time:.2f} seconds")
        
        async with gpu_lock:
            torch.cuda.empty_cache()
        
        with io.BytesIO() as output:
            no_bg_image.save(output, format="PNG")
            content = output.getvalue()

        return Response(content=content, media_type="image/png")

    except Exception as e:
        print(str(e))
        raise HTTPException(status_code=500, detail=str(e))

async def process_frame(frame_path, method):
    img = Image.open(frame_path).convert('RGB')
    
    if method == 'bria':
        processed_frame = await asyncio.to_thread(process_with_bria, img)
    elif method in ['u2net_human_seg', 'isnet-general-use', 'isnet-anime']:
        processed_frame = await asyncio.to_thread(process_with_rembg, img, model=method)
    elif method == 'ormbg':
        processed_frame = await asyncio.to_thread(process_with_ormbg, img)
    else:
        raise ValueError("Invalid method")
    
    return processed_frame

async def process_video(video_path, method, video_id):
    try:
        processing_status[video_id] = {'status': 'processing', 'progress': 0, 'message': 'Initializing'}
        
        logger.info(f"Starting video processing: {video_path}")
        logger.info(f"Method: {method}")
        logger.info(f"Video ID: {video_id}")


        # Check video frame count
        frame_count_command = ['ffmpeg.ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', 
                               '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', video_path]
        process = await asyncio.create_subprocess_exec(
            *frame_count_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"Error counting frames: {stderr.decode()}")
            processing_status[video_id] = {'status': 'error', 'message': 'Error counting frames'}
            return

        frame_count = int(stdout.decode().strip())
        logger.info(f"Video frame count: {frame_count}")

        #DISABLED VIDEO LENGTH LIMIT
        #if frame_count > 250:
        #    logger.warning(f"Video too long: {frame_count} frames")
        #    processing_status[video_id] = {'status': 'error', 'message': 'Video too long (max 250 frames)'}
        #    return

        # Create a unique directory for this video's frames
        frames_dir = os.path.join(FRAMES_DIR, video_id)
        os.makedirs(frames_dir, exist_ok=True)
        logger.info(f"Created frames directory: {frames_dir}")

        # Extract frames from video
        processing_status[video_id] = {'status': 'processing', 'progress': 0, 'message': 'Extracting frames'}
        extract_command = ['ffmpeg', '-i', video_path, f'{frames_dir}/frame_%05d.png']
        logger.info(f"Executing frame extraction command: {' '.join(extract_command)}")
        process = await asyncio.create_subprocess_exec(
            *extract_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"Error extracting frames: {stderr.decode()}")
            processing_status[video_id] = {'status': 'error', 'message': 'Error extracting frames'}
            return

        # Process frames
        processing_status[video_id] = {'status': 'processing', 'progress': 0, 'message': 'Removing background'}
        frame_files = sorted([f for f in os.listdir(frames_dir) if f.endswith('.png')])
        total_frames = len(frame_files)
        logger.info(f"Number of extracted frames: {total_frames}")

        if total_frames == 0:
            logger.error("No frames were extracted from the video")
            processing_status[video_id] = {'status': 'error', 'message': 'No frames were extracted from the video'}
            return

        # Initialize the model once, outside the batch processing loop
        if method == 'inspyrenet':
            print("start init")
            model_context = inspyrenet_video_model_context()
            print("start enter")
            model = model_context.__enter__()
            print("finish enter")
        elif method in ['u2net', 'tracer', 'basnet', 'deeplab']:
            model_context = carvekit_video_model_context(method)
            model = model_context.__enter__()
        else:
            model = None  # For other methods that don't require a specific model

        try:
            async def process_frame_batch(start_idx, end_idx):
                for i in range(start_idx, min(end_idx, total_frames)):
                    frame_file = frame_files[i]
                    frame_path = os.path.join(frames_dir, frame_file)
                    img = Image.open(frame_path).convert('RGB')

                    if method == 'inspyrenet':
                        processed_frame = model.process(img, type='rgba')
                    elif method in ['u2net', 'tracer', 'basnet', 'deeplab']:
                        processed_frame = model([img])[0]
                    else:
                        processed_frame = await process_frame(frame_path, method)

                    processed_frame.save(frame_path, format='PNG')
                    progress = (i + 1) / total_frames * 100
                    processing_status[video_id] = {'status': 'processing', 'progress': progress}

            batch_size = 3
            for i in range(0, total_frames, batch_size):
                await process_frame_batch(i, i + batch_size)
                await asyncio.sleep(0)  # Allow other tasks to run

        finally:
            # Ensure we clean up the model context
            if method in ['inspyrenet', 'u2net', 'tracer', 'basnet', 'deeplab']:
                model_context.__exit__(None, None, None)

        # Create output video
        processing_status[video_id] = {'status': 'processing', 'progress': 100, 'message': 'Encoding video'}
        output_path = os.path.join(TEMP_VIDEOS_DIR, f"output_{video_id}.webm")
        create_video_command = [
            'ffmpeg',
            '-framerate', '24',
            '-i', f'{frames_dir}/frame_%05d.png',
            '-c:v', 'libvpx-vp9',
            '-pix_fmt', 'yuva420p',
            '-lossless', '1',
            output_path
        ]
        logger.info(f"Executing video creation command: {' '.join(create_video_command)}")
        process = await asyncio.create_subprocess_exec(
            *create_video_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"Error creating output video: {stderr.decode()}")
            processing_status[video_id] = {'status': 'error', 'message': 'Error creating output video'}
            return

        logger.info(f"Video processing completed. Output path: {output_path}")
        processing_status[video_id] = {'status': 'completed', 'output_path': output_path}

    except Exception as e:
        logger.exception("Error in video processing")
        processing_status[video_id] = {'status': 'error', 'message': str(e)}
    finally:
        torch.cuda.empty_cache()

        # Clean up frames directory
        for file in os.listdir(frames_dir):
            os.remove(os.path.join(frames_dir, file))
        os.rmdir(frames_dir)
        logger.info(f"Cleaned up frames directory: {frames_dir}")

@app.post("/remove_background_video/")
async def remove_background_video(background_tasks: BackgroundTasks, file: UploadFile = File(...), method: str = Form(...)):
    try:
        logger.info(f"Starting video background removal with method: {method}")
        
        # Generate a unique filename for the uploaded video
        video_id = str(uuid.uuid4())
        filename = f"input_{video_id}.mp4"
        file_path = os.path.join(TEMP_VIDEOS_DIR, filename)
        
        # Save uploaded video to the temp_videos folder
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        logger.info(f"Video file saved: {file_path}")
        logger.info(f"File exists: {os.path.exists(file_path)}")
        logger.info(f"File size: {os.path.getsize(file_path)} bytes")

        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail=f"Failed to create video file: {file_path}")

        # Start processing in the background
        background_tasks.add_task(process_video, file_path, method, video_id)
        
        return {"video_id": video_id}

    except Exception as e:
        logger.exception(f"Error in video processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error in video processing: {str(e)}")

@app.get("/status/{video_id}")
async def get_status(video_id: str):
    if video_id not in processing_status:
        raise HTTPException(status_code=404, detail="Video ID not found")
    
    status = processing_status[video_id]
    
    if status['status'] == 'completed':
        output_path = status['output_path']
        if not os.path.exists(output_path):
            raise HTTPException(status_code=404, detail="Processed video file not found")
        
        return FileResponse(output_path, media_type="video/webm", filename=f"processed_video_{video_id}.webm")
    
    return status

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_old_videos())
    


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9876)