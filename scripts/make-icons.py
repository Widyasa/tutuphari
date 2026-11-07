"""Draw original TutupHari icons. No third-party artwork."""

import struct
import zlib
from pathlib import Path

STONE = (245, 245, 244)
GREEN = (20, 83, 45)
WHITE = (255, 255, 255)
ROOT = Path(__file__).resolve().parents[1] / "public" / "icons"


def write_png(path: Path, width: int, height: int, pixels: bytes) -> None:
    raw = bytearray()
    stride = width * 3
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * stride : (y + 1) * stride])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def in_round_rect(x: float, y: float, x0: float, y0: float, x1: float, y1: float, radius: float) -> bool:
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    dx = 0.0
    dy = 0.0
    if x < x0 + radius:
        dx = x0 + radius - x
    elif x > x1 - radius:
        dx = x - (x1 - radius)
    if y < y0 + radius:
        dy = y0 + radius - y
    elif y > y1 - radius:
        dy = y - (y1 - radius)
    return dx * dx + dy * dy <= radius * radius


def in_ellipse(x: float, y: float, cx: float, cy: float, rx: float, ry: float) -> bool:
    if rx <= 0 or ry <= 0:
        return False
    dx = (x - cx) / rx
    dy = (y - cy) / ry
    return dx * dx + dy * dy <= 1


def sample(x: float, y: float, size: int, maskable: bool) -> tuple[int, int, int]:
    if maskable:
        background = GREEN
        plate = False
    else:
        background = STONE
        pad = size * 0.08
        plate = in_round_rect(x, y, pad, pad, size - pad, size - pad, size * 0.18)
    base = GREEN if plate or maskable else background

    scale = 0.34 if maskable else 0.42
    mark = size * scale
    left = (size - mark) / 2
    top = size * 0.40
    stroke = max(size * 0.012, 1)
    body = in_round_rect(x, y, left, top, left + mark, top + mark * 0.62, size * 0.035)
    inner = in_round_rect(
        x,
        y,
        left + stroke,
        top + stroke,
        left + mark - stroke,
        top + mark * 0.62 - stroke,
        max(size * 0.02, 1),
    )
    handle = in_round_rect(
        x,
        y,
        size / 2 - mark * 0.14,
        top + mark * 0.24,
        size / 2 + mark * 0.14,
        top + mark * 0.38,
        size * 0.02,
    )
    coin_ring = in_ellipse(x, y, size / 2, top - mark * 0.16, mark * 0.16, mark * 0.16)
    coin_hole = in_ellipse(x, y, size / 2, top - mark * 0.16, mark * 0.16 - stroke, mark * 0.16 - stroke)
    if handle or (body and not inner) or (coin_ring and not coin_hole):
        return WHITE
    return base


def render(size: int, maskable: bool) -> bytes:
    pixels = bytearray()
    for y in range(size):
        for x in range(size):
            red = green = blue = 0
            for oy in (0.25, 0.75):
                for ox in (0.25, 0.75):
                    r, g, b = sample(x + ox, y + oy, size, maskable)
                    red += r
                    green += g
                    blue += b
            pixels.extend((red // 4, green // 4, blue // 4))
    return bytes(pixels)


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for size, maskable, name in (
        (192, False, "icon-192.png"),
        (512, False, "icon-512.png"),
        (192, True, "icon-maskable-192.png"),
        (512, True, "icon-maskable-512.png"),
        (180, False, "apple-touch-icon.png"),
    ):
        write_png(ROOT / name, size, size, render(size, maskable))
        print(name)


if __name__ == "__main__":
    main()
