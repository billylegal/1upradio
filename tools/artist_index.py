#!/usr/bin/env python3
"""The A-Z artists page: every artist credited on any station, with their songs.
Writes data/artists/index.json {letters: {A: count, ...}, stations: [...]} and data/artists/<letter>.json  [[artist name, [[station index, title, video id], ...]], ...]  (sorted, one file per letter, loaded on demand).
Credits: the artist part of the title (main artist and featured artists) and, for remixes, the remixer."""
import json, os, re, sys, unicodedata
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ST = [('1UP Radio', 'main'), ('The Movement', 'movement'), ('Culture Shock', 'culture'), ('The Vault', 'hiphopvinyl'),
      ('City Culture', 'playground'),
      ('T.DOT 6', 'tdot6'), ('T.DOT 6 \u00b7 Dark R&B', 'tdot6-dark'), ('T.DOT 6 \u00b7 After Hours', 'tdot6-after'), ('T.DOT 6 \u00b7 Slow Jams', 'tdot6-slow'),
      ('T.DOT 6 \u00b7 Old School Toronto', 'tdot6-old'), ('T.DOT 6 \u00b7 90s & 2000s Hip Hop', 'tdot6-hh'),
      ('The Portal', 'portal'),
      ('Portal \u00b7 Techno \u00b7 Peak Time', 'portal-techno-peak-time-driving'), ('Portal \u00b7 Techno \u00b7 Raw & Hypnotic', 'portal-techno-raw-deep-hypnotic'), ('Portal \u00b7 Hard Techno', 'portal-hard-techno'),
      ('Portal \u00b7 Tech House', 'portal-tech-house'), ('Portal \u00b7 Deep House', 'portal-deep-house'), ('Portal \u00b7 Minimal / Deep Tech', 'portal-minimal-deep-tech'),
      ('Portal \u00b7 Melodic House & Techno', 'portal-melodic-house-techno'), ('Portal \u00b7 Progressive House', 'portal-progressive-house'), ('Portal \u00b7 Afro House', 'portal-afro-house'),
      ('Portal \u00b7 Organic House', 'portal-organic-house'), ('Portal \u00b7 Drum & Bass', 'portal-drum-bass'), ('Portal \u00b7 UK Garage / Bassline', 'portal-uk-garage-bassline'),
      ('Portal \u00b7 Indie Dance', 'portal-indie-dance'), ('Portal \u00b7 Nu Disco / Disco', 'portal-nu-disco-disco'), ('Portal \u00b7 Amapiano', 'portal-amapiano'),
      ('Portal \u00b7 House', 'portal-house'), ('Portal \u00b7 Bass House', 'portal-bass-house'), ('Portal \u00b7 Funky House', 'portal-funky-house'),
      ('Portal \u00b7 Dance / Pop', 'portal-dance-pop'), ('Portal \u00b7 Indie Tech', 'portal-indie-tech'), ('Portal \u00b7 All Genres', 'portal-all-genres'), ('Portal \u00b7 Commercial', 'portal-commercial')]
# (Portal \u00b7 DJ Mixed plays the same Tech House list, so it adds no new songs and is left out)
BAD = re.compile(r'^(original|extended|radio|club|main|album|instrumental|vocal|dub|full|short|long|new|re ?edit|lp|single|version|official|unofficial|various|various artists|unknown|n/?a|\d+)$', re.I)


def nrm(s):
    s = unicodedata.normalize('NFD', str(s).lower()); s = ''.join(c for c in s if not unicodedata.category(c).startswith('M'))
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


# ---- which part of "A - B" is the artist? Artist names come back again and again across the stations, song titles hardly ever, so the part that recurs more is the artist ----
SEP = re.compile(r'\s+[-–—]\s+|(?<=[A-Za-z0-9$!?.\)])[-–—]\s+')       # "A - B" and the glued "A- B"
SPLIT = re.compile(r'\s*(?:,|&|\band\b|\bx\b|\bvs\.?|\bfeat\.?|\bft\.?|\bfeaturing|\bwith|/|;)\s*', re.I)
DESC = r'extended|club|radio|original|dub|instrumental|vocal|dirty|clean|bootleg|edit|vip|rework|flip|refix|mix|remix|version|live|acoustic|remaster(?:ed)?|mashup|acapella|a cappella|re ?edit|main|full|short|long'
GENRE = set('house deep tech techno trance dub bass funky afro dance disco nu progressive minimal melodic hard raw soul rnb r b hip hop trap reggae dancehall garage drum and pop rock summer winter sunset sunrise night day morning beach party festival anthem halloween christmas holiday new year old school classic vocal piano acoustic latin world'.split())
JUNK = re.compile(r'^(loading\.\.\.|various|various artists|va|unknown|n/?a|untitled|intro|outro|skit|interlude|mixtape|compilation|album|ep|lp|single|official|unofficial|presents?)$|(^|\s)(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2},?\s+)?\d{4}$|^\d{4}$|^\d+(st|nd|rd|th)\b|\bvol\.?\s*\d|~|\bprofile\b|\bsnippets?\b|\bmixtape\b|^\W*$|\b(full album|full ep|hour mix|live (at|@|from)|live set|dj set)\b|\'\s*\d{2,4}(-\d{2,4})?$', re.I)


