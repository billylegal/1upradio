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
    'hiphopvinyl': {'uploads': '', 'videos': 'data/hiphopvinyl-videos.json', 'plays': 'data/hiphopvinyl-plays.json', 'history': 'data/hiphopvinyl-history.json', 'out': 'schedule-hiphopvinyl.json'},
}
# The Portal's genre channels: one station per chart genre (id -> chart slug); each plays only that genre's songs
PORTAL_GENRES = {'pgpeaktechno': 'techno-peak-time-driving', 'pgrawtechno': 'techno-raw-deep-hypnotic', 'pghardtechno': 'hard-techno', 'pgtechhouse': 'tech-house', 'pgdeephouse': 'deep-house',
                 'pgminimal': 'minimal-deep-tech', 'pgmelodic': 'melodic-house-techno', 'pgprogressive': 'progressive-house', 'pgafro': 'afro-house', 'pgorganic': 'organic-house',
                 'pgdnb': 'drum-bass', 'pgukg': 'uk-garage-bassline', 'pgindiedance': 'indie-dance', 'pgnudisco': 'nu-disco-disco', 'pgamapiano': 'amapiano'}
for _id, _slug in PORTAL_GENRES.items():
    STATIONS[_id] = {'uploads': '', 'videos': 'data/portal-%s-videos.json' % _slug, 'plays': 'data/portal-%s-plays.json' % _id, 'history': 'data/portal-%s-history.json' % _id, 'out': 'schedule-%s.json' % _id}
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
    while t < now + HORIZON:
        fresh = sorted((v for v in vids if v['id'] not in seen), key=lambda v: v['pub'])       # never-played videos first, oldest upload first
        if fresh: pick = fresh[0]
        else:
            block = set(hist[-int(len(vids) * 0.6):])
            pool = [v for v in vids if v['id'] not in block] or vids
            pick = rng.choice(pool)
        hist.append(pick['id']); seen.add(pick['id'])
        plays.append({'t': t, 'id': pick['id'], 'title': pick['title'], 'dur': pick['dur']})
        t += pick['dur'] - XF
    json.dump(plays, open(PLAYS, 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(hist[-5000:], open(os.path.join(HERE, ST['history']), 'w'), separators=(',', ':'))
    json.dump({'built': now, 'delay': 0, 'plays': plays}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('culture shock:', len(vids), 'videos,', len(plays), 'plays scheduled')


if __name__ == '__main__':
    main()
