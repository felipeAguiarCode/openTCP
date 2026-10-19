#!/usr/bin/env python3
"""Moedas do Pokémon TCG Pocket: as faces para a oficina do deck, os lançamentos na mesa e a abertura de cara ou coroa.

Origem (pedido do autor, 16/10/2026): a categoria de moedas do Bulbagarden recusa acesso automatizado; as imagens vêm da
página de moedas do Serebii (https://www.serebii.net/tcgpocket/coins.shtml), baixadas uma vez com `--fetch` para
`.inspo/coins/serebii/` (imagens + index.json com nome e origem). Cada imagem traz só a face da moeda (cara) sobre fundo
claro, com a espessura embaixo.

Saída:
- `src/presentation/assets/coins/<stem>-heads.webp`: a face recortada num círculo (256×256, com transparência);
- `src/presentation/assets/coins/<stem>-tails.webp`: o verso (coroa), gerado da face em prata dessaturada com aro claro;
- `src/content/source/coins.generated.ts`: a lista (stem, nome, cor de base e de borda) para os cosméticos de moeda.

Uso: python tools/inspo-import/coins.py [--fetch] [--check]   (--check: não grava; sai com 1 se algo difere do disco)
Requer Pillow.
"""
from pathlib import Path
import html
import io
import json
import re
import sys
import urllib.request

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / '.inspo' / 'coins' / 'serebii'
OUT = ROOT / 'src' / 'presentation' / 'assets' / 'coins'
LIST = ROOT / 'src' / 'content' / 'source' / 'coins.generated.ts'
PAGE = 'https://www.serebii.net/tcgpocket/coins.shtml'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
SIZE = 256


def get(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read()


def stem_of(file: str) -> str:
    s = file.rsplit('/', 1)[-1].rsplit('.jpg', 1)[0].lower().replace('&', '-').replace('.', '-')
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9-]', '', s)).strip('-')


