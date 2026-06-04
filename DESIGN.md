# Design system — Gender Research

## Scene

Afternoon at home: warm daylight, laptop open to a long job post, careful note-taking. Interface reads like paper and ink, not software chrome.

## Theme

Light only (v1). Warm paper field, ink text, plum accent.

## Color (OKLCH, restrained)

| Token | Role |
|-------|------|
| paper | Page background, tinted warm |
| surface | Raised panels, not pure white |
| ink | Primary text |
| muted | Secondary text |
| accent | Primary actions (plum) |
| masc-bg / masc-text | Scholarly steel highlight |
| fem-bg / fem-text | Muted terracotta highlight |
| warn-bg / warn-text | Stale banner (soft amber) |
| line | Hairline borders |

## Typography

- Headings: Fraunces (serif), semibold
- UI + JD body: Source Sans 3
- Body prose max ~70ch; JD highlights use 15–16px relaxed leading
- Tabular nums for percentages

## Layout

- Max width ~42rem content column
- Rhythm: 6/8/10 spacing scale; avoid identical padding on every block
- Corpus: divided list inside one surface, not a grid of identical cards
- Entry: paste area as primary writing surface; metadata secondary

## Components

- Primary button: filled plum
- Secondary: outline plum
- Ghost: text only for tertiary
- Destructive: red text or confirm modal primary
- Panels: soft radius 12px, 1px line border, no heavy shadow stacks

## Motion

150–200ms ease-out on hover/focus only. No page-load choreography.

## Bans

No gradient text, no left accent stripes, no glassmorphism-by-default, no M/F abbreviations in UI.
