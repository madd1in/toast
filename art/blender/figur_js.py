# Schreibt die Figuren-Daten (Atlas-Lage und Ankerpunkte) aus art/render/<name>_sprite.json in js/figuren3d.js.
# Ersetzt nur den Block zwischen den Markierungen // <figuren-daten> und // </figuren-daten>.
# Aufruf aus dem Repo-Ordner:  python art/blender/figur_js.py
import io, json, re

GUESTS = ['sam', 'max', 'dave', 'guybrush', 'jack', 'salad', 'bender', 'prof', 'zoid', 'glados', 'simon', 'affe']
FIGS = ['bernard', 'hoagie', 'laverne', 'drfred', 'gertrude', 'hancock', 'green', 'lila', 'nett', 'guard'] + GUESTS
TENT = {'green', 'lila', 'nett', 'guard'}   # Tentakel: ohne Augen, das Spiel verformt das Bild (tent3d in figuren3d.js)
# Blinzeln: Lid-Ellipse (Halbachsen, Farbe; None = Hautfarbe aus dem Rendering) über den Augen-Ankern; Mund-Ellipse beim Reden
LOOK = {
    'bernard': dict(lid=[3.3, 3.6, '#eef2f6'], mouth=[4.4, 3.6]),   # Augen hinter Brillengläsern
    'hoagie': dict(lid=[2.8, 3.3, None], mouth=[5.4, 4.2]),
    'laverne': dict(lid=[4.2, 6.2, None], mouth=[3.8, 3.2]),
    'drfred': dict(lid=[4.2, 4.4, '#e4f4ff'], mouth=[5.6, 4.4]),   # Augen hinter dicken Brillengläsern
    'gertrude': dict(lid=[2.8, 3.4, None], mouth=[4.4, 3.6]),
    'hancock': dict(lid=[2.8, 3.4, None], mouth=[4.4, 3.6]),
    # Crossover-Gäste
    'sam': dict(lid=[3.4, 4.4, None], mouth=[6.0, 3.6]),
    'max': dict(lid=[2.8, 3.4, '#f7f7fb'], mouth=[4.2, 4.6]),
    'dave': dict(lid=[3.4, 4.0, None], mouth=[4.4, 3.6]),
    'guybrush': dict(lid=[3.4, 4.0, None], mouth=[4.4, 3.6]),
    'jack': dict(lid=[3.4, 4.0, None], mouth=[4.4, 3.6]),
    'salad': dict(lid=[2.4, 2.4, None], mouth=[2.6, 2.4]),
    'bender': dict(lid=[3.6, 4.4, '#9aa6b8'], mouth=[5.0, 3.0]),
    'prof': dict(lid=[3.2, 3.6, '#e4f4ff'], mouth=[4.0, 3.4]),
    'zoid': dict(lid=[3.0, 3.6, None], mouth=[4.8, 3.6]),
    'glados': dict(lid=None, mouth=None),   # Auge leuchtet beim Sprechen (guest3d)
    'simon': dict(lid=[3.2, 3.8, None], mouth=[4.2, 3.4]),
    'affe': dict(lid=[2.2, 2.6, None], mouth=[3.2, 2.4]),   # Mund und Lider am mittleren Kopf
}
rows = []
for n in FIGS:
    d = json.load(open(f'art/render/{n}_sprite.json'))
    fr = ',\n'.join(f'    {k}: {json.dumps(v, separators=(",", ":"))}' for k, v in d['frames'].items())
    if n in TENT:
        rows.append(f"  {n}: {{ src: 'img/figuren/{n}.png', upp: {d['upp']}, tent: true, f: {{\n{fr},\n  }} }},")
        continue
    lk = LOOK[n]
    lid = lk['lid'][:2] + [lk['lid'][2] or d['skin']] if lk['lid'] else None
    rows.append(f"  {n}: {{ src: 'img/figuren/{n}.png', upp: {d['upp']}, lid: {json.dumps(lid)}, mouth: {json.dumps(lk['mouth'])}, f: {{\n{fr},\n  }} }},")
block = '// <figuren-daten> (erzeugt von art/blender/figur_js.py)\nconst FIG3D = {\n' + '\n'.join(rows) + '\n};\n// </figuren-daten>\n'
p = 'js/figuren3d.js'
s = io.open(p, encoding='utf-8').read()
if '// <figuren-daten>' in s:
    s = re.sub(r'// <figuren-daten>.*?// </figuren-daten>\n', lambda m: block, s, flags=re.S)
else:
    s = re.sub(r'const FIG3D = \{\n.*?\n\};\n', lambda m: block, s, count=1, flags=re.S)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok', FIGS)
