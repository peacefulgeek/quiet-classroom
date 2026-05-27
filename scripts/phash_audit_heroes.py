#!/usr/bin/env python3
"""
Perceptual-hash audit of all 500 hero WebPs on Bunny CDN.
Downloads each hero, computes a 64-bit pHash, and reports clusters of
images within a Hamming distance of 8 (visually identical).
"""
import json
import os
import sys
import urllib.request
import urllib.error
import io
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict
from PIL import Image
import imagehash

INDEX_PATH = "/tmp/origin_idx.json"
OUT_DIR = "/tmp/heroes_dl"
HASH_FILE = "/tmp/hero_phashes.json"
DUPES_FILE = "/tmp/hero_duplicates.json"
MAX_WORKERS = 16
HAMMING_THRESHOLD = 8  # pHash threshold: 0 = identical, ≤8 = perceptually similar

os.makedirs(OUT_DIR, exist_ok=True)

with open(INDEX_PATH) as f:
    idx = json.load(f)
arts = idx if isinstance(idx, list) else idx.get("articles", [])
print(f"index articles: {len(arts)}")

# Build url list
items = []
for a in arts:
    slug = a.get("slug")
    url = a.get("heroUrl")
    if slug and url:
        # strip cache-bust query if any
        url = url.split("?")[0]
        items.append((slug, url))
print(f"with heroUrl: {len(items)}")

# Reuse cached hashes if available
existing = {}
if os.path.exists(HASH_FILE):
    try:
        existing = json.load(open(HASH_FILE))
        print(f"reused cached hashes: {len(existing)}")
    except Exception:
        existing = {}

def fetch_and_hash(item):
    slug, url = item
    if slug in existing:
        return slug, existing[slug], None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "phash-audit/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        h = str(imagehash.phash(img, hash_size=8))
        return slug, h, None
    except Exception as e:
        return slug, None, str(e)[:200]

hashes = dict(existing)
errors = []
done = 0

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
    futures = [pool.submit(fetch_and_hash, it) for it in items if it[0] not in existing]
    for f in as_completed(futures):
        slug, h, err = f.result()
        done += 1
        if h:
            hashes[slug] = h
        else:
            errors.append({"slug": slug, "err": err})
        if done % 50 == 0:
            print(f"  hashed {done}/{len(futures)}")
            json.dump(hashes, open(HASH_FILE, "w"))

json.dump(hashes, open(HASH_FILE, "w"))
print(f"hashed total: {len(hashes)}, errors: {len(errors)}")
if errors:
    print("first errors:", errors[:3])

# Cluster: any pair within HAMMING_THRESHOLD goes into same group via union-find
parents = {s: s for s in hashes}
def find(x):
    while parents[x] != x:
        parents[x] = parents[parents[x]]
        x = parents[x]
    return x
def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb:
        parents[ra] = rb

slugs = list(hashes.keys())
hex_to_int = {s: int(hashes[s], 16) for s in slugs}

def hamming(a, b):
    return bin(a ^ b).count("1")

# Bucket by first 4 hex chars to prune the O(N²) compare
buckets = defaultdict(list)
for s in slugs:
    buckets[hashes[s][:4]].append(s)

# Brute-force across full list (500x500 = 250k comparisons; fast)
n = len(slugs)
print(f"comparing {n}x{n} pairs")
for i in range(n):
    a = slugs[i]; ha = hex_to_int[a]
    for j in range(i+1, n):
        b = slugs[j]; hb = hex_to_int[b]
        if hamming(ha, hb) <= HAMMING_THRESHOLD:
            union(a, b)

groups = defaultdict(list)
for s in slugs:
    groups[find(s)].append(s)

dupe_clusters = [g for g in groups.values() if len(g) > 1]
print(f"clusters with ≥2 similar heroes: {len(dupe_clusters)}")
total_dupes = sum(len(g) for g in dupe_clusters)
print(f"slugs in any duplicate cluster: {total_dupes}")

# Sort clusters by size desc
dupe_clusters.sort(key=lambda g: -len(g))
for i, g in enumerate(dupe_clusters[:10]):
    print(f"\nCluster #{i+1} (size {len(g)}):")
    for s in g[:5]:
        print(f"  {s}  ph={hashes[s]}")

json.dump({
    "threshold": HAMMING_THRESHOLD,
    "total_hashed": len(hashes),
    "errors": errors,
    "duplicate_clusters": dupe_clusters,
    "unique_count": len(slugs) - total_dupes + len(dupe_clusters),
}, open(DUPES_FILE, "w"), indent=2)
print(f"\nwritten {DUPES_FILE}")
print(f"effective unique heroes: {len(slugs) - total_dupes + len(dupe_clusters)} / {len(slugs)}")
