#!/usr/bin/env python3
"""Generate PWA icons from in-game class silhouettes.

Vertex math matches PlayerBase.getBaseShapeVertices in js/players/player-base.js.
Colors match CLASS_DEFINITIONS (Warrior / Rogue / Tank / Mage).
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'icons'
BG = (15, 15, 26, 255)  # #0f0f1a nexus void

CLASSES = [
    ('square', (74, 144, 226)),    # Warrior #4a90e2
    ('triangle', (255, 20, 147)),  # Rogue #ff1493
    ('pentagon', (199, 37, 37)),   # Tank #c72525
    ('hexagon', (103, 58, 183)),   # Mage #673ab7
]


def base_shape_vertices(shape: str, size: float):
    """Mirror PlayerBase.getBaseShapeVertices."""
    if shape == 'triangle':
        return [
            (size, 0.0),
            (-size * 0.5, -size * 0.8660254038),
            (-size * 0.5, size * 0.8660254038),
        ]
    if shape == 'hexagon':
        return [
            (math.cos((math.pi / 3) * i) * size, math.sin((math.pi / 3) * i) * size)
            for i in range(6)
        ]
    if shape == 'pentagon':
        rotation_offset = 18 * math.pi / 180
        return [
            (
                math.cos((math.pi * 2 / 5) * i - math.pi / 2 + rotation_offset) * size,
                math.sin((math.pi * 2 / 5) * i - math.pi / 2 + rotation_offset) * size,
            )
            for i in range(5)
        ]
    s = size * 0.8
    return [(-s, -s), (s, -s), (s, s), (-s, s)]


def draw_grid(draw: ImageDraw.ImageDraw, size: int, pad: int) -> None:
    step = max(8, size // 16)
    color = (100, 100, 150, 28)
    for x in range(pad, size - pad + 1, step):
        draw.line([(x, pad), (x, size - pad)], fill=color)
    for y in range(pad, size - pad + 1, step):
        draw.line([(pad, y), (size - pad, y)], fill=color)


def draw_shape(draw, cx, cy, shape, color, size) -> None:
    verts = base_shape_vertices(shape, size)
    pts = [(cx + x, cy + y) for x, y in verts]
    draw.polygon(pts, fill=color + (255,))
    max_x = max(x for x, _ in verts)
    r = max(2.0, min(size * 0.12, size * 0.08 * (25.0 / 12.0)))
    ix = cx + max_x - r * 1.5
    draw.ellipse([ix - r, cy - r, ix + r, cy + r], fill=(255, 255, 255, 255))


def render_icon(size: int, *, maskable: bool = False) -> Image.Image:
    img = Image.new('RGBA', (size, size), BG)
    draw = ImageDraw.Draw(img, 'RGBA')

    if maskable:
        content = int(size * 0.72)
        origin = (size - content) // 2
    else:
        content = int(size * 0.88)
        origin = (size - content) // 2

    draw_grid(draw, size, max(0, origin - size // 32))

    cell = content / 2
    shape_size = cell * 0.32
    positions = [
        (origin + cell * 0.5, origin + cell * 0.5),
        (origin + cell * 1.5, origin + cell * 0.5),
        (origin + cell * 0.5, origin + cell * 1.5),
        (origin + cell * 1.5, origin + cell * 1.5),
    ]
    for (cx, cy), (shape, color) in zip(positions, CLASSES):
        draw_shape(draw, cx, cy, shape, color, shape_size)

    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    specs = [
        ('icon-192.png', 192, False),
        ('icon-512.png', 512, False),
        ('icon-512-maskable.png', 512, True),
        ('apple-touch-icon.png', 180, False),
    ]
    for name, size, maskable in specs:
        path = OUT / name
        render_icon(size, maskable=maskable).save(path, 'PNG')
        print(f'wrote {path}')


if __name__ == '__main__':
    main()
