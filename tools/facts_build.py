#!/usr/bin/env python3
"""Did-you-know facts about the SONG, built ahead of time (no Wikipedia): YouTube (views), what kind of version it is (remix, dub, extended...), Deezer (album, year, tempo, fans)
and MusicBrainz (producers, samples, where the artist is from).
Writes data/facts-<station>.json {video id: [fact, ...]} (best first, up to 4). Resumable: songs already done are skipped.   python3 tools/facts_build.py [main movement culture hiphopvinyl]"""
import json, os, re, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import culture_art as ca
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {'User-Agent': '1upradio-facts/1.0 ( https://1upradio.com )'}
KEYF = os.path.expanduser('~/.config/1upradio/youtube.key')
YTKEY = open(KEYF).read().strip() if os.path.exists(KEYF) else ''


def get(u, sleep=0.0):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=25) as r: return json.load(r)
    except Exception: return None
    finally: time.sleep(sleep)


def norm(s): return ca.fold(re.sub(r'\(.*?\)', '', s or ''))


def human(n):
    n = int(n)
    if n >= 1e9: return '%.1f billion' % (n / 1e9)
    if n >= 1e6: return ('%.1f million' % (n / 1e6)).replace('.0 ', ' ')
    if n >= 1e3: return '%d thousand' % (round(n / 1000) if n < 1e5 else round(n / 10000) * 10)
    return str(n)


TYPES = [
    (r'bootleg', 'A bootleg is an unofficial remix, made without the original label\'s permission.'),
    (r'\b(remix|rework|refix|flip)\b', 'A remix rebuilds a track from the original\'s parts. The "{tag}" in the title marks the producer who reworked this one.'),
    (r'\bvip\b', 'VIP mixes started in drum and bass as exclusive reworks DJs saved for special crowds. Today it means a producer\'s own reworking of a track.'),
    (r'\bdub\b', 'A dub mix strips a song down to drums and bass and soaks it in echo and reverb, a studio technique born in Jamaica in the late 1960s.'),
    (r'extended', 'An extended mix lengthens the intro and outro so DJs have room to blend it into the next record.'),
    (r'radio (edit|mix|version)', 'A radio edit trims a track down to fit radio, usually to about three or four minutes.'),
    (r'\bedit\b', 'An edit re-arranges the original recording, often to make it longer, shorter or easier for DJs to mix, without rebuilding it.'),
    (r'original mix', '"Original Mix" is the label\'s name for the first version of a track, before anyone remixed it.'),
    (r'instrumental', 'An instrumental version is the same track with the vocals taken out.'),
    (r'remaster', 'A remaster re-polishes an older recording so it sounds better on modern speakers.'),
    (r'mashup|mash-up', 'A mashup lays one song\'s vocal over another song\'s instrumental.'),
    (r'\bversion\b', 'In Jamaican music a "version" is the instrumental flip side of a single, and DJs toasted over it. It grew into dub.'),
]


def kind(title):
    tag = (re.findall(r'[\(\[]([^)\]]+)[\)\]]', title) or re.findall(r'\s-\s([^-]*(?:remix|bootleg|edit|rework|refix|flip|mix)[^-]*)$', title, re.I) or [''])[-1].strip()
    t = title.lower()
    for rx, f in TYPES:
        if re.search(rx, t): return f.replace('{tag}', tag)
    return ''


def youtube(vids):
    out = {}
    if not YTKEY: return out
    for i in range(0, len(vids), 50):
        ids = ','.join(v['id'] for v in vids[i:i + 50])
        j = get('https://www.googleapis.com/youtube/v3/videos?part=statistics&id=%s&key=%s' % (ids, YTKEY), 0.1) or {}
        for it in j.get('items', []):
            st = it.get('statistics', {})
            if int(st.get('viewCount', 0) or 0) >= 1000: out[it['id']] = ['This upload has been watched about %s times on YouTube.' % human(st['viewCount'])]
    return out


