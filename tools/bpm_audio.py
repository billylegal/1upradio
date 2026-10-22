#!/usr/bin/env python3
"""BPM for songs nobody lists a tempo for: stream ~40 s from the middle of the song (ffmpeg reads just that slice, nothing is saved), measure the beat, add it to data/bpm.json.
Resumable. Stops by itself if YouTube starts refusing (30 failures in a row).   python3 tools/bpm_audio.py [limit]"""
import glob, json, os, subprocess, sys, time, random
from concurrent.futures import ThreadPoolExecutor
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import settempo as st
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = H + '/data/bpm.json'; BAD = H + '/data/bpm-audio-failed.json'
RANGE = {'main': (80, 180), 'movement': (95, 160), 'culture': (60, 115), 'hiphopvinyl': (65, 130), 'tdot6': (65, 130), 'playground': (70, 135), 'portal': (95, 180)}   # where to look for the beat, per channel


def jl(p, d):
    try: return json.load(open(p))
    except Exception: return d


def songs():
    out = {}
    for g in ('main', 'movement', 'culture', 'hiphopvinyl', 'tdot6', 'playground', 'portal'):
        for v in jl(H + '/data/%s-videos.json' % g, []): out.setdefault(v['id'], g)
    for f in glob.glob(H + '/data/tdot6*-videos.json') + glob.glob(H + '/data/portal-*-videos.json'):
        g = 'tdot6' if 'tdot6' in f else 'portal'
        for v in jl(f, []): out.setdefault(v['id'], g)
    return out


def estimate(x, g):
    """kick-band onsets -> autocorrelation -> the tempo whose beat, 2 beats and bar (4 beats) all line up, minus the dotted/triplet look-alikes. Checked on 40 store-chart songs with known tempos: 36 exact, 0 octave errors."""
    FS = st.FS; n = 1 + (len(x) - st.N) // st.HOP; win = np.hanning(st.N); fr = np.fft.rfftfreq(st.N, 1 / st.SR); lo_m = (fr >= 40) & (fr <= 170); L = np.zeros(n, np.float32)
    for i in range(0, n, 8000):
        j = min(n, i + 8000); idx = np.arange(st.N)[None, :] + st.HOP * np.arange(i, j)[:, None]
        L[i:j] = np.log1p(np.abs(np.fft.rfft(x[idx] * win, axis=1))[:, lo_m].sum(1))
    env = np.maximum(np.diff(L, prepend=L[0]), 0); env = env - env.mean(); m = len(env)
    f = np.fft.rfft(env, 2 * m); ac = np.fft.irfft(f * np.conj(f))[:m]; ac = ac / (ac[0] + 1e-9)
    def a(l):
        k = int(l); return ac[k] * (1 - (l - k)) + ac[min(k + 1, m - 1)] * (l - k) if k + 1 < m else 0.0
    lo, hi = RANGE[g]; bp = np.arange(lo, hi, 0.25); sc = []
    for b in bp:
        Lg = FS * 60 / b; sc.append(a(Lg) + 0.6 * a(2 * Lg) + 0.6 * a(4 * Lg) - 0.3 * a(1.5 * Lg) - 0.3 * a(0.75 * Lg))
    sc = np.array(sc); k = int(np.argmax(sc)); conf = float(sc[k] - np.median(sc))
    return float(bp[k]), conf


def measure(vid, g):
    try:
        u = subprocess.run(['yt-dlp', '-f', 'worstaudio', '-g', '--no-warnings', 'https://www.youtube.com/watch?v=' + vid], capture_output=True, text=True, timeout=60).stdout.strip().splitlines()
        if not u: return None
        raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-ss', '45', '-t', '40', '-i', u[0], '-ac', '1', '-ar', str(st.SR), '-f', 'f32le', '-'], capture_output=True, timeout=90).stdout
        x = np.frombuffer(raw, dtype=np.float32)
        if len(x) < st.SR * 20: return None
        b, conf = estimate(x, g)
        return '~%d' % round(b)   # a measured estimate, shown with a ~ on the site
    except Exception:
        return None


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 10 ** 9
    bpm = jl(F, {}); failed = set(jl(BAD, []))
    allsongs = songs(); soon = {}; now = time.time()
    for f in glob.glob(H + '/schedule*.json'):   # what is about to play on any channel (next 36 h) goes first, so the label is there when it airs
        for pl in (jl(f, {}).get('plays') or []):
            if now - 600 <= pl['t'] <= now + 36 * 3600: soon.setdefault(pl['id'], pl['t'])
    order = sorted(allsongs, key=lambda v: soon.get(v, 1e18))
    todo = [(v, allsongs[v]) for v in order if v not in bpm and v not in failed][:limit]
    print('to measure', len(todo), flush=True); fails = 0; done = 0
    with ThreadPoolExecutor(5) as ex:
        for i in range(0, len(todo), 40):
            chunk = todo[i:i + 40]
            for (v, g), b in zip(chunk, ex.map(lambda t: (time.sleep(random.random() * 1.2), measure(*t))[1], chunk)):
                if b: bpm[v] = b; fails = 0; done += 1
                else: failed.add(v); fails += 1
            cur = jl(F, {}); cur.update({v: b for v, b in bpm.items() if v not in cur}); json.dump(cur, open(F, 'w'), separators=(',', ':')); json.dump(sorted(failed), open(BAD, 'w'))
            print(i + len(chunk), 'of', len(todo), '| measured', done, '| failed in a row', fails, flush=True)
            if fails >= 30: print('YouTube is refusing: stopping so it can cool down', flush=True); return
    print('done', done, 'measured')


if __name__ == '__main__': main()
