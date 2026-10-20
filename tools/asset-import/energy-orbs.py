#!/usr/bin/env python3
"""Recorta as 8 bolas de Energia que vão ligadas nas cartas do atlas `src/presentation/assets/source/energy/energys.png`.

Saída: `src/presentation/assets/energy/<tipo>.webp` (128×128, sem perda, com transparência). O atlas tem outros
elementos de interface (deck, sinal de mais, anéis) e as bolas de Incolor e Dragão, que não são Energia ligada: só
as 8 dos tipos geráveis da Zona saem daqui. O centro de cada bola é refinado pelo alfa a partir do ponto medido no
atlas, e um círculo de raio 64 recorta o que vaza das vizinhas (as bolas encostam umas nas outras).

Uso: python tools/asset-import/energy-orbs.py [--check]   (--check: não grava; sai com 1 se algo difere do disco)
Requer Pillow.
"""
from pathlib import Path
import io
import sys

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ATLAS = ROOT / 'src' / 'presentation' / 'assets' / 'source' / 'energy' / 'energys.png'
OUT = ROOT / 'src' / 'presentation' / 'assets' / 'energy'
SIZE = 128
RADIUS = 64

# Centro aproximado de cada bola no atlas 1024×1024 (medido; refinado pelo alfa abaixo).
APPROX = {
    'grass': (668, 345), 'fire': (668, 212), 'water': (876, 678), 'lightning': (533, 75),
    'psychic': (535, 345), 'fighting': (803, 345), 'darkness': (930, 210), 'metal': (535, 212),
}


def opaque(im: Image.Image, x: int, y: int) -> bool:
    return 0 <= x < im.width and 0 <= y < im.height and im.getpixel((x, y))[3] > 40


def extent(im: Image.Image, x: int, y: int, dx: int, dy: int, limit: int = 120) -> int:
    n = 0
    while n < limit and opaque(im, x + dx * (n + 1), y + dy * (n + 1)):
        n += 1
    return n


def center(im: Image.Image, cx: int, cy: int) -> tuple[float, float]:
    # x: a linha do centro atravessa a bola inteira (as vizinhas laterais ficam além do raio na maioria).
    left, right = extent(im, cx, cy, -1, 0), extent(im, cx, cy, 1, 0)
    x = cx + (right - left) / 2
    # y: colunas a ±45 px do centro cortam a bola longe do ponto onde as vizinhas de cima e de baixo encostam.
    ys = []
    for off in (-45, 45):
        col = round(x) + off
        up, down = extent(im, col, cy, 0, -1), extent(im, col, cy, 0, 1)
        ys.append(cy + (down - up) / 2)
    return x, sum(ys) / len(ys)


def orb(im: Image.Image, name: str) -> bytes:
    x, y = center(im, *APPROX[name])
    left, top = round(x - SIZE / 2), round(y - SIZE / 2)
    tile = im.crop((left, top, left + SIZE, top + SIZE))
    mask = Image.new('L', (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, SIZE * 4 - 1, SIZE * 4 - 1), fill=255)
    mask = mask.resize((SIZE, SIZE), Image.LANCZOS)
    alpha = Image.composite(tile.getchannel('A'), Image.new('L', (SIZE, SIZE), 0), mask)
    tile.putalpha(alpha)
    buf = io.BytesIO()
    tile.save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=False)
    return buf.getvalue()


def main() -> int:
    check = '--check' in sys.argv[1:]
    if not ATLAS.exists():
        print(f'origem ausente: {ATLAS}', file=sys.stderr)
        return 1
    im = Image.open(ATLAS).convert('RGBA')
    diffs, written = [], 0
    for name in APPROX:
        data = orb(im, name)
        path = OUT / f'{name}.webp'
        if path.exists() and path.read_bytes() == data:
            continue
        if check:
            diffs.append(path.relative_to(ROOT).as_posix())
            continue
        OUT.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        written += 1
    if check:
        if diffs:
            print('difere do atlas: ' + ', '.join(diffs), file=sys.stderr)
            return 1
        print('bolas de Energia iguais ao atlas')
    else:
        print(f'{written} bola(s) gravada(s) em {OUT.relative_to(ROOT).as_posix()}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
