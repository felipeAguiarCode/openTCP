#!/usr/bin/env python3
"""Sleeves do Pokémon TCG Pocket: o verso das cartas de um deck, escolhido na aparência do deck (aba Verso).

Origem (pedido do autor, 17/10/2026): a página de sleeves do Serebii (https://www.serebii.net/tcgpocket/sleeves.shtml),
com as imagens em tamanho cheio (`sleeves/<nome>.jpg`, 734×1024, a proporção da carta), baixadas uma vez com
`--fetch` para `src/presentation/assets/source/sleeves/` (imagens + index.json com nome e origem). Cada imagem é o
verso inteiro, com borda colorida e cantos retos.

Saída:
- `src/presentation/assets/sleeves/<stem>.webp`: o verso em 367×512 com os cantos arredondados da carta (raio = 0,052
  da largura, o mesmo da geometria 3D) e transparência fora deles;
- `src/content/source/sleeves.generated.ts`: a lista (stem, nome, cor média e cor da borda) para os cosméticos de verso.

Uso: python tools/asset-import/sleeves.py [--fetch] [--check]   (--check: não grava; sai com 1 se algo difere do disco)
Requer Pillow.
"""
from pathlib import Path
import html
import io
import json
import re
import sys
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src' / 'presentation' / 'assets' / 'source' / 'sleeves'
OUT = ROOT / 'src' / 'presentation' / 'assets' / 'sleeves'
LIST = ROOT / 'src' / 'content' / 'source' / 'sleeves.generated.ts'
PAGE = 'https://www.serebii.net/tcgpocket/sleeves.shtml'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
SIZE = (367, 512)
RADIUS = 0.052


def get(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read()


def stem_of(file: str) -> str:
    s = file.rsplit('.jpg', 1)[0].lower().replace("'", '').replace('&', '-').replace('.', '-')
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9-]', '', s)).strip('-')


def fetch() -> None:
    page = get(PAGE).decode('latin-1')
    entries = []
    for m in re.finditer(r'<img src="sleeves/th/([^"]+\.jpg)" alt="([^"]*)" title="([^"]*)"', page):
        file, alt, title = m.group(1), html.unescape(m.group(2)), html.unescape(m.group(3))
        stem = stem_of(file)
        if any(e['stem'] == stem for e in entries):
            continue
        name = re.sub(r'\s*Sleeves?\b.*$', '', title).strip() or re.sub(r'\s*Sleeves?$', '', alt).strip()
        source = f'https://www.serebii.net/tcgpocket/sleeves/{urllib.parse.quote(file)}'
        entries.append({'stem': stem, 'name': name, 'file': file, 'source': source})
    SRC.mkdir(parents=True, exist_ok=True)
    for e in entries:
        target = SRC / f"{e['stem']}.jpg"
        if not target.exists():
            target.write_bytes(get(e['source']))
    (SRC / 'index.json').write_text(json.dumps({'page': PAGE, 'sleeves': entries}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(entries)} sleeves baixados para {SRC.relative_to(ROOT).as_posix()}')


def rounded_mask(size: tuple[int, int]) -> Image.Image:
    w, h = size
    k = 4
    big = Image.new('L', (w * k, h * k), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, w * k - 1, h * k - 1), radius=round(RADIUS * w * k), fill=255)
    return big.resize(size, Image.LANCZOS)


def sleeve_image(path: Path) -> tuple[bytes, str, str]:
    rgb = Image.open(path).convert('RGB').resize(SIZE, Image.LANCZOS)
    img = rgb.convert('RGBA')
    img.putalpha(rounded_mask(SIZE))
    small = rgb.resize((24, 33))
    pixels = list(small.get_flattened_data())
    avg = tuple(sum(p[k] for p in pixels) // len(pixels) for k in range(3))
    edge = rgb.getpixel((4, SIZE[1] // 2))
    buf = io.BytesIO()
    img.save(buf, 'WEBP', quality=86, method=6, alpha_quality=100)
    return buf.getvalue(), '#%02X%02X%02X' % avg, '#%02X%02X%02X' % tuple(edge[:3])


def main() -> int:
    args = sys.argv[1:]
    check = '--check' in args
    if '--fetch' in args and not check:
        fetch()
    index = SRC / 'index.json'
    if not index.exists():
        print(f'origem ausente: {index.relative_to(ROOT).as_posix()} (rode com --fetch)', file=sys.stderr)
        return 1
    sleeves = json.loads(index.read_text(encoding='utf-8'))['sleeves']
    diffs, written, rows, expected = [], 0, [], set()
    for s in sleeves:
        data, base, edge = sleeve_image(SRC / f"{s['stem']}.jpg")
        rows.append((s['stem'], s['name'], base, edge))
        path = OUT / f"{s['stem']}.webp"
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
        '// Gerado por tools/asset-import/sleeves.py (npm run assets:sleeves) — não editar à mão.\n'
        '// Sleeves do Pokémon TCG Pocket (imagens em src/presentation/assets/sleeves): stem, nome e cores para o fallback.\n'
        'export const POCKET_SLEEVES: readonly { readonly stem: string; readonly name: string; readonly base: string; readonly edge: string }[] = [\n'
        + ''.join(f"  {{ stem: {json.dumps(s)}, name: {json.dumps(n, ensure_ascii=False)}, base: '{b}', edge: '{e}' }},\n" for s, n, b, e in rows)
        + '];\n'
    )
    stale = sorted(p for p in (OUT.glob('*.webp') if OUT.exists() else []) if p.name not in expected)
    if check:
        if not LIST.exists() or LIST.read_text(encoding='utf-8') != ts:
            diffs.append(LIST.relative_to(ROOT).as_posix())
        diffs += [p.relative_to(ROOT).as_posix() for p in stale]
        if diffs:
            print('difere da origem (source/sleeves): ' + ', '.join(diffs[:8]) + (' …' if len(diffs) > 8 else ''), file=sys.stderr)
            return 1
        print(f'sleeves iguais à origem (source/sleeves) ({len(rows)})')
        return 0
    LIST.write_text(ts, encoding='utf-8', newline='\n')
    for p in stale:
        p.unlink()
    print(f'{len(rows)} sleeves; {written} arquivo(s) gravado(s) em {OUT.relative_to(ROOT).as_posix()}; {len(stale)} removido(s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
