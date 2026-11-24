"""Build src/local/source-overlay.json from YOUR OWN copy of the Gravebound Edition PDF.

The output contains the book's original wording, so it is git-ignored and must not be deployed.
Usage: npm run overlay -- "/path/to/KerNethalas-Corebook.pdf"
"""
import json, re, sys
from pathlib import Path
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
        seg = text[m.end():nxt].strip()
        if i == len(c['actions']) - 1:
            # the final action runs into the next creature's page; cut at its all-caps title
            title = re.search(r'\s(?:[A-Z][A-Z’\'-]{2,})(?: [A-Z][A-Z’\'-]{2,})+(?=\s|$)', seg)
            if title:
                seg = seg[: title.start()].strip()
        acts[name] = seg
    creatures[c['id']] = acts

# ---------------------------------------------------------------------------
# Rule entries: the book's prose is split into sections at its headings (all-caps section titles,
# bold run-in terms, and the small-caps condition/ability names whose glyphs extract as noise).
# Each entry takes the section that best matches its English title, or the section / bullet
# paragraph named in ENTRY_HINTS. Tables stop a section: their rows already live in `tables`.
# ---------------------------------------------------------------------------
_lines_cache = {}

def rich_lines(n):
    if n in _lines_cache:
        return _lines_cache[n]
    out = []
    if 1 <= n <= len(doc):
        for b in doc[n - 1].get_text('dict')['blocks']:
            for l in b.get('lines', []):
                spans = [sp for sp in l['spans'] if sp['text'].strip()]
                if not spans or 'Angelrhapsody' in spans[0]['font']:
                    continue
                x0, y0 = l['bbox'][0], l['bbox'][1]
                out.append({
                    'page': n, 'col': 0 if x0 < 205 else 1, 'x0': x0, 'y0': y0,
                    'text': fixf(''.join(sp['text'] for sp in l['spans'])).strip(),
                    'plain': fixf(''.join(sp['text'] for sp in l['spans'] if 'Bold' not in sp['font'])).strip(),
                    'font': spans[0]['font'], 'size': round(spans[0]['size'], 1),
                    'bold': 'Bold' in spans[0]['font'], 'italic': 'Italic' in spans[0]['font'],
                    'table': 'BaskOldFace' in spans[0]['font'],
                })
    out.sort(key=lambda l: (l['col'], round(l['y0']), l['x0']))
    _lines_cache[n] = out
    return out

def noisy(t):
    letters = re.sub(r'[^A-Za-z]', '', t)
    return '\t' in t or '\n' in t or bool(re.search(r'[\^#!$%]', t)) or (len(t) > 2 and len(letters) < len(t) * 0.5)

def join_lines(parts):
    out = ''
    for t in parts:
        t = t.strip()
        if not t:
            continue
        if out.endswith('-') and t[:1].islower():
            out = out[:-1] + t
        else:
            out = f'{out} {t}' if out else t
    # the book prints the level as a glyph that most fonts lack
    return re.sub(r'\s+', ' ', out).replace('⅃', 'L').strip().lstrip('.:;, ')

def new_block(prev, l):
    return prev is None or prev['page'] != l['page'] or prev['col'] != l['col'] or l['y0'] - prev['y0'] > 13

def all_sections():
    secs, cur, prev = [], None, None
    for n in range(1, len(doc) + 1):
        for l in rich_lines(n):
            if l['text'] == '•':
                prev = l
                continue
            lv = 0
            if l['table'] and l['size'] >= 11.5:
                lv = 2
            elif l['size'] >= 15:
                lv = 3
            elif l['bold'] and l['size'] >= 11.5:
                lv = 2
            elif l['bold'] and (new_block(prev, l) or prev['text'] == '•'):
                lv = 1
            if lv:
                # a title wrapped onto a second line continues the same heading
                wrapped = cur and lv == cur['level'] and lv >= 2 and not cur['body'] and cur['table'] == l['table'] \
                    and l['page'] == cur['page'] and l['col'] == cur['col'] and 0 <= l['y0'] - cur['y_last'] <= max(16, l['size'] * 1.6)
                if wrapped:
                    cur['heading'] += ' ' + l['text']
                    cur['y_last'] = l['y0']
                else:
                    cur = {'level': lv, 'heading': l['text'], 'page': n, 'col': l['col'], 'y_last': l['y0'], 'body': [],
                           'table': l['table'], 'closed': l['table'], 'first_plain': l['plain'] if l['plain'] != l['text'] else ''}
                    secs.append(cur)
            elif cur is not None and not cur['closed']:
                if l['table']:
                    cur['closed'] = True  # a table starts: its rows are extracted separately
                else:
                    cur['body'].append(l['text'])
            prev = l
    return secs

