"""Culture Shock (roots reggae): follow its YouTube source channel and keep a clock-synced schedule.

  data/culture-videos.json   every embeddable video of the channel  {id, title, dur, pub}
  data/culture-plays.json    the plays already decided (kept, so the song on air never changes under listeners)
  schedule-culture.json      what the website reads (same format as schedule.json, delay 0 = real time)

New uploads play soon (before anything is repeated); once everything has been played the order starts again,
never repeating a song from the last 60% of the library. Uses the YouTube Data API (quota ~40 units per run)."""
import json, os, random, re, sys, time, urllib.parse, urllib.request

# every station that follows a YouTube channel: uploads playlist (UU + the channel id without its UC) and the names of its files
STATIONS = {
    'culture': {'uploads': 'UUcS-Gz7tDZmJbsi5M-DLsQw', 'videos': 'data/culture-videos.json', 'plays': 'data/culture-plays.json', 'history': 'data/culture-history.json', 'out': 'schedule-culture.json'},
    'movement': {'uploads': '', 'videos': 'data/movement-videos.json', 'plays': 'data/movement-plays.json', 'history': 'data/movement-history.json', 'out': 'schedule-movement.json'},   # hand-picked folder: no channel to follow
    'portal': {'uploads': '', 'videos': 'data/portal-videos.json', 'plays': 'data/portal-plays.json', 'history': 'data/portal-history.json', 'out': 'schedule-portal.json'},   # chart-driven: refreshed daily by portal_charts.py + portal_build.py
    'tdot6': {'uploads': '', 'videos': 'data/tdot6-videos.json', 'plays': 'data/tdot6-plays.json', 'history': 'data/tdot6-history.json', 'out': 'schedule-tdot6.json'},   # hand-picked: all Toronto music, slow + mellow
    'tdot6old': {'uploads': '', 'videos': 'data/tdot6-old-videos.json', 'plays': 'data/tdot6old-plays.json', 'history': 'data/tdot6old-history.json', 'out': 'schedule-tdot6old.json'},   # T.DOT 6 sub-genre
    'tdot6dark': {'uploads': '', 'videos': 'data/tdot6-dark-videos.json', 'plays': 'data/tdot6dark-plays.json', 'history': 'data/tdot6dark-history.json', 'out': 'schedule-tdot6dark.json'},   # T.DOT 6 sub-genre
    'tdot6after': {'uploads': '', 'videos': 'data/tdot6-after-videos.json', 'plays': 'data/tdot6after-plays.json', 'history': 'data/tdot6after-history.json', 'out': 'schedule-tdot6after.json'},   # T.DOT 6 sub-genre
    'tdot6slow': {'uploads': '', 'videos': 'data/tdot6-slow-videos.json', 'plays': 'data/tdot6slow-plays.json', 'history': 'data/tdot6slow-history.json', 'out': 'schedule-tdot6slow.json'},   # T.DOT 6 sub-genre
    'tdot6hh': {'uploads': '', 'videos': 'data/tdot6-hh-videos.json', 'plays': 'data/tdot6hh-plays.json', 'history': 'data/tdot6hh-history.json', 'out': 'schedule-tdot6hh.json'},   # T.DOT 6 sub-genre
    'playground': {'own': 'data/playground-own.json', 'own_every': 8, 'uploads': '', 'videos': 'data/playground-videos.json', 'plays': 'data/playground-plays.json', 'history': 'data/playground-history.json', 'out': 'schedule-playground.json'},   # every track the PLAYGRND SERIES DJs play (set chapters)
    'hiphopvinyl': {'uploads': '', 'videos': 'data/hiphopvinyl-videos.json', 'plays': 'data/hiphopvinyl-plays.json', 'history': 'data/hiphopvinyl-history.json', 'out': 'schedule-hiphopvinyl.json'},
}
# The Portal's genre channels: one station per chart genre (id -> chart slug); each plays only that genre's songs
PORTAL_GENRES = {'pgpeaktechno': 'techno-peak-time-driving', 'pgrawtechno': 'techno-raw-deep-hypnotic', 'pghardtechno': 'hard-techno', 'pgtechhouse': 'tech-house', 'pgdeephouse': 'deep-house',
                 'pgminimal': 'minimal-deep-tech', 'pgmelodic': 'melodic-house-techno', 'pgprogressive': 'progressive-house', 'pgafro': 'afro-house', 'pgorganic': 'organic-house',
                 'pgtechmix': 'tech-house', 'pgdnb': 'drum-bass', 'pgukg': 'uk-garage-bassline', 'pgindiedance': 'indie-dance', 'pgnudisco': 'nu-disco-disco', 'pgamapiano': 'amapiano'}
