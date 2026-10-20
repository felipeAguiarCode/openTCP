#!/usr/bin/env python3
"""Ícones de efeito do Pokémon TCG Pocket nas cartas em campo (interface §25.21): Condições Especiais e efeitos temporários.

Origem: `src/presentation/assets/source/effects/` (ícones fornecidos pelo autor, 17/10/2026; nomes `ba_icn_sp_*` para
as Condições e `ba_icn_cont_*` para os efeitos contínuos). Cada ícone tem as margens transparentes cortadas, é centrado
num quadrado e gravado em `src/presentation/assets/effects/<id>.webp` (128×128, sem perda, com transparência).

Uso: python tools/asset-import/effect-icons.py [--check]   (--check: não grava; sai com 1 se algo difere do disco)
Requer Pillow.
"""
from pathlib import Path
import io
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src' / 'presentation' / 'assets' / 'source' / 'effects'
OUT = ROOT / 'src' / 'presentation' / 'assets' / 'effects'
SIZE = 128

# id do ícone → arquivo da origem
ICONS = {
    'asleep': 'ba_icn_sp_asleep.png',
    'burned': 'ba_icn_sp_burned.png',
    'confused': 'ba_icn_sp_confused.png',
    'paralyzed': 'ba_icn_sp_paralyzed.png',
    'poisoned': 'ba_icn_sp_poisoned.png',
    'ban': 'ba_icn_cont_ban.png',
    'buff': 'ba_icn_cont_buff.png',
    'debuff': 'ba_icn_cont_debuff.png',
    'invalid': 'ba_icn_cont_invalid.png',
    'other-negative': 'ba_icn_cont_other_negative.png',
    'other-positive': 'ba_icn_cont_other_positive.png',
    'play-negative': 'ba_icn_sp_ba_icn_cont_play_negative.png',
}


def icon(path: Path) -> bytes:
    img = Image.open(path).convert('RGBA')
    box = img.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if box:
        img = img.crop(box)
    w, h = img.size
    side = max(w, h)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - w) // 2, (side - h) // 2))
    square = square.resize((SIZE, SIZE), Image.LANCZOS)
    buf = io.BytesIO()
    square.save(buf, 'WEBP', lossless=True, method=6)
    return buf.getvalue()


def main() -> int:
    check = '--check' in sys.argv[1:]
    diffs, written = [], 0
    for name, file in ICONS.items():
        src = SRC / file
        if not src.exists():
            print(f'origem ausente: {src.relative_to(ROOT).as_posix()}', file=sys.stderr)
            return 1
        data = icon(src)
        path = OUT / f'{name}.webp'
        if path.exists() and path.read_bytes() == data:
            continue
        if check:
            diffs.append(path.relative_to(ROOT).as_posix())
            continue
        OUT.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        written += 1
    stale = sorted(p for p in (OUT.glob('*.webp') if OUT.exists() else []) if p.stem not in ICONS)
    if check:
        diffs += [p.relative_to(ROOT).as_posix() for p in stale]
        if diffs:
            print('difere da origem (source/effects): ' + ', '.join(diffs), file=sys.stderr)
            return 1
        print(f'ícones de efeito iguais à origem (source/effects) ({len(ICONS)})')
        return 0
    for p in stale:
        p.unlink()
    print(f'{len(ICONS)} ícones de efeito; {written} gravado(s) em {OUT.relative_to(ROOT).as_posix()}; {len(stale)} removido(s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
