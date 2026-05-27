#!/usr/bin/env node
// Upload brand images (avatar, og-default) to Bunny as WebP
import sharp from "sharp";
import fs from "node:fs/promises";

const BUNNY_AK = "7822a8cd-158d-4e33-b1dba1b23752-8094-43c2";
const BUNNY_ZONE = "quiet-classroom";
const BUNNY_HOST = "ny.storage.bunnycdn.com";

async function putWebP(localPath, remotePath, opts) {
  const buf = await fs.readFile(localPath);
  const webp = await sharp(buf).resize(opts).webp({ quality: 86 }).toBuffer();
  const url = `https://${BUNNY_HOST}/${BUNNY_ZONE}/${remotePath}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { AccessKey: BUNNY_AK, "Content-Type": "image/webp" },
    body: webp,
  });
  if (!res.ok) throw new Error(`PUT ${remotePath} -> ${res.status}`);
  return webp.length;
}

const tasks = [
  {
    local: "/home/ubuntu/aquietclassroom/content/brand/oracle-lover-avatar.png",
    remote: "brand/oracle-lover-avatar.webp",
    opts: { width: 600, height: 600, fit: "cover" },
  },
  {
    local: "/home/ubuntu/aquietclassroom/content/brand/og-default-1200x630.png",
    remote: "brand/og-default-1200x630.webp",
    opts: { width: 1200, height: 630, fit: "cover" },
  },
];

for (const t of tasks) {
  const size = await putWebP(t.local, t.remote, t.opts);
  console.log(`OK  ${t.remote}  ${(size / 1024).toFixed(1)} KB`);
  console.log(`    -> https://quiet-classroom.b-cdn.net/${t.remote}`);
}
