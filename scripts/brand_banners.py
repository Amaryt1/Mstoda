from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import io

ROOT = Path("source-images/aa")
OUT = Path("branded-banners")
ITEMS = [
    ("iQFace Banner.jpg", "iQFace Banner.jpg"),
    ("iQGram Banner.webp", "iQGram Banner.webp"),
    ("iQSwift Banner.webp", "iQSwift Banner.webp"),
    ("iQTele Banner.webp", "iQTele Banner.webp"),
    ("iQTube Banner.webp", "iQTube Banner.webp"),
    ("iQTv Banner.webp", "iQTv Banner.webp"),
]

def font_for(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()

OUT.mkdir(parents=True, exist_ok=True)
for source_name, output_name in ITEMS:
    path = ROOT / source_name
    if not path.is_file():
        raise FileNotFoundError(path)
    image = Image.open(path).convert("RGBA")
    width, height = image.size

    # A restrained dark translucent footer keeps the original artwork visible.
    band_h = max(42, int(height * 0.17))
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    top = height - band_h
    for y in range(top, height):
        progress = (y - top) / max(1, band_h - 1)
        alpha = int(18 + 112 * progress)
        draw.line((0, y, width, y), fill=(8, 10, 18, alpha))
    image = Image.alpha_composite(image, overlay)

    draw = ImageDraw.Draw(image)
    font_size = max(13, min(int(height * 0.075), int(width * 0.052), 42))
    font = font_for(font_size)
    label = "AMARYT @LLYDL"
    bbox = draw.textbbox((0, 0), label, font=font, stroke_width=0)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (width - text_w) // 2
    y = top + (band_h - text_h) // 2 - bbox[1]
    # Subtle shadow improves contrast without changing the logo/artwork.
    draw.text((x + 1, y + 2), label, font=font, fill=(0, 0, 0, 150))
    draw.text((x, y), label, font=font, fill=(255, 255, 255, 245))

    output = OUT / output_name
    fmt = "JPEG" if output.suffix.lower() in (".jpg", ".jpeg") else "WEBP"
    if fmt == "JPEG":
        image.convert("RGB").save(output, format=fmt, quality=94, optimize=True)
    else:
        image.save(output, format=fmt, quality=94, method=6)
    print(f"Created {output} ({width}x{height})")
