from pathlib import Path
from colorsys import rgb_to_hsv

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\27254\.codex\attachments\d45bb26c-c022-4b46-a7d7-902e423ead14\image-1.png")
OUTPUT = ROOT / "assets" / "ip-traveler" / "static"
DIRECTIONS = ("down", "up", "left", "right")


def background_to_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    result = Image.new("RGBA", rgba.size)
    source = rgba.load()
    target = result.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = source[x, y]
            _, saturation, value = rgb_to_hsv(r / 255, g / 255, b / 255)
            saturation *= 255
            value *= 255
            # The supplied paper background is bright and nearly unsaturated.
            color_alpha = (saturation - 20) / 52
            dark_alpha = (246 - value) / 40
            alpha = round(255 * max(0.0, min(1.0, max(color_alpha, dark_alpha))))
            target[x, y] = (r, g, b, alpha)
    return result


def main() -> None:
    source = Image.open(SOURCE).convert("RGB")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    column_width = source.width / 4
    row_height = source.height / 2

    for column, direction in enumerate(DIRECTIONS):
        crop = source.crop(
            (
                round(column * column_width),
                0,
                round((column + 1) * column_width),
                round(row_height),
            )
        )
        crop.save(OUTPUT / f"{direction}-original.png")

        transparent = background_to_alpha(crop)
        bbox = transparent.getchannel("A").getbbox()
        if bbox:
            padding = 10
            bbox = (
                max(0, bbox[0] - padding),
                max(0, bbox[1] - padding),
                min(crop.width, bbox[2] + padding),
                min(crop.height, bbox[3] + padding),
            )
            transparent = transparent.crop(bbox)
        transparent.save(OUTPUT / f"{direction}.png")


if __name__ == "__main__":
    main()
