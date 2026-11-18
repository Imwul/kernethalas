"""Turn the raw stat-block parse into the committed creatures.json (numbers, names, tags only)."""
import json, re, sys
raw = json.load(open(sys.argv[1]))
names = {136:'Abyssal Vexator',137:'Amalgam',138:'Armor Construct',139:'Astral Beast',140:'Bladewings',141:'Bloodstalker',
142:'Blightfang Rats',143:'Bone Golem',144:'Bone Spiders',145:'Cavebound Leech',146:'Corpse Ants',147:'Death Sage',
148:'Desiccated Cryptguards',149:'Dwerax',150:'Fangvine',151:'Flayed Knight',152:'Flesh Eater',153:'Fleshmelt Slime',
154:'Giant Spider',155:'Hive Larvae',156:'Hive Warrior',157:'Hollow Shambler',158:'Living Moss',159:'Necropede',
160:'Netherfiend',161:'Plaguebringer',162:'Pyreborn',163:'Ratkin Marauders',164:'Razorjaw',165:'Reanimated Homunculus',
166:'Rotwalkers',167:'Skeletal Horrors',168:'Stone Warden',169:'Swarmer',170:'Tomb Crawler',171:'Umbra Fiend',
172:'Unfettered Familiar',173:'Vaelorian Magus',174:'Vinekin',175:'Voidweaver',176:'Vorleg',177:'Wraithskull',178:'Wrath Elemental',
181:'Carnage Devourer',183:'Dreadlord',185:'Glacial Burrower',187:'Gorehoof',188:'Infernal Archon',189:'Lesser Demon',
191:'Infernal Tormentor',193:'Pyroclasmic Possessor',195:'Veilshifter',197:'Venomcloud Siren',199:'Zephyrous Shadow',
200:'Arcane Companion',201:'Fire Elemental',202:'Skeleton',203:'Wight'}
TYPES = ['Animal','Astral','Construct','Demon','Elemental','Humanoid','Plant','Undead']
def slug(n): return re.sub(r'[^a-z0-9]+','-',n.lower()).strip('-')
out=[]
for c in raw:
    p=c['page']; name=names[p]
    toks=c['row1'].replace(',', '').split()
    types=[t for t in toks if t in TYPES]
    rest=[t for t in toks if t not in TYPES]
    number,mind,end,body=rest[:4]; health=' '.join(rest[4:])
    r2=c['row2']
    if p==201: r2='Humanoid ( Head) – 40 60'
    m=re.match(r'^(?:(\w[\w ]*?) \(\s*([^)]*)\)|–)\s+(–|\d+ \([^)]*\))\s+(\d+)\s+(\d+)\s*(.*)$', r2)
    assert m, (p, r2)
    hit, weak, armor, cs, mr, spoils = m.groups()
    trait=c['trait']; acts=c['actions']
    if p==189:
        trait='Restored by Fire damage'; acts=[{'min':1,'max':6,'name':'Demonic Slash','tag':'Physical'}]
    if p==201: trait=None
    if p==188:
        # Infernal Archon's action table is printed on p.189 (parsed there)
        acts=[a for x in raw if x['page']==189 for a in x['actions']]
    group='creature' if p<179 else ('overseer' if p<200 else 'minion')
    if p==189: group='overseer-summon'
    out.append({'id':'cr-'+slug(name),'name':name,'page':p if p not in (181,183,185,187,191,193,195,197,199) else p-1,'statPage':p,'group':group,
        'types':types,'number':number,'mind':mind,'endurance':end,'body':body,'health':health,
        'hitLocation':hit,'weakSpot':weak,'armor':armor,'combatSkill':cs,'magicResistance':mr,'spoils':spoils or None,
        'traits':[t.strip() for t in re.split(r',(?![^()]*\))', trait)] if trait and trait!='–' else [],
        'levelAdaptation':c['levelAdaptation'],'actionDice':c['actionDice'] if acts else None,'actions':acts})
# frost elemental shares p.201
fe=next(o for o in out if o['name']=='Fire Elemental')
out.append({**fe,'id':'cr-frost-elemental','name':'Frost Elemental','actions':[{'min':1,'max':4,'name':'Frostbite','tag':'Magical'},{'min':5,'max':6,'name':"Blizzard's Embrace",'tag':'Magical'}]})
fe['actions']=[{'min':1,'max':4,'name':'Ember Blast','tag':'Physical'},{'min':5,'max':6,'name':'Firestorm','tag':'Magical'}]
json.dump(out, open(sys.argv[2],'w'), ensure_ascii=False, indent=1)
for o in out: print(o['name'],'|',o['types'],o['number'],o['health'],'|',o['hitLocation'],o['weakSpot'],'|',o['armor'],o['combatSkill'],o['magicResistance'],'|',o['spoils'],'|',o['traits'],'|',o['levelAdaptation'])
