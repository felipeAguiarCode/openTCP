#!/usr/bin/env python3
"""Arte oficial dos pacotes: a frente de cada booster para as telas de pacotes e a abertura 3D.

Origem (decisão do autor, 16/10/2026): as imagens de `.inspo/boosters/` fornecidas pelo autor e, para os três pacotes
do Genetic Apex, as da página do set no Serebii, baixadas uma vez para `.inspo/boosters/serebii/` (o Bulbagarden
recusa acesso automatizado). As do Serebii são JPG com fundo branco: o branco ligado às bordas vira transparente.

Saída: `src/presentation/assets/packs/<productId>.webp` — margens transparentes cortadas, no máximo 640 px de
altura, WebP qualidade 88 com transparência. Pacote tutorial e promocionais não têm arte oficial: não saem daqui.

Uso: python tools/inspo-import/pack-art.py [--check]   (--check: não grava; sai com 1 se algo difere do disco)
Requer Pillow.
"""
from pathlib import Path
import io
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / '.inspo' / 'boosters'
OUT = ROOT / 'src' / 'presentation' / 'assets' / 'packs'
MAX_H = 640

PACKS = {
    'pack-a1-pikachu': 'serebii/genetic-apex-pikachu.jpg',
    'pack-a1-charizard': 'serebii/genetic-apex-charizard.jpg',
    'pack-a1-mewtwo': 'serebii/genetic-apex-mewtwo.jpg',
    'pack-a1a-mew': 'Pokemon_Trading_Card_Game_Pocket_Mythical_Island_Booster_Pack.png',
    'pack-a2-dialga': 'Dialga_Booster_Front_EN.png',
    'pack-a2-palkia': 'Palkia_Booster_Front_EN.png',
    'pack-a2a-arceus': 'Pokemon_Trading_Card_Game_Pocket_Triumphant_Light_Booster_Art_EN.png',
    'pack-a3-solgaleo': 'Pokemon_TCG_Pocket_Celestial_Guardians_Booster_Pack_Solgaleo_(Front).png',
    'pack-a3-lunala': 'Pokemon_TCG_Pocket_Celestial_Guardians_Booster_Pack_Lunala_(Front).png',
    'pack-a3a': 'Pokemon_Trading_Card_Game_Pocket_Extradimensional_Crisis_Booster_Pack_Art_EN.png',
    'pack-a3b': 'Pokemon_TCG_Pocket_Eevee_Grove_Booster_Pack_Art_EN.png',
    'pack-a4-lugia': 'Pokemon_Pocket_Wisdom_of_Sea_and_Sky_Booster_Pack_Art_Lugia_EN.png',
    'pack-a4-ho-oh': 'Pokemon_Pocket_Wisdom_of_Sea_and_Sky_Booster_Pack_Art_Ho_Oh_EN.png',
    'pack-a4a': 'Pokemon_TCG_Pocket_Secluded_Springs_Booster_Pack_Art.png',
    'pack-a4b': 'Pokemon_Trading_Card_Game_Pocket_Deluxe_Pack_ex_Booster_Pack_EN.png',
}


def clear_white_background(im: Image.Image) -> Image.Image:
    """JPG sem alfa: o branco ligado às bordas (fora do pacote) vira transparente, com 1 px de suavização."""
    rgb = im.convert('RGB')
    marker = (255, 0, 255)
    flood = rgb.copy()
    w, h = flood.size
    for x in range(w):
        for y in (0, h - 1):
            if flood.getpixel((x, y)) != marker and min(flood.getpixel((x, y))) > 225:
                ImageDraw.floodfill(flood, (x, y), marker, thresh=40)
    for y in range(h):
        for x in (0, w - 1):
            if flood.getpixel((x, y)) != marker and min(flood.getpixel((x, y))) > 225:
                ImageDraw.floodfill(flood, (x, y), marker, thresh=40)
    mask = Image.new('L', (w, h), 255)
    mask.putdata([0 if p == marker else 255 for p in flood.get_flattened_data()])
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert('RGBA')
    out.putalpha(mask)
    return out


def pack(name: str) -> bytes:
    im = Image.open(SRC / name)
    im = im.convert('RGBA') if 'A' in im.getbands() else clear_white_background(im)
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if box:
        im = im.crop(box)
    if im.height > MAX_H:
        im = im.resize((round(im.width * MAX_H / im.height), MAX_H), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=88, method=6, alpha_quality=100)
    return buf.getvalue()


def main() -> int:
    check = '--check' in sys.argv[1:]
    missing = [n for n in PACKS.values() if not (SRC / n).exists()]
    if missing:
        print('origem ausente em .inspo/boosters: ' + ', '.join(missing), file=sys.stderr)
        return 1
    diffs, written = [], 0
    expected = {f'{pid}.webp' for pid in PACKS}
    stale = sorted(p for p in (OUT.glob('*.webp') if OUT.exists() else []) if p.name not in expected)
    for pid, name in PACKS.items():
        data = pack(name)
        path = OUT / f'{pid}.webp'
        if path.exists() and path.read_bytes() == data:
            continue
        if check:
            diffs.append(path.relative_to(ROOT).as_posix())
            continue
        OUT.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        written += 1
    if check:
        diffs += [p.relative_to(ROOT).as_posix() for p in stale]
        if diffs:
            print('difere de .inspo/boosters: ' + ', '.join(diffs), file=sys.stderr)
            return 1
        print(f'arte dos pacotes igual a .inspo/boosters ({len(PACKS)})')
        return 0
    for p in stale:
        p.unlink()
    print(f'{written} pacote(s) gravado(s) em {OUT.relative_to(ROOT).as_posix()}; {len(stale)} removido(s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