for _id, _slug in PORTAL_GENRES.items():
    STATIONS[_id] = {'tempo': 'data/portal-%s-bpm.json' % _slug, **({'grid': 'data/portal-%s-grid.json' % _slug.replace('-', '')} if _id == 'pgtechmix' else {}), 'uploads': '', 'videos': 'data/portal-%s-videos.json' % _slug, 'plays': 'data/portal-%s-plays.json' % _id, 'history': 'data/portal-%s-history.json' % _id, 'out': 'schedule-%s.json' % _id}
NAME = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in STATIONS else 'culture'
ST = dict(STATIONS[NAME])
try:   # a source channel can live in a private file on this PC instead of in the public repo
    ST['uploads'] = json.load(open(os.path.expanduser('~/.config/1upradio/station-sources.json'))).get(NAME, ST['uploads'])
except Exception: pass
CHANNEL_UPLOADS = ST['uploads']
XF = 5                                           # songs overlap by this many seconds: the site blends each song into the next (all stations but the original 1UP Radio)
HORIZON = 7 * 24 * 3600                          # always schedule a week ahead
KEEP_PAST = 12 * 3600                            # and keep half a day behind (the Just Played list)
MIN_DUR, MAX_DUR = 60, 1500
API = 'https://www.googleapis.com/youtube/v3/'
KEY_FILE = os.path.expanduser('~/.config/1upradio/youtube.key')
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS, PLAYS, OUT = (os.path.join(HERE, p) for p in (ST['videos'], ST['plays'], ST['out']))


def api(path, **params):
    key = os.environ.get('YOUTUBE_API_KEY') or open(KEY_FILE).read().strip()
    q = urllib.parse.urlencode(dict(params, key=key))
    with urllib.request.urlopen(API + path + '?' + q, timeout=30) as r:
        return json.load(r)


def iso_secs(d):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$', d or '')
    return (int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + int(m.group(3) or 0)) if m else 0


def fetch_videos():
    ids, page = [], None
    while True:
        r = api('playlistItems', part='contentDetails', maxResults=50, playlistId=CHANNEL_UPLOADS, **({'pageToken': page} if page else {}))
        ids += [i['contentDetails']['videoId'] for i in r.get('items', [])]
        page = r.get('nextPageToken')
        if not page: break
    out = []
    for i in range(0, len(ids), 50):
        r = api('videos', part='contentDetails,snippet,status', id=','.join(ids[i:i + 50]))
        for v in r.get('items', []):
            st = v.get('status', {}); d = iso_secs(v['contentDetails']['duration'])
            if not st.get('embeddable') or st.get('privacyStatus') != 'public' or not MIN_DUR <= d <= MAX_DUR: continue
            out.append({'id': v['id'], 'title': v['snippet']['title'], 'dur': d, 'pub': v['snippet']['publishedAt']})
    return out


def load(p, default):
    try: return json.load(open(p))
    except Exception: return default


def plan(gA, soA, A_dur, gB):
    """How song B comes in over song A. Returns (mo, so, xi, aligned): A's position where B starts, B's start position, the overlap in seconds, whether the bars are locked.
    With a beat grid for both songs: B starts L bars before its groove begins, exactly when A is L bars before its groove ends, so A's outro and B's intro sit on the same bar lines.
    The overlap is shortened when the two tempos differ (the bars would drift apart): at most ~40 ms of drift over the overlap."""
    if gA and gB:
        barA, barB = gA['bar'], gB['bar']; dB = abs(gA['bpm'] - gB['bpm'])
        maxsec = 999.0 if dB < 0.03 else 0.08 * gA['bpm'] / dB   # YouTube's player only changes speed in 5 % steps, so B cannot be tempo-matched: the site lines the bars up at the middle of the overlap, and the overlap is capped so the bars drift apart by under ~40 ms either side
        intro = int((gB['gin'] - gB['d0']) / barB + 0.01)
        O = min(16, intro) if intro >= 4 else 4                 # bars of overlap: B's whole intro, at least 4 (these are mostly radio edits with little or no intro)
        while O > 4 and O * barA > maxsec: O -= 1
        if O * barA <= maxsec:
            so = gB['gin'] - O * barB if intro >= 4 else gB['d0']
            mo = gA['gout'] - O * barA
            if so >= 0 and mo > soA + 20 and mo + O * barA <= gA['dur'] + 0.5: return mo, so, O * barA, 1
    return A_dur - XF, 0, XF, 0