def clean_seg(sg):
    sg = re.sub(r'\s*[\(\[].*?[\)\]]', '', sg); sg = re.sub(r'\s*/\s*(version|dub|instrumental|pt\.?\s*\w+|part\s*\w+|remix).*$', '', sg, flags=re.I)
    return sg.strip(' -–—')


def names_of(sg):
    out = []
    for n in SPLIT.split(clean_seg(sg)):
        n = n.strip()
        if n: out.append(n)
    return out


def parts_of(title):
    ps = [x for x in (clean_seg(p) for p in SEP.split(re.sub(r'\s+', ' ', title).strip())) if x]
    while len(ps) >= 3 and re.search(r'\b(' + DESC + r')$', ps[-1], re.I): ps.pop()      # "Artist - Song - Afterlife Mix": the last part only says which mix
    return ps


def ok_name(n):
    k = nrm(n)
    return 1 < len(k) < 40 and not re.search(r'[♫"“”]', n) and not BAD.match(n) and not JUNK.search(n) and len(n.split()) <= 6 and not re.search(r'\b(presents?|pres\.)\b.*:|:\s', n)


MIXED = {'culture', 'playground', 'hiphopvinyl'}     # stations whose titles come in both orders
RIGHT_DEFAULT = {'tdot6'}                             # T.DOT 6 is "Song - Artist" all the way
RELIABLE = {'main', 'movement', 'tdot6-dark', 'tdot6-after', 'tdot6-slow'} | {x for _, x in ST if x.startswith('portal')}


class Evidence:
    """K = names we KNOW are artists: the Beatport chart artists, names the online lookups confirmed, and names that head two or more titles on the stations that are always "Artist - Song".
    Rp = for the mixed stations, which different partners each right-hand part is paired with (an artist is paired with many songs)."""
    def __init__(self, per):
        self.K = set(); self.Rp = {}; lc = {}
        try:
            for g in json.load(open(H + '/data/portal-charts.json')).values():
                for t in g['tracks']:
                    for a in t['artists']: self.K.add(nrm(a))
        except Exception: pass
        for f in ('itunes', 'mb', 'deezer'):
            try:
                for k, v in json.load(open(os.path.expanduser('~/.cache/artist-profiles/%s.json' % f))).items():
                    if v: self.K.add(k)
            except Exception: pass
        for f, vs in per:
            for v in vs:
                ps = parts_of(v['title'])
                if len(ps) < 2: continue
                if f in RELIABLE:
                    for n in names_of(ps[0]): lc[nrm(n)] = lc.get(nrm(n), 0) + 1
                if f in MIXED:
                    qs = frozenset(nrm(x) for x in names_of(ps[0])) or frozenset([nrm(ps[0])])
                    L = self.Rp.setdefault(nrm(ps[1]), [])
                    if qs not in L and len(L) < 100: L.append(qs)
        self.K |= {k for k, c in lc.items() if c >= 2}
    def known(self, part): return any(nrm(n) in self.K for n in names_of(part))
    def rgroups(self, part):
        sets = [set(x) for x in self.Rp.get(nrm(part), [])]; n = 0
        while sets:
            g = sets.pop(); ch = True
            while ch:
                ch = False
                for x in sets[:]:
                    if g & x: g |= x; sets.remove(x); ch = True
            n += 1
        return n


ORIENT_P = os.path.expanduser('~/.cache/artist-profiles/orient.json')
try: ORIENT = json.load(open(ORIENT_P))        # {title: 'L' | 'R' | '?'}  settled by looking the pair up online (tools/artist_orient.py)
except Exception: ORIENT = {}


