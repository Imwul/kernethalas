"""Extract creature stat blocks (numbers, names, tags only) from the user's local Core PDF text.

Usage: python3 -I scripts/parse_creatures.py .source-local/text/KerNethalas-Corebook.txt src/content/generated/creatures.json
Only factual stat values and action *names* are written; action descriptions are not.
"""
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
text = open(src).read()
pages = {}
for m in re.finditer(r'<<<PAGE (\d+)>>>\n(.*?)(?=\n\n<<<PAGE|\Z)', text, re.S):
    pages[int(m.group(1))] = ' '.join(m.group(2).split())

def norm(s):
    return re.sub(r'(?<=\w)7(?=\w)', 'f', s)

blocks = []
for start in list(range(136, 179)) + list(range(180, 200)) + list(range(200, 204)):
    t = norm(pages.get(start, ''))
    if 'TYPE NUMBER MIND' not in t:
        continue
    blocks.append((start, t))

ACT = re.compile(r'(?:(?<=\s)|^)(\d+(?:-\d+)?) ([A-Z][A-Za-z\'’ ,-]{2,40}?)(?: \((Physical|Magical)\))?: ')
res = []
for page, t in blocks:
    m = re.search(r'TYPE NUMBER MIND ENDURANCE BODY HEALTH (.*?) HIT LOCATION ARMOR COMBAT SKILL MAGIC RESISTANCE(?: SPOILS)? (.*?)(?: TRAIT (.*?))?(?: LEVEL ADAPTATION (.*?))?(?: MASTERY MINIONS)?$', t)
    if not m:
        print('NO STAT', page); continue
    row1, row2, trait, lvl = m.groups()
    head = t[: t.find('D6 ACTIONS')] if 'D6 ACTIONS' in t else ''
    acts = []
    body = t[t.find('ACTIONS') + 8 : t.find('TYPE NUMBER MIND')] if 'ACTIONS' in t else ''
    dice = re.search(r'(D\d+) ACTIONS', t)
    for a in ACT.finditer(body):
        rng = a.group(1)
        lo, hi = (rng.split('-') + [rng])[:2]
        acts.append({'min': int(lo), 'max': int(hi), 'name': a.group(2).strip(), 'tag': a.group(3)})
    res.append({'page': page, 'row1': row1, 'row2': row2, 'trait': trait, 'levelAdaptation': lvl,
                'actionDice': dice.group(1) if dice else None, 'actions': acts})
json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(res), 'blocks')