SECTIONS = all_sections()

def section_text(i, follow=0):
    s = SECTIONS[i]
    parts = [s['first_plain']] if noisy(s['heading']) else [s['heading']]
    parts += s['body']
    j = i + 1
    while j < len(SECTIONS) and (follow > 0 or (SECTIONS[j]['level'] < s['level'] and s['level'] >= 2)) and not SECTIONS[j]['table']:
        t = SECTIONS[j]
        parts += ([t['first_plain']] if noisy(t['heading']) else [t['heading']]) + t['body']
        follow -= 1
        j += 1
    return trim_entry(join_lines(parts))

def trim_entry(text, limit=2000):
    if len(text) <= limit:
        return text
    cut = text.rfind('. ', 0, limit)
    return text[: cut + 1 if cut > limit // 3 else limit] + ' …'

def bullet_paragraph(page, phrase):
    """The bullet or paragraph on `page` that contains `phrase`, followed across column and page breaks."""
    paras, cur, prev = [], None, None
    for n in (page - 1, page, page + 1):
        for l in rich_lines(n):
            if l['table']:
                prev = l
                continue
            if l['text'] == '•':
                cur = {'page': n, 'parts': []}
                paras.append(cur)
                prev = l
                continue
            continues = cur is not None and prev is not None and prev['text'] != '•' and not new_block(prev, l)
            carried = cur is not None and prev is not None and new_block(prev, l) and (prev['page'] != l['page'] or prev['col'] != l['col']) \
                and not re.search(r'[.!?:]$', cur['parts'][-1] if cur['parts'] else '.')
            if not (continues or carried or (prev is not None and prev['text'] == '•')):
                cur = {'page': n, 'parts': []}
                paras.append(cur)
            cur['parts'].append(l['plain'] if l['bold'] and noisy(l['text']) else l['text'])
            prev = l
    for para in paras:
        text = join_lines(para['parts'])
        if phrase.lower() in text.lower() and (para['page'] == page or page - 1 <= para['page'] <= page):
            return trim_entry(text)
    return None

def find_section(page, test):
    return next((i for i, s in enumerate(SECTIONS) if s['page'] == page and test(s)), None)

# Entries whose title is not a heading of its own: (kind, page, phrase[, extra])
#   section: heading starts with phrase   body: the section whose body contains phrase
#   para:    the bullet/paragraph containing phrase
# The anchor phrases are short quotes from the book, so they live in a git-ignored local file
# (scripts/.overlay-hints.json, written next to the manifest) and never in the public repository.
_hints_path = Path(__file__).with_name('.overlay-hints.json')
ENTRY_HINTS = {k: tuple(v) for k, v in json.loads(_hints_path.read_text()).items()} if _hints_path.exists() else {}
if not ENTRY_HINTS:
    print(f'note: {_hints_path.name} not found; rule entries fall back to automatic heading matches')
# Tables, worked examples and out-of-scope chapters get no prose original.
ENTRY_SKIP = {'weapons', 'common-gear', 'spoils', 'combat-example', 'first-domain-rules', 'character-creation'}

def entry_words(s):
    return {w for w in re.findall(r'[a-z]+', s.lower()) if w not in STOP and len(w) > 1}

def auto_entry(e):
    phrases = [e['en']] + e['terms']
    best = None
    for k, page in enumerate(e['pages']):
        rank = (len(e['pages']) - k) / len(e['pages'])
        for i, sec in enumerate(SECTIONS):
            if sec['page'] != page or sec['table']:
                continue
            head, body = sec['heading'], join_lines(sec['body'])
            sc = 0.0
            if not noisy(head):
                hw = entry_words(head)
                match = 0.0
                for ph in phrases:
                    pw = entry_words(ph)
                    if pw:
                        match = max(match, len(pw & hw) / len(pw))
                    if ph.lower() in head.lower():
                        match = max(match, 1.2)
                sc += match
            elif head[:1].upper() == e['en'][:1].upper():
                sc += 0.2
            start = (sec['first_plain'] + ' ' + body)[:160].lower()
            if any(ph.lower() in start for ph in phrases):
                sc += 0.6
            sc += 0.08 * rank
            if best is None or sc > best[0]:
                best = (sc, i)
    return section_text(best[1]) if best and best[0] >= 0.7 else None

entries = {}
for e in man.get('entries', []):
    if e['id'] in ENTRY_SKIP:
        continue
    hint = ENTRY_HINTS.get(e['id'])
    text = None
    if hint:
        kind, page, phrase, *extra = hint
        if kind == 'para':
            text = bullet_paragraph(page, phrase)
        elif kind == 'section':
            i = find_section(page, lambda s: s['heading'].upper() == phrase.upper())
            if i is None:
                i = find_section(page, lambda s: s['heading'].upper().startswith(phrase.upper()))
        else:
            i = find_section(page, lambda s: phrase.lower() in join_lines([s['first_plain']] + s['body']).lower())
        if kind != 'para':
            text = section_text(i, extra[0] if extra else 0) if i is not None else None
    else:
        text = auto_entry(e)
    if text:
        entries[e['id']] = text
    else:
        misses.append(f"entry:{e['id']}")

# Masteries: one page each. The Feature is a bold small-caps run-in; each Tier is a bold heading
# line ("Tier N - Name"), then an italic usage line, then the rule text.
masteries = {}
for m in man.get('masteries', []):
    if not m['page']:
        continue
    lines = [l for l in rich_lines(m['page']) if l['size'] < 15 and not (l['italic'] and l['size'] >= 11.5)]
    blocks, cur = [], None
    for l in lines:
        if l['bold']:
            cur = {'head': l['text'], 'parts': [l['plain']] if l['plain'] else []}
            blocks.append(cur)
        elif cur is not None:
            # the italic usage line ("1 Standard Action. Cost: 4 Aether") is set apart from the rule text
            if cur['parts'] and cur.get('usage') and not l['italic']:
                cur['parts'][-1] += ' —'
                cur['usage'] = False
            if l['italic'] and not cur['parts']:
                cur['usage'] = True
            cur['parts'].append(l['text'])
    tiers = [b for b in blocks if re.search(r'\b[1-5]\s*-\s', b['head'])]
    feature = next((b for b in blocks if b not in tiers), None)
    out = {}
    if feature:
        out[m['feature']] = join_lines(feature['parts'])
    for name, b in zip(m['abilities'], tiers):
        out[name] = join_lines(b['parts'])
    if len(tiers) != len(m['abilities']) or not feature:
        misses.append(f"mastery:{m['id']} ({len(tiers)} tiers)")
    masteries[m['id']] = out

json.dump({'version': 'Gravebound v1.2 (local)', 'tables': tables, 'creatures': creatures, 'entries': entries, 'masteries': masteries},
          open(out_path, 'w'), ensure_ascii=False, indent=1)
print(f"wrote {out_path}: {sum(len(v) for v in tables.values())} table rows ({stats['geom']} by layout, {stats['text']} by text fallback), "
      f"{sum(len(v) for v in creatures.values())} creature actions, {len(entries)} rule entries, "
      f"{sum(len(v) for v in masteries.values())} Mastery texts")
if misses:
    print(f"{len(misses)} unmatched (shown without original text):", ', '.join(misses[:30]), '…' if len(misses) > 30 else '')
