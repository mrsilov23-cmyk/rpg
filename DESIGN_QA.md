# Design v3 — implemented dark fantasy UI

## Deliverables
- `design-v3.css`: opt-in, every selector scoped to `body.design-v3`; screen variables live on `#loginScreen` / `#gameScreen`, not `:root`.
- `design-v3-patch.py`: source → new output file. Adds body opt-in, panel classes, scoped CSS, and exact static copy swaps. Refuses in-place output and already patched input. Asserts that all original script blocks and DOM IDs remain unchanged.
- `backpack_design_v3_preview.html`: standalone offline preview with main's 10 painted WebP chains embedded as data URIs. No new CDN.
- `design-v3-preview-build.py`: rebuilds the preview, embeds art, and refreshes QA fixtures. Preview-only artwork script is also saved as `design-v3-image-preview.js`.
- `design-v3-capture.sh`: direct bundled capture-helper commands for desktop1440 / mobile390.
- `design-v3-tests.js`, `design-v3-test-results.json`: automated local interaction/geometry tests.
- `design-v3-contrast.json`: foreground/background contrast ratios.

## Integration
```bash
python /data/design-v3-patch.py INPUT_NETWORK.html OUTPUT_DESIGNED.html
```
The patch deliberately leaves network copy unchanged except exact static source strings such as the old proposal headline. Network-specific markup IDs/handlers/scripts remain byte-identical. Body gains `design-v3`; static inventory/store/room containers gain `backpack-panel`, `shop-panel`, `room-panel` when the source headings match. If main already renamed these headings, add the three panel classes explicitly to the corresponding containers. Main owns the live artwork override; do not use the QA fixture scripts in production.

For manual CSS integration: add `design-v3` to body, the three panel classes, then embed `design-v3.css` after existing CSS. Keep real room state classes, `disabled`, `hidden`, and all handlers. No rule enables disabled controls, hides error states, or invents participant/ready/connection data. `[hidden]` is explicitly preserved.

## Visual direction
Obsidian/charcoal surfaces, aged-brass action buttons, parchment section names, cool mist backdrop. Two type families: system sans + Georgia for game/shop headings. Neon bloom and animated item rarity glow removed. Rarity remains a thin semantic border plus explicit T1–T5 and existing rarity text. Art is NOT recolored. Item/shop/detail images use `object-fit:contain`, 5px padding and tile background `#11151b`; no image overlay. Store images are 64×72px. Room is a restrained side panel; narrow/tablet layouts stack without hiding required controls.

## Safety / geometry
Original/main/network files were never edited. Firebase was never contacted. Battle renderer, scene markup, simulation/hooks and original scripts are unchanged. No battle/overlay selectors or global root variables were added.

CELL/GAP/PAD are untouched because hit testing uses hardcoded pixel geometry: desktop cells62, mobile cells47, gap5, padding12. Bag is 423px desktop / 333px mobile, 30 cells, with a 467px desktop panel so its coordinate surface no longer spills out. Do NOT scale the bag with transform or change CSS cell dimensions without updating every placement/hit-test path. The bag is visually prioritized by contrast and panel allocation, not unsafe scale hacks.

## Verified QA
Actual Chromium captures at 1440px and 390px, using the required bundled capture helper; each PNG was opened and visually inspected individually:
- login desktop / mobile: clear name field, character selection, no clipped headings/cards;
- game desktop / mobile: bag contained, shop cards readable, honest disconnected room controls retained;
- selected item desktop / mobile: focus/selection boundary clear, 44px+ actions, characteristics and merge hint readable;
- expanded help mobile with reduced motion: instructions wrap cleanly;
- all five rarity tiers desktop: distinct borders + readable tier markers without hue shifts or glow.

Initial mobile action button clipping was found and fixed: action buttons now wrap at min140px rather than squeezing three into one row. Final captures show zero clipped-overflow or overlay-intersection diagnostics and no horizontal document overflow. Vertical scrolling is intentional on mobile/full-page game screens.

Local functional tests PASS at390/800/1024/1440: touch-style move, buy, merge, sell, expand help, keyboard Enter selection, Escape reset. Every measured button/cell meets44×44 minimum; zero page exceptions or external network requests. Text contrast pairs measured7.15–16.67:1 for main labels/actions; shop rarity text6.68–8.97:1. No claims of live Firebase/network validation: main must still test its real connecting/error/ready states after merging.

## Artwork caveat
Main provided one painting per chain, reused across that chain's tiers exactly as requested. This means a wooden/iron/legendary sword shares a base painting; tier is communicated by T-level/name/border. Original character portraits retained. All painted items in preview come from `/data/assets/items/*.webp`.
