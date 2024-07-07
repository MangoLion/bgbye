import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image
from .ormbg import ORMBG

class ORMBGProcessor:
    def __init__(self, model_path):
        self.device = torch.device("cpu")
        self.net = ORMBG()
        self.net.load_state_dict(torch.load(model_path, map_location="cpu"))
        self.net.eval()

    def to(self, device):
        self.device = torch.device(device)
        self.net.to(self.device)

    def process_image(self, image):
        # Ensure image is in RGB mode
        if image.mode != "RGB":
            image = image.convert("RGB")

        # Preprocess the image
        w, h = image.size
        image = image.resize((1024, 1024), Image.BILINEAR)
        im_np = np.array(image)
        im_tensor = torch.tensor(im_np, dtype=torch.float32).permute(2, 0, 1).unsqueeze(0)
        im_tensor = torch.divide(im_tensor, 255.0).to(self.device)

        # Inference
        with torch.no_grad():
            result = self.net(im_tensor)

        # Post-process
        result = result[0][0]  # Take the first element of the output list and the first channel
        result = F.interpolate(result, size=(h, w), mode="bilinear")
        result = result.squeeze()
        result = (result - result.min()) / (result.max() - result.min())
        
        # Create mask and apply to original image
        mask = Image.fromarray((result.cpu().numpy() * 255).astype(np.uint8))
        new_im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        new_im.paste(image.resize((w, h), Image.BILINEAR), mask=mask)

        return new_im