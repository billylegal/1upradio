#!/usr/bin/env python3
"""The record label of each song, for the "artist accounts" row (labels get accounts too).
Sources, in order: the YouTube description (auto-generated uploads carry "℗ 2019 Label Name"), then the album's label on Deezer.
Writes data/labels.json {video id: label name}; data/labels-tried.json remembers songs where nothing was found. Songs about to air first. Resumable.   python3 tools/labels_build.py [max songs]"""
import json, os, re, sys, time, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import culture_art as ca
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = H + '/data/labels.json'; TRIED = H + '/data/labels-tried.json'
KEY = open(os.path.expanduser('~/.config/1upradio/youtube.key')).read().strip()
FILES = [('main', 'schedule.json'), ('culture', 'schedule-culture.json'), ('hiphopvinyl', 'schedule-hiphopvinyl.json'), ('movement', 'schedule-movement.json')]
DIST = re.compile(r'^(tunecore|distrokid|cd ?baby|the orchard( enterprises)?|believe( digital)?|ingrooves|fuga|symphonic( distribution)?|awal|amuse|ditto( music)?|routenote|onerpm|idol|stem|bandcamp|soundcloud|youtube|unitedmasters|spinnup|tracksuit|label ?worx|zebralution|kontor|self[- ]?released|independent|n/?a)\b', re.I)


def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': '1upradio-labels/1.0 ( https://1upradio.com )'}), timeout=30) as r: return json.load(r)
    except Exception: return None


def clean(l):
    l = re.sub(r'\s+', ' ', str(l or '')).strip()
    l = re.sub(r'^(?:℗|\(p\)|©)\s*', '', l, flags=re.I); l = re.sub(r'^\d{4}(\s*[,&]\s*\d{4})*\s*', '', l)
    l = re.split(r'\s+(?:under exclusive licen[cs]e to|exclusively licensed to|licensed to|distributed by|a division of)\s+', l, flags=re.I)[0]
    l = re.sub(r'\s*\((?:[^)]*)\)\s*$', '', l)                       # "Parlophone (France)" -> "Parlophone"
    l = re.split(r'\s*/\s*', l)[0]                                  # "Daft Life Ltd./ADA France" -> "Daft Life Ltd."
    l = re.sub(r'[,\s]+(?:ltd|limited|llc|inc|gmbh|s\.?a\.?|b\.?v\.?|ab)\.?$', '', l, flags=re.I).strip(' .,-')
    return l if 2 < len(l) < 50 and not DIST.match(l) else ''


def yt_label(desc, artist):
    m = re.search(r'℗\s*(?:\d{4}\s*(?:[,&]\s*\d{4}\s*)?)?(.+)', desc)
    l = clean(m.group(1)) if m else ''
    if not l:
        m = re.search(r'(?im)^\s*label\s*[:\-]\s*(.+)$', desc); l = clean(m.group(1)) if m else ''
    if not l:
        m = re.search(r'Provided to YouTube by (.+)', desc); l = clean(m.group(1)) if m else ''
    return '' if ca.fold(l) == ca.fold(artist) else l


def deezer_label(title):
    for art, tr in ca.cands(title)[:2]:
        T, A = ca.toks(tr), ca.toks(art)
        for x in ca.deezer('search', (art + ' ' + tr).strip()):
            if ca.ok_match(T, A, ca.toks(x.get('title')), ca.toks((x.get('artist') or {}).get('name'))):
                al = get('https://api.deezer.com/album/%s' % (x.get('album') or {}).get('id')) or {}
                return clean(al.get('label'))
    return ''


def order():
    soon, allv = [], []
    for st, f in FILES:
        for v in json.load(open('%s/data/%s-videos.json' % (H, 'main' if st == 'main' else st))): allv.append(v)
        s = get('https://1upradio.com/%s?x=%d' % (f, time.time())) or {}
        now = time.time() - s.get('delay', 0)
        soon += [(p['t'], p['id']) for p in s.get('plays', []) if now - 600 <= p['t'] <= now + 36 * 3600]
    byid = {v['id']: v for v in allv}; seen, out = set(), []
    for t, i in sorted(soon):
        if i in byid and i not in seen: seen.add(i); out.append(byid[i])
    return out + [v for v in allv if v['id'] not in seen]


def main():
    cap = int(sys.argv[1]) if len(sys.argv) > 1 else 100000
    try: d = json.load(open(OUT))
    except Exception: d = {}
    try: tried = json.load(open(TRIED))
    except Exception: tried = {}
    todo = [v for v in order() if v['id'] not in d and v['id'] not in tried][:cap]
    print('songs to look at:', len(todo), flush=True); n = 0
    for i in range(0, len(todo), 50):
        chunk = todo[i:i + 50]
        j = get('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=%s&key=%s' % (','.join(v['id'] for v in chunk), KEY)) or {}
        desc = {it['id']: it['snippet'].get('description', '') for it in j.get('items', [])}
        for v in chunk:
            artist = re.split(r'\s[-–—]\s', v['title'])[0]
            lab = yt_label(desc.get(v['id'], ''), artist) or deezer_label(v['title'])
            time.sleep(0.25)
            if lab: d[v['id']] = lab
            else: tried[v['id']] = 1
            n += 1
        for p, o in ((OUT, d), (TRIED, tried)): json.dump(o, open(p + '.tmp', 'w'), ensure_ascii=False, separators=(',', ':')); os.replace(p + '.tmp', p)
        print('%d looked at, %d labels' % (n, len(d)), flush=True)
    print('done:', len(d), 'songs with a label', flush=True)


if __name__ == '__main__': main()
