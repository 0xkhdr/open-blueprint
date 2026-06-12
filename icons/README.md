# Brand Assets

This directory contains all visual identity assets for **open-blueprint (`bp`)**.

| Directory | Purpose |
|-----------|---------|
| [`sources/`](sources/) | Original design files — the canonical PNG exports. Do not modify; re-export from source design tool. |
| [`brand/`](brand/) | Production-ready lockups and marks for documentation, presentations, and web. |
| [`app/`](app/) | Favicon assets at standard sizes (16×16, 32×32, 180×180). |
| [`social/`](social/) | Open Graph / Twitter card images for social sharing and link previews. |

---

## Visual Identity

### Mark

The isometric block "B" represents **scaffolding**, **structure**, and **blueprint** — the core metaphors of the tool. It should always be treated as a singular graphic unit. Do not crop, distort, or recolor the mark independently of its official variants.

| Variant | File | Best For |
|---------|------|----------|
| Lockup (dark) | `brand/brand-lockup-dark.png` | README headers, GitHub social preview, website hero (dark mode) |
| Lockup (light) | `brand/brand-lockup-light.png` | README headers, website hero (light mode) |
| Hero (dark, full tagline) | `brand/brand-hero-dark.png` | Landing pages, keynote slides, marketing |
| Wireframe mark (dark) | `brand/brand-mark-dark.png` | Dark-background contexts, subtle branding |
| Wireframe mark (light) | `brand/brand-mark-light.png` | Light-background contexts, subtle branding |

### Color

- **Dark Theme (Default)**:
  - Background: Pure Black — `#000000`
  - Accent/Type: Cyan — approximately `#00D0FF`
- **Light Theme**:
  - Background: White / Transparent — `#FFFFFF`
  - Accent/Type: Dark Cyan / Teal — approximately `#005B70` (recolored automatically via pipeline)


### Safe Space

Maintain at least **one unit** of the mark's height as clear space on all sides when placing near other elements.

---

## Adding or Regenerating Assets

All derivative assets are generated from `sources/` by a pipeline script.

```bash
# From the repo root
node scripts/generate-icons.mjs
```

This uses [sharp](https://sharp.pixelplumbing.com/) to produce:
- `brand/` exports (pass-through)
- `app/favicon-{16,32,180}.png` (resized)
- `social/og-image.png` (composited on 1200×630 canvas)

Do not manually edit generated files — they will be overwritten on the next pipeline run. Add source files to `sources/` and adjust `scripts/generate-icons.mjs` instead.

---

## License

These assets are © the open-blueprint project and licensed under the same terms as the project (MIT). When used in forks or third-party integrations, attribution via the lockup or mark is appreciated but not required.
