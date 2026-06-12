#!/usr/bin/env node
/**
 * Icon Generation Pipeline
 *
 * Generates derivative assets from source PNGs in icons/sources/.
 * Run: node scripts/generate-icons.mjs
 *
 * Outputs:
 *   icons/brand/          — Lockups, hero images
 *   icons/app/            — Favicons at standard sizes
 *   icons/social/         — Open Graph / Twitter card images
 */
import sharp from 'sharp';
import { mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ---- paths -----------------------------------------------------------------
const SRC = join(ROOT, 'icons', 'sources');
const OUT = {
  brand:  join(ROOT, 'icons', 'brand'),
  app:    join(ROOT, 'icons', 'app'),
  social: join(ROOT, 'icons', 'social'),
};

// ---- verify source files exist ---------------------------------------------
const sources = {
  lockup: join(SRC, 'lockup-cyan.png'),
  hero:   join(SRC, 'b-cyan-edge-glow.png'),
  mark:   join(SRC, 'b-cyan-edges.png'),
  fav180: join(SRC, 'favicon-180.png'),
};

const PNG_OPTIONS = { compressionLevel: 9, palette: true };

async function ensureDirs() {
  for (const dir of Object.values(OUT)) {
    await mkdir(dir, { recursive: true });
  }
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function generateFavicons() {
  const input = sources.fav180;
  if (!(await fileExists(input))) {
    console.error('Missing source:', input);
    return;
  }

  const sizes = [32, 16];
  for (const size of sizes) {
    const outPath = join(OUT.app, `favicon-${size}x${size}.png`);
    await sharp(input)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png(PNG_OPTIONS)
      .toFile(outPath);
    console.log('Generated:', outPath);
  }

  // Also copy the 180x180 into the app folder with clean name
  const fav180 = await sharp(input).png(PNG_OPTIONS).toBuffer();
  await sharp(fav180).toFile(join(OUT.app, 'favicon-180x180.png'));
  console.log('Generated:', join(OUT.app, 'favicon-180x180.png'));
}

async function recolorPng(inputPath, outputPath, rgbColor) {
  const meta = await sharp(inputPath).metadata();
  await sharp({
    create: {
      width: meta.width,
      height: meta.height,
      channels: 4,
      background: { ...rgbColor, alpha: 1 }
    }
  })
    .composite([{ input: inputPath, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function generateBrand() {
  const lockupIn = sources.lockup;
  const heroIn   = sources.hero;
  const markIn   = sources.mark;

  if (await fileExists(lockupIn)) {
    await sharp(lockupIn).png(PNG_OPTIONS).toFile(join(OUT.brand, 'brand-lockup-dark.png'));
    console.log('Generated:', join(OUT.brand, 'brand-lockup-dark.png'));

    // Light-theme variant (Dark Cyan: #005B70)
    await recolorPng(lockupIn, join(OUT.brand, 'brand-lockup-light.png'), { r: 0, g: 91, b: 112 });
    console.log('Generated:', join(OUT.brand, 'brand-lockup-light.png'));
  }

  if (await fileExists(heroIn)) {
    await sharp(heroIn).png(PNG_OPTIONS).toFile(join(OUT.brand, 'brand-hero-dark.png'));
    console.log('Generated:', join(OUT.brand, 'brand-hero-dark.png'));
  }

  if (await fileExists(markIn)) {
    await sharp(markIn).png(PNG_OPTIONS).toFile(join(OUT.brand, 'brand-mark-dark.png'));
    console.log('Generated:', join(OUT.brand, 'brand-mark-dark.png'));

    // Light-theme variant (Dark Cyan: #005B70)
    await recolorPng(markIn, join(OUT.brand, 'brand-mark-light.png'), { r: 0, g: 91, b: 112 });
    console.log('Generated:', join(OUT.brand, 'brand-mark-light.png'));
  }
}

async function generateSocial() {
  const input = sources.lockup;
  if (!(await fileExists(input))) {
    console.error('Missing source for social:', input);
    return;
  }

  // 1200x630 is the OG standard. Lockup is wider, so pad with black background.
  const lockupMeta = await sharp(input).metadata();
  const targetW = 1200;
  const targetH = 630;

  // Resize lockup to fit within target, maintaining aspect ratio
  const resized = await sharp(input)
    .resize(targetW, targetH - 80, { fit: 'inside' })
    .toBuffer(); // inside fit keeps AR, may be smaller than target

  const resizedMeta = await sharp(resized).metadata();

  // Compose: center the resized lockup on a black canvas
  const ogImage = await sharp({
    create: {
      width: targetW,
      height: targetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      {
        input: resized,
        top: Math.floor((targetH - resizedMeta.height) / 2),
        left: Math.floor((targetW - resizedMeta.width) / 2),
      },
    ])
    .png(PNG_OPTIONS)
    .toBuffer();

  const outPath = join(OUT.social, 'og-image.png');
  await sharp(ogImage).toFile(outPath);
  console.log('Generated:', outPath);
}

// ---- main ------------------------------------------------------------------
async function main() {
  console.log('🔧  Icon generation pipeline starting...\n');
  await ensureDirs();

  // Verify all sources exist
  let missing = false;
  for (const [name, path] of Object.entries(sources)) {
    if (!(await fileExists(path))) {
      console.error('❌ Missing source file:', path, `(key: ${name})`);
      missing = true;
    }
  }
  if (missing) {
    console.error('\nEnsure all source PNGs are in icons/sources/ before running.');
    process.exit(1);
  }

  await generateBrand();
  await generateFavicons();
  await generateSocial();

  console.log('\n✅  All assets generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
