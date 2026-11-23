---
name: BenchMaster
description: A focused basketball coaching workspace for preparing games, managing live rotations, and reviewing player usage.
colors:
  light-bg: "#F2F3F5"
  light-surface: "#FFFFFF"
  light-ink: "#202A35"
  light-muted: "#626E7A"
  light-border: "#D9DFE5"
  light-accent: "#31556D"
  light-accent-strong: "#426E89"
  light-court: "#9D572D"
  light-danger: "#A54642"
  dark-bg: "#111B17"
  dark-surface: "#1B2721"
  dark-ink: "#EDF2EE"
  dark-muted: "#A5B2AA"
  dark-border: "#34443A"
  dark-accent: "#82C49A"
  dark-accent-strong: "#A4D9B5"
  dark-court: "#E3A15B"
  dark-danger: "#F08B7F"
typography:
  display:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "1.9rem"
    fontWeight: 700
    lineHeight: 1.08
  body:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.light-accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 18px"
  button-primary-dark:
    backgroundColor: "{colors.dark-accent}"
    textColor: "#14251A"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 18px"
  surface:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: BenchMaster

## Status

**Selected direction:** Proposition A, a restrained premium coaching workspace. **Palette decision:** light uses Proposition B “Slate & Copper”; dark uses Proposition A “Club Forest”. This is the active implementation direction, replacing the earlier cool blue / night mint pair. Keep PRODUCT.md and the product workflows unchanged.

## Creative direction

BenchMaster is a practical coach’s workspace. The interface should feel authored, composed, and dependable under game-day pressure. Use product data, clear grouping, and precise type for basketball character; do not place a full-court or parquet illustration behind every task.

- Light mode: cool slate surfaces and slate-blue actions; copper is reserved for basketball context.
- Dark mode: deep forest surfaces and mint actions; warm amber is reserved for basketball context.
- Both modes use opaque surfaces, thin borders, restrained depth, and compact corner radii.
- The live match may use greater contrast and information density than roster and settings pages, while preserving touch targets.

## Color semantics

| Token | Light | Dark | Use |
|---|---|---|---|
| Background | `#F2F3F5` | `#111B17` | Main application canvas |
| Surface | `#FFFFFF` | `#1B2721` | Pages, panels, controls |
| Ink | `#202A35` | `#EDF2EE` | Primary text and icons |
| Muted | `#626E7A` | `#A5B2AA` | Secondary copy; maintain readable contrast |
| Border | `#D9DFE5` | `#34443A` | Dividers and control edges |
| Action | `#31556D` | `#82C49A` | Primary action and selected navigation |
| Action strong | `#426E89` | `#A4D9B5` | Focus and stronger emphasis |
| Basketball | `#9D572D` | `#E3A15B` | Court context, starter/bench data, basketball highlights |
| Danger | `#A54642` | `#F08B7F` | Destructive actions and errors |

Success, pause, live, disabled, and chart tokens are theme-specific semantic derivatives in `frontend/src/styles.scss`. They must pair color with labels, icons, or shape. Copper/amber is not a general action color. Check all text and focus combinations against WCAG AA in the rendered UI.

## Typography and layout

Use Avenir Next with the documented fallback stack. Titles are compact and direct. Body copy stays sentence case; tracked uppercase labels are limited to short metadata. Pages remain mobile-first, with at least 16px side insets, useful two-column layouts on wider screens, and the live route allowed more width. Maintain at least 44px touch targets and 48px primary actions. Keep the existing responsive navigation and guest/account behavior.

## Components

- **Actions:** solid theme action color, clear text label, 8px standard radius, 48px primary height. Secondary controls use a quiet opaque surface and border. Danger is semantic red.
- **Panels:** white/forest opaque surfaces, fine border, 8–12px corners. No default ambient shadow; reserve depth for true overlays.
- **Forms:** opaque inputs with explicit labels and visible focus. Keep disabled and error states legible.
- **Status:** live, paused, finished, success, and error states have both color and text/icon cues.
- **Player rows:** jersey number, name, role, playing-time data, and action stay scannable; long names wrap safely.
- **Live controls:** clock and period lead the hierarchy; starting five and bench are adjacent to substitutions. End-session actions remain visually distinct and safeguarded.
- **Navigation:** retain the current navigation model. Selected state uses the action color; icon controls retain accessible names and focus treatment.

## Motion, depth, and backgrounds

Use short transitions only where they clarify a state change. Respect reduced-motion preferences. Keep the global canvas flat and quiet. Avoid decorative blur, gradients, parquet grain, and court geometry across non-game pages. Use elevation only for menus, dialogs, and other actual overlays.

## Preserve

- BenchMaster name and supplied logo.
- French and English interfaces.
- Guest and signed-in modes and local theme preference (`benchmaster.theme`).
- Basketball terminology, game preparation, live substitution, time tracking, history, and summary behavior.
- Keyboard focus, screen-reader announcements, safe-area support, and responsive touch behavior.
