from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "ip-traveler" / "traveler-spritesheet.png"
OUTPUT = ROOT / "assets" / "ip-traveler" / "frames"
DIRECTIONS = ("down", "left", "right", "up")


def bounds(index: int, count: int, extent: int) -> tuple[int, int]:
    return round(index * extent / count), round((index + 1) * extent / count)


def anchor(frame: Image.Image) -> tuple[int, int, int]:
    """Return visual center x, grounded-foot y, and character height."""
    alpha = frame.getchannel("A")
    points = [
        (x, y)
        for y in range(frame.height)
        for x in range(frame.width)
        if alpha.getpixel((x, y)) >= 96
    ]
    xs = sorted(x for x, _ in points)
    center_x = xs[len(xs) // 2]
    central = sorted(
        y for x, y in points if abs(x - center_x) <= round(frame.width * 0.30)
    )
    foot_y = central[min(len(central) - 1, round(len(central) * 0.995))]
    top_y = central[max(0, round(len(central) * 0.005))]
    return center_x, foot_y, max(1, foot_y - top_y)


def normalize(frame: Image.Image, target_height: int) -> Image.Image:
    """Tightly crop, scale consistently, and center on both axes."""
    bbox = frame.getchannel("A").getbbox()
    if bbox is None:
        return Image.new("RGBA", frame.size)
    subject = frame.crop(bbox)
    scale = target_height / subject.height
    subject = subject.resize(
        (round(subject.width * scale), target_height),
        Image.Resampling.LANCZOS,
    )
    output = Image.new("RGBA", frame.size)
    output.alpha_composite(
        subject,
        ((frame.width - subject.width) // 2, (frame.height - subject.height) // 2),
    )
    return output


def main() -> None:
    sheet = Image.open(SOURCE).convert("RGBA")
    OUTPUT.mkdir(parents=True, exist_ok=True)

    for row, direction in enumerate(DIRECTIONS):
        y0, y1 = bounds(row, 4, sheet.height)
        direction_dir = OUTPUT / direction
        direction_dir.mkdir(exist_ok=True)
        raw_frames = []

        for column in range(5):
            x0, x1 = bounds(column, 5, sheet.width)
            raw_frames.append(sheet.crop((x0, y0, x1, y1)))

        target_height = round((y1 - y0) * 0.86)
        all_frames = [normalize(frame, target_height) for frame in raw_frames]
        frames = []
        for column, frame in enumerate(all_frames):
            name = "idle.png" if column == 0 else f"walk-{column}.png"
            frame.save(direction_dir / name)
            if column > 0:
                frames.append(frame)

        # A restrained two-frame loop is steadier than cycling all generated poses.
        loop_frames = [all_frames[1], all_frames[3]]
        loop_frames[0].save(
            direction_dir / "walk.gif",
            save_all=True,
            append_images=loop_frames[1:],
            duration=220,
            loop=0,
            disposal=2,
            transparency=0,
            optimize=False,
        )


if __name__ == "__main__":
    main()
