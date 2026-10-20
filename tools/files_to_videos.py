"""Find the YouTube video of every song in a folder of Billy's (usage: files_to_videos.py FOLDER OUTNAME).
The folder's files were downloaded with yt-dlp, whose archive (~/archive.txt) lists the video ids; the YouTube Data API gives title/length/embeddable for 50 ids a call
(1 quota unit). A file belongs to a video when the file name equals the video title (yt-dlp swaps / and : for look-alike characters, so both sides are folded).
Writes data/hiphop-videos.json  [{id, title, dur, pub}]."""
import json, os, re, sys, unicodedata, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDER = os.path.expanduser(sys.argv[1]); OUTN = sys.argv[2]; ARCHIVE = os.path.expanduser('~/archive.txt'); KEY = open(os.path.expanduser('~/.config/1upradio/youtube.key')).read().strip()
def fold(t):
    t = unicodedata.normalize('NFKC', (t or '')).lower(); t = unicodedata.normalize('NFD', t); t = ''.join(c for c in t if not unicodedata.category(c).startswith('M'))
    return re.sub(r'[\W_]+', ' ', t).strip()
def iso_secs(d):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$', d or ''); return (int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + int(m.group(3) or 0)) if m else 0
def api(ids):
    q = urllib.parse.urlencode({'part': 'snippet,contentDetails,status', 'id': ','.join(ids), 'key': KEY})
    with urllib.request.urlopen('https://www.googleapis.com/youtube/v3/videos?' + q, timeout=30) as r: return json.load(r).get('items', [])
files = {fold(os.path.splitext(f)[0]): f for f in os.listdir(FOLDER) if f.lower().endswith(('.mp3', '.mp4'))}
ids = [l.split()[1] for l in open(ARCHIVE) if l.startswith('youtube ')]
culture = {v['id'] for f in ('culture', 'hiphopvinyl') if os.path.exists(os.path.join(HERE, 'data/%s-videos.json' % f)) for v in json.load(open(os.path.join(HERE, 'data/%s-videos.json' % f)))} if OUTN != 'culture' else set()
ids = [i for i in dict.fromkeys(ids) if i not in culture]
print(len(files), 'files;', len(ids), 'archive ids to look at', flush=True)
out, seen = [], set()
for i in range(0, len(ids), 50):
    for v in api(ids[i:i + 50]):
        k = fold(v['snippet']['title'])
        if k in files and k not in seen and v['status'].get('embeddable') and v['status'].get('privacyStatus') == 'public':
            d = iso_secs(v['contentDetails']['duration'])
            if 60 <= d <= 1500: out.append({'id': v['id'], 'title': v['snippet']['title'], 'dur': d, 'pub': v['snippet']['publishedAt']}); seen.add(k)
json.dump(out, open(os.path.join(HERE, 'data/%s-videos.json' % OUTN), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'songs matched to embeddable videos;', len(files) - len(seen), 'files without a match')
