/**
 * Converts NASA/GSFC SVS "Deep Star Maps 2020" EXR files to web JPGs.
 * Source: https://svs.gsfc.nasa.gov/4851 (public domain; credit NASA/Goddard SVS).
 *
 *   node --max-old-space-size=8192 scripts/build-sky.mjs <input.exr> <outName> [scale ...]
 *
 * Example:
 *   node scripts/build-sky.mjs starmap_2020_8k.exr milkyway 1 2   → milkyway_8k.jpg, milkyway_4k.jpg
 *
 * The EXR decodes bottom-row-first; output JPGs are flipped so north is up.
 * Maps are equatorial plate carrée with RA 0h at the centre increasing leftward.
 */
import fs from "node:fs";
import path from "node:path";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { FloatType } from "three";
import jpeg from "jpeg-js";

const [, , input, outName, ...scaleArgs] = process.argv;
if (!input || !outName) {
  console.error("usage: build-sky.mjs <input.exr> <outName> [scale ...]");
  process.exit(1);
}
const scales = scaleArgs.length ? scaleArgs.map(Number) : [1];
const OUT_DIR = path.resolve("apps/web/public/textures");

const buf = fs.readFileSync(input);
const exr = new EXRLoader()
  .setDataType(FloatType)
  .parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const { width: W, height: H, data } = exr;

// Exposure from a high luminance percentile so bright stars sit just below white.
const lums = [];
for (let i = 0; i < W * H; i += 97) {
  lums.push(0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]);
}
lums.sort((a, b) => a - b);
const exposure = 0.92 / lums[Math.floor(0.9995 * (lums.length - 1))];

const encode = (x) => {
  const v = Math.max(0, x * exposure);
  const tm = v / (1 + v * 0.35);
  const s = tm <= 0.0031308 ? 12.92 * tm : 1.055 * Math.pow(tm, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const scale of scales) {
  const w = W / scale;
  const h = H / scale;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = h - 1 - y;
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const i = ((sy * scale + dy) * W + (x * scale + dx)) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
      const n = scale * scale;
      const o = (y * w + x) * 4;
      out[o] = encode(r / n);
      out[o + 1] = encode(g / n);
      out[o + 2] = encode(b / n);
      out[o + 3] = 255;
    }
  }
  const name = `${outName}_${Math.round(w / 1024)}k.jpg`;
  const jpg = jpeg.encode({ data: out, width: w, height: h }, 88);
  fs.writeFileSync(path.join(OUT_DIR, name), jpg.data);
  console.log("wrote", name, w, "x", h, (jpg.data.length / 1e6).toFixed(2), "MB");
}
