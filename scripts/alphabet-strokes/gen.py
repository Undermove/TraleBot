import json, math, os, sys, re
sys.path.insert(0, os.path.dirname(__file__))
from keypoints import L, CHART, ORIG

OUT = os.path.join(os.path.dirname(__file__), "..")
ORDER = "აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ"
# Helvetica metrics at 100px: (bbox left, bbox right)
MET = dict(s.split(":") for s in "ა:-3.8,47.6 ბ:-4.2,52.7 გ:-3.0,49.7 დ:-4.2,78.9 ე:-3.5,48.4 ვ:-3.5,49.9 ზ:-1.5,57.9 თ:-4.2,80.5 ი:-4.2,49.6 კ:-3.0,48.7 ლ:-4.4,92.8 მ:-4.2,51.9 ნ:-5.7,53.5 ო:-4.2,69.4 პ:-3.1,49.2 ჟ:-4.0,49.7 რ:-4.5,69.7 ს:-5.7,51.2 ტ:-4.2,62.1 უ:-2.4,50.2 ფ:-4.2,75.8 ქ:-2.9,47.8 ღ:-4.2,69.4 ყ:-4.2,49.6 შ:-4.2,52.3 ჩ:-5.7,52.4 ც:-4.3,55.3 ძ:-4.2,51.8 წ:-5.7,53.8 ჭ:-3.0,58.7 ხ:-5.7,53.3 ჯ:-3.3,48.3 ჰ:-3.0,48.8".split())
S = 40 / 51.2
FS = 100 * S
def ox(ch):
    l, r = map(float, MET[ch].split(","))
    return 50 - S * ((-l) + r) / 2

PER_FILE = {"a":"a","b":"b","g":"g","d":"d","e":"e","v":"v","z":"z","t":"t","i":"i","k'":"k'","l":"l","m":"m","n":"n","o":"oni","p'":"p'ari","zh":"zh","r":"r","s":"s","t'":"t'","u":"uni","p":"p","k":"k","gh":"gh","q'":"q'","sh":"sh","ch":"ch","ts":"ts","dz":"dz","ts'":"ts'","ch'":"ch'","kh":"kh","j":"j","h":"h"}

def cr(p0, p1, p2, p3, n=24, alpha=0.5):
    def tj(ti, a, b):
        return ti + max(math.dist(a, b), 1e-6) ** alpha
    t0 = 0; t1 = tj(t0, p0, p1); t2 = tj(t1, p1, p2); t3 = tj(t2, p2, p3)
    out = []
    for i in range(n):
        t = t1 + (t2 - t1) * i / n
        def lerp(a, b, ta, tb):
            return tuple(((tb - t) * a[k] + (t - ta) * b[k]) / (tb - ta) for k in range(2))
        A1 = lerp(p0, p1, t0, t1); A2 = lerp(p1, p2, t1, t2); A3 = lerp(p2, p3, t2, t3)
        B1 = lerp(A1, A2, t0, t2); B2 = lerp(A2, A3, t1, t3)
        out.append(lerp(B1, B2, t1, t2))
    return out

def is_cusp(a, b, c):
    v1 = (b[0]-a[0], b[1]-a[1]); v2 = (c[0]-b[0], c[1]-b[1])
    n1 = math.hypot(*v1); n2 = math.hypot(*v2)
    if n1 == 0 or n2 == 0: return False
    cos = (v1[0]*v2[0]+v1[1]*v2[1])/(n1*n2)
    return cos < -0.5  # turn sharper than 120 degrees -> treat as cusp (retrace/corner)

def smooth(kp):
    kp = [tuple(map(float, p)) for p in kp]
    # split into segments at cusps so splines don't overshoot at reversals
    segs, cur = [], [kp[0]]
    for i in range(1, len(kp)):
        cur.append(kp[i])
        if 0 < i < len(kp)-1 and is_cusp(kp[i-1], kp[i], kp[i+1]):
            segs.append(cur); cur = [kp[i]]
    segs.append(cur)
    dense = []
    for s in segs:
        if len(s) == 2:
            pts = [s[0], s[1]]
            d = [tuple(s[0][k] + (s[1][k]-s[0][k])*i/24 for k in range(2)) for i in range(25)]
        else:
            ext = [tuple(2*s[0][k]-s[1][k] for k in range(2))] + s + [tuple(2*s[-1][k]-s[-2][k] for k in range(2))]
            d = []
            for i in range(1, len(ext)-2):
                d += cr(ext[i-1], ext[i], ext[i+1], ext[i+2])
            d.append(s[-1])
        dense.append(d)
    return dense  # list of segments split at cusps

def _rs(dense, n):
    acc = [0.0]
    for i in range(1, len(dense)):
        acc.append(acc[-1] + math.dist(dense[i-1], dense[i]))
    total = acc[-1]
    out, j = [], 0
    for i in range(n):
        target = total * i / (n-1)
        while j < len(acc)-2 and acc[j+1] < target: j += 1
        seg = acc[j+1]-acc[j] or 1
        f = (target-acc[j])/seg
        out.append([round(dense[j][0] + (dense[j+1][0]-dense[j][0])*f, 1), round(dense[j][1] + (dense[j+1][1]-dense[j][1])*f, 1)])
    return out

def seglen(d):
    return sum(math.dist(d[i-1], d[i]) for i in range(1, len(d)))

CUSPS = {}
def resample(segs, key=None):
    total = sum(seglen(d) for d in segs)
    n = max(10, min(30, round(total / 4)))
    out, cusps = [], []
    for d in segs:
        k = max(3, round(n * seglen(d) / total) + 1)
        pts = _rs(d, k)
        if out:
            cusps.append(len(out) - 1)
            pts = pts[1:]
        out += pts
    if key is not None: CUSPS[key] = cusps
    return out