def main():
    now = int(time.time())
    try:
        if not CHANNEL_UPLOADS: raise RuntimeError('a fixed list (no channel)')
        vids = fetch_videos()
        if len(vids) < 50: raise RuntimeError('only %d videos came back' % len(vids))
        json.dump(vids, open(VIDEOS, 'w'), ensure_ascii=False, separators=(',', ':'))
    except Exception as e:
        if CHANNEL_UPLOADS: print('channel fetch failed:', e, '- keeping the last list', file=sys.stderr)
        vids = load(VIDEOS, [])
    if not vids: sys.exit(1)
    by = {v['id']: v for v in vids}
    old = load(PLAYS, [])
    hist = load(os.path.join(HERE, ST['history']), [])      # ids in the order they were scheduled (all time)
    # what is already decided up to one hour from now is final; the rest is re-planned (so new uploads jump the queue)
    plays = [p for p in old if p['t'] <= now + 3600 and p['t'] + p['dur'] > now - KEEP_PAST]
    for p in reversed([p for p in old if p['t'] > now + 3600]):
        if hist and hist[-1] == p['id']: hist.pop()
    t = plays[-1]['t'] + plays[-1]['dur'] - XF if plays else now - now % 60
    rng = random.Random(now // 3600)
    seen = set(hist)
    BPM = load(os.path.join(HERE, ST['tempo']), {}) if ST.get('tempo') and os.path.exists(os.path.join(HERE, ST['tempo'])) else {}
    GRID = load(os.path.join(HERE, ST['grid']), {}) if ST.get('grid') else {}
    for _i, _g in GRID.items(): BPM[_i] = _g['bpm']
    if BPM: vids = [v for v in vids if 124 <= BPM.get(v['id'], 128) <= 134]   # a tight set: outliers far from the groove are left out
    cur_bpm = BPM.get(hist[-1]) if hist else None
    while t < now + HORIZON:
        fresh = sorted((v for v in vids if v['id'] not in seen), key=lambda v: v['pub'])       # never-played videos first, oldest upload first
        if fresh and not BPM: pick = fresh[0]
        else:
            block = set(hist[-int(len(vids) * 0.6):])
            pool = (fresh if (fresh and BPM) else [v for v in vids if v['id'] not in block]) or vids
            if BPM and cur_bpm:   # tempo glide: the next song is one of the closest in tempo to the last one (a DJ's set drifts, it does not jump)
                known = [v for v in pool if v['id'] in BPM]
                if known:
                    want = cur_bpm + rng.choice((-0.4, 0, 0, 0, 0.4))   # club DJs hold a tempo for minutes and move 0.2-0.5 BPM at a time (measured on 20 full sets)
                    known.sort(key=lambda v: abs(BPM[v['id']] - want)); pick = rng.choice(known[:2])
                else: pick = rng.choice(pool)
            else: pick = rng.choice(pool)
        hist.append(pick['id']); seen.add(pick['id']); cur_bpm = BPM.get(pick['id'], cur_bpm)
        if ST.get('own_every') and len(plays) % ST['own_every'] == ST['own_every'] - 1:   # every Nth song is one of Billy's own
            own_ = load(os.path.join(HERE, ST['own']), [])
            if own_: pick = own_[(len(plays) // ST['own_every']) % len(own_)]
        entry = {'t': t, 'id': pick['id'], 'title': pick['title'], 'dur': pick['dur']}
        if GRID.get(pick['id']): entry['bpm'] = round(GRID[pick['id']]['bpm'], 3)
        if GRID and plays:
            pa = plays[-1]; mo, so, xi, al = plan(GRID.get(pa['id']), pa.get('so', 0), pa['dur'], GRID.get(pick['id']))
            pa['mo'] = round(mo, 3); pa['len'] = round(mo - pa.get('so', 0) + xi, 3)
            entry['t'] = t = round(pa['t'] + mo - pa.get('so', 0), 3)
            if al: entry['so'] = round(so, 3); entry['xi'] = round(xi, 3); entry['al'] = 1
        plays.append(entry)
        t += pick['dur'] - XF
    json.dump(plays, open(PLAYS, 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(hist[-5000:], open(os.path.join(HERE, ST['history']), 'w'), separators=(',', ':'))
    json.dump({'built': now, 'delay': 0, 'plays': plays}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('culture shock:', len(vids), 'videos,', len(plays), 'plays scheduled')


if __name__ == '__main__':
    main()
