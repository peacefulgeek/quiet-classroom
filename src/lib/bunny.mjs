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