def ambiguous(title, station, ev, swapped=None):
    """(A, B) when a 2-part title is in a station with both orders and no name on either side is known"""
    if swapped and title in swapped: return None
    parts = parts_of(title)
    if len(parts) < 2 or station not in MIXED: return None
    A, B = parts[0], parts[1]
    if ev.known(A) or ev.known(B) or JUNK.search(A) or JUNK.search(B): return None
    return A, B


def credits(title, station, ev, swapped=None):
    parts = parts_of(title); artist_parts = []
    if swapped and title in swapped: artist_parts = [swapped[title][0]]
    elif len(parts) == 1:
        if ev.known(parts[0]): artist_parts = parts            # a lone part is only an artist when we know the name
    else:
        A, B = parts[0], parts[1]; kA, kB = ev.known(A), ev.known(B)
        if kB and not kA: pick = B
        elif kA and not kB: pick = A
        elif ORIENT.get(title) == 'R': pick = B
        elif ORIENT.get(title) == 'L': pick = A
        elif ORIENT.get(title) == '?' and station not in RIGHT_DEFAULT: pick = A      # looked up, not found: the usual order
        elif station in RIGHT_DEFAULT: pick = B
        elif station in MIXED and not kA and ev.rgroups(B) >= 3 and ev.rgroups(A) < 2 and not JUNK.search(B): pick = B
        else: pick = A
        artist_parts = [pick]
    names = []
    for p in artist_parts: names += names_of(p)
    m = re.search(r'[\(\[]([^()\[\]]*?)\s+(?:remix|rework|bootleg|edit|flip|vip|refix|mix|version|dub)\s*[\)\]]', title, re.I)
    if m:
        w = re.split(r"['\u2019]s\s", m.group(1))[0]; w = re.sub(r"['\u2019]s$", '', w).strip()
        for _ in range(4): w = re.sub(r'\s+(?:' + DESC + r')$', '', w, flags=re.I).strip()       # "Dimension Extended" -> "Dimension"
        for r in SPLIT.split(w):
            r = r.strip()
            if r and ok_name(r) and not (set(nrm(r).split()) <= GENRE) and not re.fullmatch(r'(?:' + DESC + r')(\s+(?:' + DESC + r'))*', r, re.I): names.append(r)
    out, seen = [], set()
    for n in names:
        k = nrm(n)
        if ok_name(n) and k not in seen: seen.add(k); out.append(n)
    return out


REVERSED_DEFAULT = set()   # every station is 'Artist - Song' by default; reversed titles are caught by the evidence (an artist is paired with many songs)


def main():
    arts = {}
    allv = {}; per = []
    for si, (label, f) in enumerate(ST):
        vs = json.load(open('%s/data/%s-videos.json' % (H, f))); per.append((si, f, vs))
        for v in vs: allv.setdefault(v['id'], v)
    ev = Evidence([(f, vs) for _, f, vs in per])
    try: swapped = json.load(open(H + '/data/culture-swap.json'))
    except Exception: swapped = {}
    MIXEND = re.compile(r'\s(remix|edit|bootleg|extended|version|instrumental|rework|vip|refix|unofficial|mashup)$', re.I)
    for si, f, vs in per:
        for v in vs:
            for n in credits(v['title'], f, ev, swapped if f == 'culture' else None):
                if MIXEND.search(n) and nrm(n) not in ev.K: continue      # a mix label, not a name
                k = nrm(n); e = arts.setdefault(k, [n, []])
                if len(e[1]) < 300 and not any(x[0] == si and x[2] == v['id'] for x in e[1]): e[1].append([si, v['title'], v['id']])
                if len(n) > len(e[0]) and n.lower() == e[0].lower(): e[0] = n
    byl = {}
    for k, (n, songs) in arts.items():
        c = unicodedata.normalize('NFD', n.strip()[:1].upper()); c = ''.join(x for x in c if not unicodedata.category(x).startswith('M'))
        L = c if re.fullmatch(r'[A-Z]', c) else '#'
        byl.setdefault(L, []).append([n, songs])
    OUTD = os.environ.get('AI_OUT') or (H + '/data/artists'); os.makedirs(OUTD, exist_ok=True)
    for L, rows in byl.items():
        rows.sort(key=lambda r: nrm(r[0]))
        json.dump(rows, open('%s/%s.json' % (OUTD, 'num' if L == '#' else L.lower()), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump({'stations': [s[0] for s in ST], 'letters': {L: len(r) for L, r in sorted(byl.items())}}, open(OUTD + '/index.json', 'w'), separators=(',', ':'))
    print('artists:', sum(len(r) for r in byl.values()), '| per letter:', {L: len(r) for L, r in sorted(byl.items())})


if __name__ == '__main__': main()
