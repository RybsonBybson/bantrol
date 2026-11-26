"""Builds padded Android icon sources from the Bantrol logo.

The adaptive-icon foreground is the B mark on a transparent canvas, so the
launcher can apply its own mask and the mark never touches the edges.
"""
from PIL import Image

SRC = "icons/bantrol-app-logo.png"
SIZE = 1080
BG = (238, 108, 77)  # Burnt Peach
FG = (24, 29, 38)  # Ink Black


def foreground() -> Image.Image:
    image = Image.open(SRC).convert("RGBA")
    source = image.load()
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    target = out.load()
    direction = tuple(BG[i] - FG[i] for i in range(3))
    denom = sum(component * component for component in direction)

    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = source[x, y]
            delta = (BG[0] - red, BG[1] - green, BG[2] - blue)
            projection = sum(delta[i] * direction[i] for i in range(3))
            blend = max(0.0, min(1.0, projection / denom))
            target[x, y] = (*FG, round(blend * alpha))

    box = out.getbbox()
    if box is None:
        raise SystemExit("the logo has no visible mark")
    mark = out.crop(box)

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    scale = min(648 / mark.width, 648 / mark.height)
    mark = mark.resize(
        (round(mark.width * scale), round(mark.height * scale)),
        Image.LANCZOS,
    )
    canvas.alpha_composite(
        mark,
        ((SIZE - mark.width) // 2, (SIZE - mark.height) // 2),
    )
    return canvas


def padded_logo() -> Image.Image:
    image = Image.open(SRC).convert("RGBA")
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    side = 810
    image = image.resize((side, side), Image.LANCZOS)
    canvas.alpha_composite(image, ((SIZE - side) // 2, (SIZE - side) // 2))
    return canvas


def main() -> None:
    foreground().save("icons/bantrol-icon-foreground.png")
    padded_logo().save("icons/bantrol-icon-padded.png")
    Image.new("RGBA", (SIZE, SIZE), (*BG, 255)).save(
        "icons/bantrol-icon-background.png"
    )
    print("wrote icon sources")


if __name__ == "__main__":
    main()
