---
name: BenchMaster
description: A focused basketball coaching workspace for preparing games, managing live rotations, and reviewing player usage.
colors:
  light-bg: "#edf3f8"
  light-surface: "#ffffff"
  light-ink: "#14283b"
  light-muted: "#4f6476"
  light-border: "#d6e0e8"
  light-accent: "#1d4ed8"
  light-accent-strong: "#1e40af"
  light-court: "#b45309"
  light-danger: "#b42318"
  dark-bg: "#101c20"
  dark-surface: "#18282c"
  dark-ink: "#f4f7f5"
  dark-muted: "#c0d0cc"
  dark-accent: "#4ed0a5"
  dark-accent-strong: "#72e0ba"
  dark-court: "#f5a65b"
  dark-danger: "#ff7b72"
typography:
  display:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "1.9rem"
    fontWeight: 700
    lineHeight: 1.05
  body:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "12px"
  md: "16px"
  lg: "18px"
  xl: "22px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.light-accent}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    height: "48px"
    padding: "0 18px"
  button-primary-dark:
    backgroundColor: "{colors.dark-accent}"
    textColor: "#10251f"
    rounded: "{rounded.lg}"
    height: "48px"
    padding: "0 18px"
  player-card:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "18px"
    padding: "16px"
---

# Design System: BenchMaster

## Overview

**Creative North Star: "The Coach’s Clipboard"**

**Visual voice:** Cool Court-Side. **Component feel:** Tactile and Fast.

BenchMaster’s visual language pairs the clarity of a coach’s working board with a subtle basketball-court setting. A restrained court-line and wood-grain backdrop gives the app its sport context; foreground surfaces remain calm and high contrast so a coach can read a clock, find a player, and act quickly during a game. The interface favors practical grouping, explicit status, and direct touch controls over decorative display.

The system supports a cool court-side palette: a cool blue light theme and a deep green-blue dark theme. Court-orange accents mark basketball-specific context and starter/bench distinctions; the primary action color changes to mint in dark mode. Use the supplied BenchMaster logo as the brand mark and preserve French and English interface support.

**Key Characteristics:**
- A quiet court-side atmosphere behind operational surfaces.
- Large, direct controls suited to one-handed touch use.
- Player identity, live status, and game data are grouped into compact cards.
- Light and dark themes each use their own semantic accent palette.

## Colors

The light theme uses cool slate-blue surfaces with a clear blue action accent and hardwood orange for court context; the dark theme shifts to deep green-blue surfaces and mint actions while retaining a warm court accent.

### Primary
- **Court Blue** (`{colors.light-accent}`): Main light-theme actions, selected controls, and active navigation.
- **Deep Court Blue** (`{colors.light-accent-strong}`): Stronger light-theme emphasis, labels, and focus outlines.
- **Night Mint** (`{colors.dark-accent}`): Main dark-theme action and selected-state color.
- **Bright Mint** (`{colors.dark-accent-strong}`): Stronger dark-theme emphasis and focus treatment.

### Secondary
- **Hardwood Amber** (`{colors.light-court}`): Basketball context, warm panels, and starter-related data in the light theme.
- **Night Hardwood** (`{colors.dark-court}`): Court and starter-data accent in the dark theme.

### Neutral
- **Cool Mist** (`{colors.light-bg}`): Light page background.
- **White Surface** (`{colors.light-surface}`): Light cards and controls.
- **Deep Slate Ink** (`{colors.light-ink}`): Primary light-theme text and icons.
- **Blue Gray** (`{colors.light-muted}`): Secondary text and metadata in the light theme.
- **Mist Border** (`{colors.light-border}`): Light-theme control and card outlines.
- **Deep Teal Night** (`{colors.dark-bg}`): Dark page background.
- **Deep Teal Surface** (`{colors.dark-surface}`): Dark cards and controls.
- **Soft Chalk** (`{colors.dark-ink}`): Primary dark-theme text and icons.
- **Cool Sage Gray** (`{colors.dark-muted}`): Secondary dark-theme text.

### Named Rules
**The Theme-Paired Accent Rule.** Use the blue action palette in light mode and the mint action palette in dark mode; keep court amber reserved for basketball context and game data.

## Typography

**Display Font:** Avenir Next (with Segoe UI, sans-serif fallbacks)

**Body Font:** Avenir Next (with Segoe UI, sans-serif fallbacks)

**Label/Mono Font:** No separate mono family is defined.

**Character:** A clean, compact sans-serif hierarchy keeps player names, clocks, stats, and action labels quickly scannable. Strong weights and uppercase tracking distinguish short labels from explanatory copy.

### Hierarchy
- **Display** (700, 1.9rem, 1.05 line-height): Page titles; compact and direct rather than editorial.
- **Headline** (700, 1.1rem): Section headings.
- **Title** (700, 1rem, 1.2 line-height): Card titles and key control labels.
- **Body** (400, 1rem, 1.5 line-height): Main interface copy and player names.
- **Label** (800, 0.75rem, 0.04em letter spacing, uppercase): Status chips, stat labels, and compact metadata.