def fetch() -> None:
    page = get(PAGE).decode('latin-1')
    entries = []
    for m in re.finditer(r'<img src="(coin/[^"]+\.jpg)" alt="([^"]*)" title="([^"]*)"', page):
        file, alt, title = m.group(1), html.unescape(m.group(2)), html.unescape(m.group(3))
        stem = stem_of(file)
        if any(e['stem'] == stem for e in entries):
            continue
        name = re.sub(r'\s*\(.*\)\s*$', '', title).strip() or alt.replace(' Coin', '').strip()
        entries.append({'stem': stem, 'name': name, 'file': file, 'source': f'https://www.serebii.net/tcgpocket/{file}'})
    SRC.mkdir(parents=True, exist_ok=True)
    for e in entries:
        target = SRC / f"{e['stem']}.jpg"
        if not target.exists():
            target.write_bytes(get(e['source']))
    (SRC / 'index.json').write_text(json.dumps({'page': PAGE, 'coins': entries}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(entries)} moedas baixadas para {SRC.relative_to(ROOT).as_posix()}')


def background_mask(rgb: Image.Image) -> Image.Image:
    """Fundo ligado às bordas (claro e uniforme): 255 = fundo."""
    marker = (255, 0, 255)
    flood = rgb.copy()
    w, h = flood.size
    seeds = [(x, y) for x in range(0, w, max(1, w // 32)) for y in (0, h - 1)] + [(x, y) for y in range(0, h, max(1, h // 32)) for x in (0, w - 1)]
    for p in seeds:
        if flood.getpixel(p) != marker and min(flood.getpixel(p)) > 170:
            ImageDraw.floodfill(flood, p, marker, thresh=34)
    mask = Image.new('L', (w, h), 0)
    mask.putdata([255 if p == marker else 0 for p in flood.get_flattened_data()])
    return mask


def face_circle(rgb: Image.Image) -> tuple[float, float, float]:
    """Centro e raio da face: extensões a partir do centro da imagem até o fundo (a espessura fica embaixo)."""
    bg = background_mask(rgb)
    w, h = rgb.size
    cx, cy = w / 2, h / 2

    def run(dx: float, dy: float) -> float:
        n = 0.0
        limit = max(w, h)
        while n < limit:
            x, y = int(cx + dx * n), int(cy + dy * n)
            if not (0 <= x < w and 0 <= y < h) or bg.getpixel((x, y)) > 0:
                break
            n += 1
        return n

    left, right, up = run(-1, 0), run(1, 0), run(0, -1)
    x = cx + (right - left) / 2
    r = (left + right) / 2
    # O topo da face está a `up` do centro da imagem; a espessura só aparece embaixo.
    y = cy - up + r
    return x, y, r


def coin_faces(path: Path) -> tuple[bytes, bytes, str, str]:
    rgb = Image.open(path).convert('RGB')
    x, y, r = face_circle(rgb)
    r *= 0.985
    box = (round(x - r), round(y - r), round(x + r), round(y + r))
    face = rgb.crop(box).resize((SIZE, SIZE), Image.LANCZOS)
    mask = Image.new('L', (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, SIZE * 4 - 1, SIZE * 4 - 1), fill=255)
    mask = mask.resize((SIZE, SIZE), Image.LANCZOS)
    heads = face.convert('RGBA')
    heads.putalpha(mask)
    # Coroa: a mesma moeda em prata dessaturada, mais clara, com aro claro — distinta da cara à primeira vista.
    gray = ImageOps.autocontrast(ImageOps.grayscale(face), cutoff=2)
    silver = ImageOps.colorize(gray, black='#55626F', white='#F4F7FA', mid='#AEB9C4').convert('RGBA')
    sheen = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    ImageDraw.Draw(sheen).ellipse((SIZE * 0.06, SIZE * 0.06, SIZE * 0.94, SIZE * 0.94), outline=(255, 255, 255, 170), width=10)
    tails = Image.alpha_composite(silver, sheen.filter(ImageFilter.GaussianBlur(1)))
    tails.putalpha(mask)
    # Cores para o desenho procedural (fallback) e a borda da moeda 3D.
    small = face.resize((32, 32))
    pixels = [p for i, p in enumerate(small.get_flattened_data()) if ((i % 32) - 16) ** 2 + ((i // 32) - 16) ** 2 < 200]
    avg = tuple(sum(c[k] for c in pixels) // len(pixels) for k in range(3))
    rim = face.getpixel((SIZE // 2, 6))
    out = []
    for im in (heads, tails):
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=90, method=6, alpha_quality=100)
        out.append(buf.getvalue())
    return out[0], out[1], '#%02X%02X%02X' % avg, '#%02X%02X%02X' % tuple(rim[:3])


def main() -> int:
    args = sys.argv[1:]
    check = '--check' in args
    if '--fetch' in args and not check:
        fetch()
    index = SRC / 'index.json'
    if not index.exists():
        print(f'origem ausente: {index.relative_to(ROOT).as_posix()} (rode com --fetch)', file=sys.stderr)
        return 1
    coins = json.loads(index.read_text(encoding='utf-8'))['coins']
    diffs, written, rows = [], 0, []
    expected = set()
    for c in coins:
        heads, tails, base, edge = coin_faces(SRC / f"{c['stem']}.jpg")
        rows.append((c['stem'], c['name'], base, edge))
        for suffix, data in (('heads', heads), ('tails', tails)):
            path = OUT / f"{c['stem']}-{suffix}.webp"
            expected.add(path.name)
            if path.exists() and path.read_bytes() == data:
                continue
            if check:
                diffs.append(path.relative_to(ROOT).as_posix())
                continue
            OUT.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            written += 1
    ts = (
        '// Gerado por tools/inspo-import/coins.py (npm run inspo:coins) — não editar à mão.\n'
        '// Moedas do Pokémon TCG Pocket (imagens em src/presentation/assets/coins): stem, nome e cores para o fallback.\n'
        'export const POCKET_COINS: readonly { readonly stem: string; readonly name: string; readonly base: string; readonly edge: string }[] = [\n'
        + ''.join(f"  {{ stem: {json.dumps(s)}, name: {json.dumps(n, ensure_ascii=False)}, base: '{b}', edge: '{e}' }},\n" for s, n, b, e in rows)
        + '];\n'
    )
    stale = sorted(p for p in (OUT.glob('*.webp') if OUT.exists() else []) if p.name not in expected)
    if check:
        if not LIST.exists() or LIST.read_text(encoding='utf-8') != ts:
            diffs.append(LIST.relative_to(ROOT).as_posix())
        diffs += [p.relative_to(ROOT).as_posix() for p in stale]
        if diffs:
            print('difere de .inspo/coins: ' + ', '.join(diffs[:8]) + (' …' if len(diffs) > 8 else ''), file=sys.stderr)
            return 1
        print(f'moedas iguais a .inspo/coins ({len(rows)})')
        return 0
    LIST.write_text(ts, encoding='utf-8', newline='\n')
    for p in stale:
        p.unlink()
    print(f'{len(rows)} moedas; {written} arquivo(s) gravado(s) em {OUT.relative_to(ROOT).as_posix()}; {len(stale)} removido(s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
