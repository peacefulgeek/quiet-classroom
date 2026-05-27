// Bunny CDN — credentials burned in per scope §6 (safe to hardcode).
// Storage zone: quiet-classroom (US-East / NY)
// Pull zone:    https://quiet-classroom.b-cdn.net
// Updated 2026-05-06.

import sharp from "sharp";

export const BUNNY = {
  storageZone: "quiet-classroom",
  storageHost: "ny.storage.bunnycdn.com",
  storageKey: "7822a8cd-158d-4e33-b1dba1b23752-8094-43c2",
  pullZone: "https://quiet-classroom.b-cdn.net",
};

/**
 * Compress an image buffer to WebP and upload it to Bunny CDN under the given remote path.
 * Returns the public pull-zone URL.
 */
export async function uploadWebpToBunny(remotePath, buffer, { width = 1600, quality = 78 } = {}) {
  const webp = await sharp(buffer)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  return uploadRawToBunny(remotePath, webp, "image/webp");
}

export async function uploadRawToBunny(remotePath, buffer, contentType) {
  const cleanPath = remotePath.replace(/^\/+/, "");
  const url = `https://${BUNNY.storageHost}/${BUNNY.storageZone}/${cleanPath}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: BUNNY.storageKey,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bunny upload failed ${res.status} for ${cleanPath}: ${text.slice(0, 200)}`);
  }
  return `${BUNNY.pullZone}/${cleanPath}`;
}

export function bunnyUrl(remotePath) {
  return `${BUNNY.pullZone}/${remotePath.replace(/^\/+/, "")}`;
}

/**
 * Fetch raw bytes for a given path on the public Bunny pull zone.
 * Returns null on 404, throws on other non-2xx.
 */
export async function fetchFromBunny(remotePath, { timeoutMs = 10000 } = {}) {
  const url = bunnyUrl(remotePath);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Bunny pull ${res.status} for ${remotePath}`);
    return await res.arrayBuffer();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch and parse JSON from the public Bunny pull zone.
 * Returns null on 404.
 */
export async function fetchJsonFromBunny(remotePath, opts) {
  const buf = await fetchFromBunny(remotePath, opts);
  if (!buf) return null;
  const text = Buffer.from(buf).toString("utf8");
  return JSON.parse(text);
}

/**
 * Delete an object from Bunny storage. Returns true if deleted or already gone.
 */
export async function deleteFromBunny(remotePath) {
  const cleanPath = remotePath.replace(/^\/+/, "");
  const url = `https://${BUNNY.storageHost}/${BUNNY.storageZone}/${cleanPath}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { AccessKey: BUNNY.storageKey },
  });
  if (res.status === 404 || res.ok) return true;
  const text = await res.text().catch(() => "");
  throw new Error(`Bunny delete failed ${res.status} for ${cleanPath}: ${text.slice(0, 200)}`);
}

/**
 * Upload a JSON object to Bunny storage as application/json.
 * Returns the public pull URL.
 */
export async function uploadJsonToBunny(remotePath, obj) {
  const body = Buffer.from(JSON.stringify(obj, null, 2), "utf8");
  return uploadRawToBunny(remotePath, body, "application/json; charset=utf-8");
}
