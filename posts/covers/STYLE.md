# Series cover style (locked 2026-10-30)

All agent-reliability covers share one style so the archive reads as a series:

- Wide 16:9-ish, flat vector illustration, warm paper background (#fafaf9)
- Burnt-orange (#ea580c) hero subject + dark navy (#0c1a2e-ish) technical linework
- Subtle grid, generous negative space, optimistic tone
- Absolutely no text in the image

Per-post prompt = base style + the post's central object. Example (Post-8):

> Wide 16:9 blog cover illustration, flat vector style, warm off-white paper
> background (#fafaf9). A tiny pixel-art LED-matrix creature (glowing
> amber-orange pixels on a small dark blue matrix board) hopping joyfully
> above a minimalist dark circuit board. Burnt-orange (#ea580c) accent
> shapes, subtle grid lines, generous negative space. Clean, technical,
> optimistic. Absolutely no text, no letters, no words.

Export: 1200px wide JPEG q82 into `posts/covers/<slug>.jpg`. Hero images
(board photos, diagrams) are separate `*-hero.*` files referenced by draft
frontmatter, never the cover.
