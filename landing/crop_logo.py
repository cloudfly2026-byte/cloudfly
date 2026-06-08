import sys
from PIL import Image

def trim_image(img_path, output_path):
    print(f"Trimming {img_path}...")
    img = Image.open(img_path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Get bounding box of non-zero alpha pixels
    bbox = img.getbbox()
    if bbox:
        trimmed = img.crop(bbox)
        trimmed.save(output_path, "PNG")
        print(f"Trimmed successfully! New size: {trimmed.size}")
    else:
        print("No non-transparent content found!")

if __name__ == "__main__":
    trim_image("c:/apps/cloudfly/landing/logo.png", "c:/apps/cloudfly/landing/logo_trimmed.png")
