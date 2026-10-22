#!/usr/bin/env python3
"""Publishes the data files my background jobs write (artist facts and links, song facts, album covers, loudness) to the live site, only when something changed.
Safety rules: only these files; each must be valid JSON; a file is never published if it has FEWER entries than the live one (no shrinking); schedule*.json, plays.json and
tracks.json belong to the cloud workflow and are never touched. Runs from a systemd timer every few hours; log: ~/.cache/1up-publish.log"""
import json, os, subprocess, sys, tempfile, shutil, time
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['artist-auto.json', 'artist-links.json', 'facts-main.json', 'facts-movement.json', 'facts-culture.json', 'facts-hiphopvinyl.json',
         'main-art.json', 'movement-art.json', 'culture-art.json', 'hiphopvinyl-art.json', 'tdot6-art.json', 'main-art-ear.json', 'loudness.json', 'labels.json', 'song-notes.json', 'bpm.json', 'artist-wiki.json'] + ['artists/%s.json' % c for c in ['index', 'num'] + list('abcdefghijklmnopqrstuvwxyz')]
REPO = 'https://github.com/billylegal/1upradio.git'
GIT = ['git', '-c', 'user.name=Billy Legal', '-c', 'user.email=billylegal@users.noreply.github.com']


def sh(cmd, cwd=None): return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=300)


def size(o): return len(o) if isinstance(o, (dict, list)) else 0


def main():
    w = tempfile.mkdtemp()
    try:
        r = w + '/r'
        if sh(['git', 'clone', '-q', '--depth', '1', REPO, r]).returncode: print('clone failed'); return 1
        changed = []
        for f in FILES:
            src = '%s/data/%s' % (H, f)
            if not os.path.exists(src): continue
            os.makedirs(os.path.dirname('%s/data/%s' % (r, f)), exist_ok=True)
            try: new = json.load(open(src))
            except Exception: print('skip (not valid JSON yet):', f); continue
            dst = '%s/data/%s' % (r, f)
            if os.path.exists(dst):
                try: old = json.load(open(dst))
                except Exception: old = None
                if old == new: continue
                if old is not None and size(new) < size(old): print('skip (would shrink %d -> %d): %s' % (size(old), size(new), f)); continue
            shutil.copy(src, dst); changed.append('%s (%d)' % (f, size(new)))
        if not changed: print(time.strftime('%F %T'), 'nothing new'); return 0
        sh(['git', 'add', '-A'], r)
        msg = 'Data update (automatic): ' + ', '.join(changed)
        c = sh(GIT + ['commit', '-q', '-m', msg[:300], '-m', 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'], r)
        if c.returncode: print('commit failed', c.stderr[:200]); return 1
        p = sh(['git', 'push', '-q', 'origin', 'HEAD:main'], r)
        if p.returncode:   # the cloud workflow pushed meanwhile: rebase once and retry
            sh(['git', 'pull', '-q', '--rebase', 'origin', 'main'], r); p = sh(['git', 'push', '-q', 'origin', 'HEAD:main'], r)
        print(time.strftime('%F %T'), 'published' if not p.returncode else 'PUSH FAILED ' + p.stderr[:200], '|', msg[:200]); return p.returncode
    finally: shutil.rmtree(w, ignore_errors=True)


if __name__ == '__main__': sys.exit(main())