### Named Rules
**The Scan-First Type Rule.** Reserve uppercase, tracked type for short labels and statuses; keep instructions and longer copy in sentence case with comfortable line height.

## Layout

The app is mobile-first. Pages stack vertically with a 16px base side inset and 16px section gaps. At 768px and above, the main page content is centered and capped at 920px, with wider page insets, two-column grids where useful, and controls allowed to return to a row. Live-game screens may use a wider shell than standard pages. Keep primary controls at least 44px tall; primary calls to action are 48px tall. On narrow screens, card layouts, action groups, tables, and modal actions reflow to preserve readable labels and touch targets. At very narrow widths, player-stat grids reduce columns rather than forcing clipped content.

## Elevation & Depth

Depth is hybrid: translucent court texture and tonal surface gradients establish atmosphere, while fine borders keep cards legible. Cards use a soft ambient shadow (`0 18px 40px rgba(20, 40, 59, 0.14)` in light mode; `0 18px 40px rgba(0, 0, 0, 0.32)` in dark mode). Dialogs use a stronger shadow and a dimmed, blurred backdrop. Keep texture behind content and low contrast; the game itself should remain the visual priority.

## Shapes

Controls and cards use generously rounded corners, from 12px compact controls to 18–22px cards and panels. Chips and progress bars are fully pill-shaped. Borders are thin and tonal; selected player cards add an accent border and restrained inset highlight. Dialogs have rounded panels, with a sheet-like lower edge on mobile.

## Components

### Buttons
Controls should feel tactile and fast, with clear feedback and direct labels.
- **Shape:** Softly rounded, with an 18px radius for standard actions.
- **Primary:** 48px minimum height, 18px horizontal padding, bold white text over the theme’s primary accent gradient; dark mode pairs mint with dark text.
- **Hover / Focus:** Brief 180ms transitions and a slight 1px lift on hover; focus-visible uses a clear 2–3px accent outline depending on context.
- **Secondary / Ghost / Tertiary:** Secondary actions use a muted ink wash and border; ghost actions use a strong surface fill and border. Danger actions use a soft danger tint with danger text.
- **Icon actions:** Keep at least 44px square, with a compact rounded shape and a visible text label where space permits.

### Chips
- **Style:** Small uppercase labels in pill-shaped or softly rounded forms, with muted surface and border at rest.
- **State:** Selected chips use the theme accent; live, paused, finished, success, and danger states use distinct semantic colors and soft backgrounds.

### Cards / Containers
- **Corner Style:** 18px on mobile cards; commonly 20–22px on larger panels.
- **Background:** White or translucent light surfaces in light mode; deep teal surfaces in dark mode. Warm court panels distinguish basketball context.
- **Shadow Strategy:** Soft ambient shadow plus a fine border; stronger elevation is reserved for dialogs.
- **Internal Padding:** 16px on mobile and at least 18px on wider layouts, with 12–18px internal gaps.

### Inputs / Fields
- **Style:** 48px minimum height, 14px horizontal padding, 16px radius, tonal control background, and a thin theme border.
- **Focus:** Use a visible accent outline or border change; retain a clear boundary against both themes.
- **Error / Disabled:** Use semantic danger colors for errors. Disabled controls remain legible with explicit muted background, border, and text colors.

### Navigation
- **Style:** Use the logo as the home/brand anchor. The app shell supplies responsive navigation and theme/language/account controls; active navigation uses the theme accent. Keep touch targets at least 44px and use an obvious active state.

### Player Card
The signature data card centers a player’s identity and jersey number, then groups selection state, playing-time metadata, quick stats, and rotation actions. Use the 56px jersey marker, compact labels, and a responsive stat grid. Selected and active variants should remain distinguishable through both border and surface changes. Preserve enough room for long player names and localized labels.

### Live Game Controls
Group match and period clocks with status chips and their relevant start, pause, resume, period, and end actions. Clock values should be visually prominent; each action should retain a generous touch target and a clear accessible name. Danger styling belongs to ending or destructive actions.

## Do's and Don'ts

### Do:
- **Do** preserve both the light blue and dark mint theme palettes.
- **Do** reserve warm court colors for basketball context, starter/bench data, and related highlights.
- **Do** keep touch controls at least 44px tall and primary calls to action 48px tall.
- **Do** use the provided logo asset and keep the French and English interface supported.
- **Do** retain the low-contrast court setting behind high-contrast operational surfaces.
- **Do** allow player names, labels, and action text to wrap on small screens.

### Don't:
- **Don't** use the court texture or grain as a high-contrast foreground pattern.
- **Don't** mix the light-theme blue action color into dark-theme primary controls; use the dark-theme mint tokens.
- **Don't** use court amber as the default action color.
- **Don't** shrink live-game or player controls below their established touch-target sizing.
- **Don't** make live status, errors, selection, or disabled states depend on color alone; pair color with labels, borders, or shape.
