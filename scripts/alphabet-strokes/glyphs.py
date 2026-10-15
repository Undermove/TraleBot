"""Контуры букв для мини-аппа: Noto Sans Georgian ExtraBold (800) → SVG path в боксе 0..100.

Буква на сцене знакомства стоит так же, как её раньше ставил холст: кегль 62, по центру ширины глифа
(advance), textBaseline=middle на y=50 (строка на 0.28524 em ниже — так считает Chromium). Так медианы письма (strokes в handwriting
→ glyph-medians) и контур живут в одних координатах, а буква рисуется вектором без зависимости от
загрузки шрифта.

Шрифт: Noto Sans Georgian (SIL OFL 1.1), вариативный файл Google Fonts, экземпляр wght=800:
  curl -L -o /tmp/var.ttf "https://github.com/google/fonts/raw/main/ofl/notosansgeorgian/NotoSansGeorgian%5Bwdth%2Cwght%5D.ttf"
  fonttools varLib.instancer /tmp/var.ttf wght=800 wdth=100 -o /tmp/noto800.ttf
  python3 scripts/alphabet-strokes/glyphs.py /tmp/noto800.ttf
(нужен fontTools: pip install fonttools)
"""
import json, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

LETTERS = "აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ"
SIZE = 62.0

font = TTFont(sys.argv[1])
gs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font["head"].unitsPerEm
asc, desc = font["hhea"].ascent, font["hhea"].descent
s = SIZE / upm
# Где холст с textBaseline=middle ставит строку: замерено в Chromium для этого шрифта — на 0.28524 em ниже
# точки, переданной в fillText (буквы на холсте и в SVG совпадают по пикселю).
base = 50 + 0.28524 * SIZE
out = {}
for ch in LETTERS:
    name = cmap[ord(ch)]
    g = gs[name]
    dx = 50 - g.width * s / 2
    pen = SVGPathPen(gs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
    g.draw(TransformPen(pen, (s, 0, 0, -s, dx, base)))
    out[ch] = pen.getCommands()
here = os.path.dirname(os.path.abspath(__file__))
dst = os.path.join(here, "..", "..", "src", "Trale", "miniapp-src", "src", "alphabet", "intro", "glyphs.ts")
with open(dst, "w") as f:
    f.write("// Контуры букв Noto Sans Georgian ExtraBold (SIL OFL 1.1) в боксе сцены 0..100: кегль 62, по центру, середина\n")
    f.write("// em-квадрата на y=50 — как буква стояла на холсте. Сгенерировано scripts/alphabet-strokes/glyphs.py, руками не править.\n\n")
    f.write("export const GLYPHS: Record<string, string> = {\n")
    f.write(",\n".join(f"  '{ch}': {json.dumps(d)}" for ch, d in out.items()))
    f.write("\n}\n")
print("ok", len(out), "baseline", round(base, 2))