def deezer_facts(art, tr):
    T, A = ca.toks(tr), ca.toks(art)
    for x in ca.deezer('search', (art + ' ' + tr).strip()):
        if not ca.ok_match(T, A, ca.toks(x.get('title')), ca.toks((x.get('artist') or {}).get('name'))): continue
        out = []; tj = get('https://api.deezer.com/track/%s' % x['id'], 0.2) or {}
        al = (x.get('album') or {}).get('title'); rd = (tj.get('release_date') or '')[:4]
        if al and rd and norm(al) != norm(tr): out.append('It appears on the album "%s" (%s).' % (al, rd))
        elif rd: out.append('It was released in %s.' % rd)
        bpm = float(tj.get('bpm') or 0)
        if 60 <= bpm <= 200: out.append('It runs at about %d beats per minute.' % round(bpm))
        aj = get('https://api.deezer.com/artist/%s' % (x.get('artist') or {}).get('id', 0), 0.2) or {}
        if aj.get('nb_fan', 0) >= 20000: out.append('%s has about %s fans on Deezer.' % ((x.get('artist') or {}).get('name'), human(aj['nb_fan'])))
        return out
    return []


def mb_facts(art, tr):
    q = 'recording:"%s" AND artist:"%s"' % (tr.replace('"', ' '), art.replace('"', ' '))
    j = get('https://musicbrainz.org/ws/2/recording?fmt=json&limit=5&query=' + urllib.parse.quote(q), 1.1)
    T, A = ca.toks(tr), ca.toks(art)
    for x in (j or {}).get('recordings', []):
        if x.get('score', 0) < 95: continue
        ac = [c for c in (x.get('artist-credit') or []) if isinstance(c, dict)]
        if not ca.ok_match(T, A, ca.toks(x.get('title')), ca.toks(' '.join(c.get('name', '') for c in ac))): continue
        out = []
        d = get('https://musicbrainz.org/ws/2/recording/%s?fmt=json&inc=artist-rels+recording-rels' % x['id'], 1.1) or {}
        for r in d.get('relations', []):
            ty = r.get('type'); a = (r.get('artist') or {}).get('name'); rec = (r.get('recording') or {})
            if ty == 'producer' and a and norm(a) != norm(art): out.append('It was produced by %s.' % a)
            elif ty == 'samples material' and rec.get('title'):
                out.append(('It samples "%s".' if r.get('direction') == 'forward' else 'Other artists have sampled it, for example in "%s".') % rec['title'])
        if ac:
            aid = (ac[0].get('artist') or {}).get('id')
            if aid:
                ar = get('https://musicbrainz.org/ws/2/artist/%s?fmt=json' % aid, 1.1) or {}
                area = (ar.get('area') or {}).get('name'); yr = ((ar.get('life-span') or {}).get('begin') or '')[:4]; ty = ar.get('type')
                if area and yr and ty in ('Group', 'Person', 'Orchestra'): out.append('%s is %s from %s and has been active since %s.' % (ac[0].get('name'), 'a group' if ty == 'Group' else 'an artist', area, yr))
                elif area: out.append('%s comes from %s.' % (ac[0].get('name'), area))
        return out
    return []


def station(name, budget):
    vids = json.load(open('%s/data/%s-videos.json' % (H, name))); F = '%s/data/facts-%s.json' % (H, name)
    d = json.load(open(F)) if os.path.exists(F) else {}; n = 0
    todo = [v for v in vids if v['id'] not in d][:budget]
    yt = youtube(todo)
    for v in todo:
        cs = ca.cands(v['title']); k = kind(v['title']); dz = []; mb = []
        if cs:
            dz = deezer_facts(*cs[0]) or (deezer_facts(*cs[1]) if len(cs) > 1 else [])
            mb = mb_facts(*cs[0]) or (mb_facts(*cs[1]) if len(cs) > 1 else [])
        # best first: where it came from, what kind of version, who made it, then the numbers
        facts = dz[:1] + ([k] if k else []) + mb + dz[1:] + yt.get(v['id'], [])
        seen, out = set(), []
        for f in facts:
            if f and f not in seen: seen.add(f); out.append(f)
        d[v['id']] = out[:4]; n += 1
        if n % 10 == 0: json.dump(d, open(F, 'w'), ensure_ascii=False, separators=(',', ':')); print(name, n, flush=True)
    json.dump(d, open(F, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(name, 'songs with facts:', sum(1 for x in d.values() if x), 'of', len(d), flush=True)


if __name__ == '__main__':
    names = {'1up': 'main', 'cultureshock': 'culture', 'vault': 'hiphopvinyl'}
    for st in (sys.argv[1:] or ['main', 'movement']): station(names.get(st, st), 100000)
