import sys
from PIL import Image

def crop_exact():
    print("Opening logo.png...")
    img = Image.open("c:/apps/cloudfly/landing/logo.png")
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    alpha = img.split()[-1]
    # Filter alpha channel to find non-transparent pixels (ignoring compression noise)
    bbox = alpha.point(lambda p: 255 if p > 10 else 0).getbbox()
    if bbox:
        trimmed = img.crop(bbox)
        # Save overwrite
        trimmed.save("c:/apps/cloudfly/landing/logo.png", "PNG")
        print(f"Overwritten successfully! New size: {trimmed.size}")
    else:
        print("Bbox failed!")

if __name__ == "__main__":
    crop_exact()
