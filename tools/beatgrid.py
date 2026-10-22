#!/usr/bin/env python3
"""Beat grid of a folder of audio files (temporary downloads): exact BPM, where the beat/bar lines fall, where the groove starts and where the outro begins.
Writes JSON {id: {bpm, b0 (first beat, s), d0 (first downbeat, s), gin (groove starts, s, on a bar line), gout (groove ends, s, on a bar line), dur}}.   python3 tools/beatgrid.py <audio dir> <bpm hints json> <out json>"""
import glob, json, os, subprocess, sys
import numpy as np
SR, N, HOP = 22050, 1024, 256
FS = SR / HOP


def load(f):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def spec(x):
    n = 1 + (len(x) - N) // HOP
    idx = np.arange(N)[None, :] + HOP * np.arange(n)[:, None]
    fr = x[idx] * np.hanning(N)[None, :]
    return np.abs(np.fft.rfft(fr, axis=1))


def analyse(f, hint):
    x = load(f); dur = len(x) / SR
    M = spec(x); fr = np.fft.rfftfreq(N, 1 / SR)
    low = M[:, (fr >= 40) & (fr <= 160)].sum(1); mid = M[:, (fr > 160) & (fr <= 6000)].sum(1)
    lg = np.log1p(low); flux = np.maximum(np.diff(lg, prepend=lg[0]), 0)             # kick onsets
    mg = np.log1p(mid); fm = np.maximum(np.diff(mg, prepend=mg[0]), 0)
    env = flux / (flux.std() + 1e-9) + 0.5 * fm / (fm.std() + 1e-9)
    env -= env.mean()
    L = len(env); best = (-1e9, hint, 0.0)
    for bpm in np.arange(hint - 2.5, hint + 2.5001, 0.05):
        P = FS * 60.0 / bpm; nb = int((L - 1) / P) - 1
        ks = np.arange(nb); 
        for ph in np.arange(0, P, 0.5):
            t = ph + ks * P
            sc = np.interp(t, np.arange(L), env).mean()
            if sc > best[0]: best = (sc, bpm, ph)
    _, bpm, ph = best; P = FS * 60.0 / bpm
    nb = int((L - 1 - ph) / P)
    beats = ph + np.arange(nb) * P                                                     # beat positions in frames
    b0 = beats[0] / FS
    # downbeat: the beat-in-bar (0..3) whose beats carry the most low-band energy plus mid-band flux (bar starts hit hardest)
    bs = np.interp(beats, np.arange(L), env)
    ph4 = int(np.argmax([bs[k::4].mean() for k in range(4)]))
    dbeats = beats[ph4::4]; bar = 4 * P / FS
    # groove: bars whose bass energy is high
    be = np.array([low[int(a):int(a + 4 * P)].mean() if int(a + 4 * P) < L else 0 for a in dbeats])
    thr = 0.55 * np.median(be[be > 0]) if (be > 0).any() else 0
    on = np.where(be >= thr)[0]
    gin = float(dbeats[on[0]] / FS) if len(on) else float(dbeats[0] / FS)
    gout = float(dbeats[on[-1] + 1] / FS) if len(on) and on[-1] + 1 < len(dbeats) else float(dbeats[-1] / FS)
    return {'bpm': round(float(bpm), 2), 'b0': round(float(b0), 3), 'd0': round(float(dbeats[0] / FS), 3), 'bar': round(float(bar), 4), 'gin': round(gin, 2), 'gout': round(gout, 2), 'dur': round(dur, 1), 'conf': round(float(best[0]), 3)}


def main():
    d, hints, out = sys.argv[1:4]
    hints = json.load(open(hints)); res = json.load(open(out)) if os.path.exists(out) else {}
    for f in sorted(glob.glob(d + '/*')):
        vid = os.path.basename(f).split('.')[0]
        if vid in res or f.endswith(('.part', '.ytdl')): continue
        try: res[vid] = analyse(f, float(hints.get(vid, 128)))
        except Exception as e: print('fail', vid, e, file=sys.stderr); continue
        json.dump(res, open(out, 'w'), separators=(',', ':')); print(vid, res[vid], flush=True)


if __name__ == '__main__': main()