COLORS = ["#e0245e", "#1d6fe0", "#0a9d58"]

def svg(ch, strokes):
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 110 110" width="440" height="440">',
         '<rect x="-5" y="-5" width="110" height="110" fill="#fff"/>']
    for y, c in ((0, "#ccc"), (30, "#f6a"), (70, "#f6a"), (100, "#ccc")):
        o.append(f'<line x1="0" y1="{y}" x2="100" y2="{y}" stroke="{c}" stroke-width="0.3" stroke-dasharray="1.5 1"/>')
    o.append(f'<text x="{ox(ch):.2f}" y="70" font-family="Helvetica, \'Noto Sans Georgian\', sans-serif" font-size="{FS:.3f}" fill="#000" fill-opacity="0.18">{ch}</text>')
    for si, st in enumerate(strokes):
        col = COLORS[si % 3]
        d = "M" + " L".join(f"{x},{y}" for x, y in st)
        o.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.85"/>')
        for x, y in st:
            o.append(f'<circle cx="{x}" cy="{y}" r="0.55" fill="{col}"/>')
        # arrowheads at ~35%, ~70% and end
        for frac in (0.35, 0.7, 1.0):
            i = max(1, min(len(st)-1, round(frac*(len(st)-1))))
            (x0, y0), (x1, y1) = st[i-1], st[i]
            a = math.atan2(y1-y0, x1-x0); L_ = 3.2
            p1 = (x1 - L_*math.cos(a-0.45), y1 - L_*math.sin(a-0.45))
            p2 = (x1 - L_*math.cos(a+0.45), y1 - L_*math.sin(a+0.45))
            o.append(f'<path d="M{p1[0]:.2f},{p1[1]:.2f} L{x1},{y1} L{p2[0]:.2f},{p2[1]:.2f}" fill="none" stroke="{col}" stroke-width="1.1" stroke-linecap="round"/>')
        sx, sy = st[0]
        o.append(f'<circle cx="{sx}" cy="{sy}" r="2.8" fill="{col}"/>')
        o.append(f'<text x="{sx}" y="{sy+1.3}" font-family="Helvetica" font-size="3.8" font-weight="bold" fill="#fff" text-anchor="middle">{si+1}</text>')
    o.append(f'<text x="98" y="98" font-family="Helvetica" font-size="4" fill="#888" text-anchor="end">{ch}</text>')
    o.append('</svg>')
    return "\n".join(o)

import subprocess
raw = {ch: [resample(smooth(s), (ch, i)) for i, s in enumerate(L[ch]["strokes"])] for ch in ORDER}
inp = dict(fs=FS, letters=[dict(letter=ch, ox=ox(ch), strokes=raw[ch], cusps=[CUSPS[(ch, i)] for i in range(len(raw[ch]))]) for ch in ORDER])
HERE = os.path.dirname(os.path.abspath(__file__))
# Для мини-аппа: сырые штрихи (до прилипания к глифу Helvetica) — их подгоняет к шрифту приложения refit.mjs.
if "--emit-input" in sys.argv:
    json.dump(inp, open(sys.argv[sys.argv.index("--emit-input") + 1], "w"), ensure_ascii=False)
    print("input", len(inp["letters"])); sys.exit(0)
open(os.path.join(HERE, "snap_input.js"), "w").write("const INPUT=" + json.dumps(inp, ensure_ascii=False) + ";")
snapped = raw
if "--nosnap" not in sys.argv:
    dom = subprocess.run(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--headless=new", "--disable-gpu", "--dump-dom", "file://" + os.path.join(HERE, "snap.html")], capture_output=True, text=True).stdout
    m = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    snapped = {e["letter"]: e["strokes"] for e in json.loads(m.group(1))}
data = []
os.makedirs(os.path.join(OUT, "svg"), exist_ok=True)
for ch in ORDER:
    e = L[ch]
    strokes = snapped[ch]
    src = [CHART, ORIG, "https://commons.wikimedia.org/wiki/File:Mkhedruli_%s.png" % PER_FILE[e["translit"]].replace("'", "%27")]
    item = dict(letter=ch, translit=e["translit"], strokeCount=len(strokes), strokes=strokes,
                start=e["start"], confidence=e["confidence"], sources=src)
    if e["note"]: item["note"] = e["note"]
    data.append(item)
    open(os.path.join(OUT, "svg", f"{ch}.svg"), "w").write(svg(ch, strokes))

meta = dict(
    box="0..100; y вниз; верх строчных (x-height) y=30, базовая линия y=70, центровые линии асцендеров начинаются около y≈13, десцендеров доходят до y≈83 (пропорции Helvetica, точки лежат на оси штриха, поэтому чуть внутри контура); всё внутри 0..100",
    glyphReference="Helvetica (macOS), font-size 78.125 в единицах бокса, базовая линия y=70, глиф центрирован по x=50",
    direction="точки каждого штриха идут в порядке письма; штрихи в порядке написания",
    primarySource=CHART,
)
json.dump(dict(meta=meta, letters=data), open(os.path.join(OUT, "strokes.json"), "w"), ensure_ascii=False, indent=1)

# contact sheet
cells = "".join(f'<div style="display:inline-block">{svg(ch, d["strokes"]).replace("width=\"440\" height=\"440\"", "width=\"320\" height=\"320\"")}</div>' for ch, d in zip(ORDER, data))
open(os.path.join(os.path.dirname(__file__), "sheet.html"), "w").write(f'<html><meta charset=utf-8><body style="margin:0;width:1300px">{cells}</body></html>')
print("ok", len(data))
