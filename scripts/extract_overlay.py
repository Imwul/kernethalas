"""Build src/local/source-overlay.json from YOUR OWN copy of the Gravebound Edition PDF.

The output contains the book's original wording, so it is git-ignored and must not be deployed.
Usage: npm run overlay -- "/path/to/KerNethalas-Corebook.pdf"
"""
import json, re, sys
import fitz  # PyMuPDF

pdf, manifest_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
doc = fitz.open(pdf)
man = json.load(open(manifest_path))

def page_text(n):
    t = doc[n - 1].get_text()
    t = re.sub(r'(?<=[A-Za-z])[7`](?=[a-z])|(?<![\w])[7`](?=[a-z])', 'f', t)
    t = re.sub(r'Chapter [IVX]+: [^\n]+\n\d+\n', '\n', t)
    t = re.sub(r'Ker Nethalas - Gravebound Edition\n\d+\n', '\n', t)
    return t

def clean(s):
    s = re.sub(r'D\d+\s+[A-Z][A-Z &\-–()]+(\(CONTINUED\))?', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

# ---------------------------------------------------------------------------
# Tables: geometric extraction.
# Rows in this book are a range token (BaskOldFace) in a narrow left column, with the result text
# vertically centred on it. Each row is a block of lines separated from the next by a gap larger than
# the line spacing. We find the table's own header, take the anchors below it in that column, group
# the lines inside the table's column band into blocks, and give each block to the anchor it contains.
# Prose beside or below the table falls outside the band or forms a block with no anchor and is dropped.
# ---------------------------------------------------------------------------
STOP = {'the', 'a', 'of', 'and', 'table', 'random', 'is', 'there', 'it', 'you', 'were', 'which', '—', '-', '&'}

def words(s):
    return {w for w in re.findall(r'[a-z]+', s.lower()) if w not in STOP}

def title_variants(en):
    base = re.sub(r'\([^)]*\)', ' ', en)
    out = [words(base)]
    out += [words(x) for x in re.findall(r'\(([^)]*)\)', en)]
    return [v for v in out if v]

def fixf(t):
    return re.sub(r'(?<=[A-Za-z])[7`](?=[a-z])|(?<![\w])[7`](?=[a-z])', 'f', t)

def page_lines(n):
    out = []
    for b in doc[n - 1].get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = ''.join(sp['text'] for sp in l['spans']).strip()
            if not t:
                continue
            x0, y0, x1, y1 = l['bbox']
            f = l['spans'][0]
            out.append({'t': fixf(t), 'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'yc': (y0 + y1) / 2,
                        'font': f['font'], 'size': f['size']})
    return out

def is_bask(l):
    return 'BaskOldFace' in l['font']

def tok_norm(s):
    s = s.replace('–', '-').replace('—', '-')
    return '-'.join(str(int(p)) for p in s.split('-'))

def row_token(lo, hi):
    return str(lo) if lo == hi else f'{lo}-{hi}'

def headers_on(lines, dice):
    """dice header lines + the title text printed next to them"""
    hs = []
    for l in lines:
        if is_bask(l) and re.match(rf'^{dice}\b', l['t']):
            # the next dice header to the right on the same band belongs to another table
            nxt = [m['x0'] for m in lines if is_bask(m) and re.match(r'^D\d+\b', m['t']) and abs(m['yc'] - l['yc']) < 45 and m['x0'] > l['x0'] + 20]
            xlim = min(nxt) - 2 if nxt else l['x0'] + 330
            near = [m for m in lines if is_bask(m) and -30 < m['yc'] - l['yc'] < 16 and l['x0'] - 2 <= m['x0'] < xlim
                    and (m is l or not re.match(r'^\d', m['t']))]
            title = ' '.join(m['t'] for m in sorted(near, key=lambda m: (m['y0'], m['x0'])))
            hs.append({'line': l, 'title': title, 'bottom': max(m['y1'] for m in near),
                       'right': max(m['x1'] for m in near)})
    return hs

def geom_table(t):
    variants = title_variants(t['en'])
    want = [row_token(lo, hi) for lo, hi in t['rows']]
    rows, wi = {}, 0
    for pn in sorted(set(t['pages'])):
        lines = page_lines(pn)
        hs = headers_on(lines, t['dice'])
        scored = []
        for h in hs:
            tw = words(h['title'])
            sc = max(len(v & tw) / len(v) for v in variants)
            scored.append((sc, h))
        if not scored:
            continue
        best = max(sc for sc, _ in scored)
        if best < 0.5:
            continue
        for sc, h in sorted(scored, key=lambda x: (x[1]['line']['y0'], x[1]['line']['x0'])):
            if sc < best or wi >= len(want):
                continue
            hx = h['line']['x0']
            # other headers in the same column below this one end this table's area
            below = [o['line']['y0'] for o in hs if o is not h and abs(o['line']['x0'] - hx) < 30 and o['line']['y0'] > h['line']['y0']]
            ymax = min(below) - 2 if below else 10_000
            anchors = []
            for l in sorted(lines, key=lambda l: l['y0']):
                if not (h['bottom'] - 1 < l['y0'] < ymax and hx - 8 <= l['x0'] <= hx + 14):
                    continue
                m = re.match(r'^(\d+(?:\s*[-–]\s*\d+)?)\b\s*(.*)$', l['t'])
                if m and not is_bask(l) and m.group(2):
                    continue  # body text that merely starts with a number
                if not m or wi >= len(want):
                    continue
                if tok_norm(m.group(1).replace(' ', '')) == want[wi]:
                    anchors.append({'key': str(t['rows'][wi][0]), 'line': l, 'rest': m.group(2)})
                    wi += 1
            if not anchors:
                continue
            left = min(a['line']['x0'] for a in anchors) - 6
            right = 215 if (left < 150 and h['right'] < 215) else 400
            top = h['bottom'] - 1
            bottom = min(ymax, anchors[-1]['line']['y1'] + 60)
            band = [l for l in lines
                    if top < l['y0'] < bottom and left <= l['x0'] < right and l['x1'] <= right + 25
                    and not (is_bask(l) and l['size'] >= 11.5)]
            # group into blocks by vertical gap
            band.sort(key=lambda l: (l['y0'], l['x0']))
            blocks, cur = [], []
            for l in band:
                if cur and l['y0'] - max(c['y0'] for c in cur) > 12.5:
                    blocks.append(cur); cur = []
                cur.append(l)
            if cur:
                blocks.append(cur)
            for blk in blocks:
                lo_y, hi_y = min(l['y0'] for l in blk), max(l['y1'] for l in blk)
                inside = [a for a in anchors if lo_y - 3 <= a['line']['yc'] <= hi_y + 3]
                if not inside:
                    continue  # prose, page furniture, or a stray block: not part of any row
                for l in blk:
                    a = min(inside, key=lambda a: abs(a['line']['yc'] - l['yc']))
                    a.setdefault('lines', []).append(l)
            for a in anchors:
                ls = sorted(a.get('lines', []), key=lambda l: (round(l['yc'] / 4), l['x0']))
                parts = []
                for l in ls:
                    if l is a['line']:
                        if a['rest']:
                            parts.append(a['rest'])
                    else:
                        parts.append(l['t'])
                seg = re.sub(r'\s+', ' ', ' '.join(parts)).strip()
                if seg:
                    rows[a['key']] = seg
    return rows

# ---------------------------------------------------------------------------
# Fallback: the earlier text-order matcher, used only for rows the geometric pass did not find.
# Its known weakness is bleeding into neighbouring prose, so its output is trimmed hard.
# ---------------------------------------------------------------------------
def trim_fallback(seg):
    m = re.search(r'\s(?:[A-Z][A-Z’\'&]+(?: [A-Z][A-Z’\'&()-]+)+|Chapter [IVX]+:)', seg)
    if m and m.start() > 0:
        seg = seg[: m.start()]
    return seg.strip()

def text_table(t):
    text = '\n'.join(page_text(p) for p in sorted(set(t['pages'])))
    head = text.upper().find(t['en'].upper().split(' (')[0].split(' — ')[0])
    pos = max(head, 0)
    width = 2 if t['dice'] == 'D100' else 1
    found = []
    for lo, hi in t['rows']:
        a = str(lo).zfill(width) if t['dice'] == 'D100' else str(lo)
        b = (str(hi).zfill(width) if t['dice'] == 'D100' else str(hi)) if hi != lo else None
        pat = rf'(?m)^{re.escape(a)}' + (rf'-{re.escape(b)}' if b else '') + r'\s*$|(?<![\d-]){0}{1}\s'.format(re.escape(a), ('-' + re.escape(b)) if b else '')
        m = re.compile(pat).search(text, pos)
        if not m and t['dice'] == 'D100' and lo < 10:
            a2 = str(lo)
            pat2 = r'(?<![\d-])' + re.escape(a2) + (('-' + re.escape(b)) if b else '') + r'\s'
            m = re.compile(pat2).search(text, pos)
        if not m:
            found.append(None); continue
        found.append((m.start(), m.end())); pos = m.end()
    rows = {}
    for i, (lo, _) in enumerate(t['rows']):
        if not found[i]:
            continue
        end = next((f[0] for f in found[i + 1:] if f), None)
        raw = text[found[i][1]: end if end else found[i][1] + 300]
        cut = re.search(r'\n\s*D\d+\s*\n[A-Z]', raw)
        seg = trim_fallback(clean(raw[: cut.start()] if cut else raw))
        if seg:
            rows[str(lo)] = seg
    return rows

tables, misses, stats = {}, [], {'geom': 0, 'text': 0}
for t in man['tables']:
    if not t['pages']:
        continue
    g = geom_table(t)
    fb = text_table(t) if len(g) < len(t['rows']) else {}
    rows = {}
    for lo, _ in t['rows']:
        k = str(lo)
        if k in g:
            rows[k] = g[k]; stats['geom'] += 1
        elif k in fb:
            rows[k] = fb[k]; stats['text'] += 1
        else:
            misses.append(f"{t['id']}#{lo}")
    tables[t['id']] = rows

creatures = {}
for c in man['creatures']:
    pages = sorted(set(c['pages'] + ([c['pages'][-1] + 1] if c['id'] == 'cr-infernal-archon' else [])))
    text = ' '.join(page_text(p) for p in pages)
    text = re.sub(r'\s+', ' ', text)
    acts = {}
    for i, name in enumerate(c['actions']):
        m = re.search(re.escape(name) + r'(?: \((?:Physical|Magical)\))?: ', text)
        if not m:
            misses.append(f"{c['id']}:{name}"); continue
        nxt = len(text)
        for other in c['actions'][i + 1:]:
            m2 = re.search(r'\d(?:-\d)? ' + re.escape(other) + r'(?: \((?:Physical|Magical)\))?: ', text[m.end():])
            if m2:
                nxt = m.end() + m2.start(); break
        stop = text.find('TYPE NUMBER', m.end())
        if 0 < stop < nxt:
            nxt = stop
        acts[name] = text[m.end():nxt].strip()
    creatures[c['id']] = acts

json.dump({'version': 'Gravebound v1.2 (local)', 'tables': tables, 'creatures': creatures}, open(out_path, 'w'), ensure_ascii=False, indent=1)
print(f"wrote {out_path}: {sum(len(v) for v in tables.values())} table rows ({stats['geom']} by layout, {stats['text']} by text fallback), {sum(len(v) for v in creatures.values())} creature actions")
if misses:
    print(f"{len(misses)} unmatched (shown without original text):", ', '.join(misses[:30]), '…' if len(misses) > 30 else '')
