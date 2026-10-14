import fs from "node:fs";
import zlib from "node:zlib";
function crc32(buffer) {
  let c = 0xffffffff;
  for (const b of buffer) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type),
    len = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
fs.mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size,
        ny = y / size,
        dx = nx - 0.5,
        dy = ny - 0.5,
        r = Math.hypot(dx, dy);
      let color = [11, 13, 18];
      if (r < 0.34) color = [255, 46, 136];
      if (r < 0.26) color = [27, 18, 31];
      if (r < 0.23 && r > 0.222) color = [75, 34, 60];
      if (r < 0.17) color = [255, 46, 136];
      if (r < 0.027) color = [11, 13, 18];
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      raw.set([...color, 255], offset);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(`public/icons/icon-${size}.png`, png);
  if (size === 512) fs.writeFileSync("public/icons/maskable-512.png", png);
}
