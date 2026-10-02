---
name: Syntactic Elevation
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#e79400'
  on-tertiary-container: '#563400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-hero:
    fontFamily: Geist
    fontSize: 3.5rem
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.035em
  display-hero-mobile:
    fontFamily: Geist
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: -0.025em
  headline-xl:
    fontFamily: Geist
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Geist
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: '1.75'
    letterSpacing: -0.011em
  body-md:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: -0.006em
  body-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  code-inline:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  code-block:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: '1.65'
    letterSpacing: '0'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.08em
  label-ui:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.005em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

The design system establishes a high-density, authoritative visual environment calibrated specifically for seasoned software engineers and technical leaders mastering agentic workflows and AI-assisted programming. The interface rejects consumer-grade software tropes, adopting a style rooted in technical minimalism, terminal-derived precision, and functional hierarchy.

The aesthetic fuses modern developer tooling (command surfaces, low-latency IDEs, telemetry dashboards) with distraction-free pedagogical reading spaces. High-contrast surfaces anchor the experience, while electric cyan, amber, and emerald provide razor-sharp status delineation without decorative clutter. The tactile impression is dense, fast, and immaculately engineered—evoking the quiet competence of an advanced compiler toolchain.

## Colors

The system uses an intrinsic dark-mode architecture built on rich slate-zinc tones. Surfaces do not rely on muddy neutral blacks; instead, cold slate undertones create optical depth and maximize code legibility.

- **Canvas & Underlay**: Deep charcoal obsidian (`#070b12`) for background root canvas and `#090d16` for ambient workspace shells.
- **Surface Elevation**: `#0f172a` for primary panels, lesson modules, and workspace cards; `#1e293b` for elevated dialogs, hovered line highlights, and popovers.
- **Primary (`#06b6d4` Cyan)**: Focus anchors, active tabs, inline telemetry readouts, interactive terminal cursors, and active execution traces.
- **Secondary (`#10b981` Emerald)**: Passing test assertions, compilation successes, module completions, and verified branch states.
- **Tertiary (`#f59e0b` Amber)**: Static warnings, interactive challenge milestones, active audio playback meters, and runtime alerts.
- **Structural Dividers**: Sub-pixel borders use `#334155` with 40% to 70% opacity to preserve rigid technical grid alignment without visual fatigue.

## Typography

The typographic hierarchy is structured for prolonged immersion, rapid scanning of documentation, and zero ambiguity in syntactical tokens.

- **Prose & Reading**: Long-form instructional content employs `body-lg` set with generous vertical leading (`1.75`) and constrained character width (68-75 characters per measure) to reduce visual fatigue during deep conceptual study.
- **Interface & Metrics**: `label-caps` uses all-caps JetBrains Mono for system telemetry, lesson timestamps, status metadata, and diff summaries.
- **Code Enclaves**: Inline code tokens maintain matching base vertical bounds with background pills; multi-line code windows lock strictly to proportional tabular figures with explicit line heights matching their gutter counters.

## Layout & Spacing

The layout model implements a flexible, high-density 12-column engineering grid paired with a strict 4px atomic coordinate system.

- **Desktop (1280px+)**: Dual-pane and triple-pane layouts. Navigation occupies a fixed 64px rail or 240px collapsible tree; lesson content takes an 8-column reading column (max 768px width) flanked by a 4-column contextual telemetry rail (code sandbox, terminal output, or outline graph).
- **Tablet (768px - 1279px)**: Reflows contextual tools into persistent bottom drawers or segmented toggle panels, reducing grid gutters to `1rem` and retaining full horizontal canvas utility.
- **Mobile (< 768px)**: 4-column fluid layout with `gutter-mobile` (`0.75rem`) and `margin-mobile` (`1rem`). Code viewer panels decouple into horizontally scrollable full-bleed blocks with pinned line-number gutters.

## Elevation & Depth

Visual hierarchy is maintained through calibrated surface luminance and sub-pixel edge definition rather than heavy drop shadows.

- **Surface Tiers**:
  - `Base 0`: Viewport canvas (`#070b12`).
  - `Surface 1`: Content panels, lesson readouts, and sidebars (`#090d16` with a `1px` border of `#1e293b`).
  - `Surface 2`: Active code windows, interactive quizzes, and floating cards (`#0f172a` with a `1px` border of `#334155/60`).
  - `Surface 3`: Popovers, autocomplete overlays, and command palettes (`#1e293b` with a border of `#06b6d4/40`).
- **Edge Highlighting**: Elevated components utilize an inset directional highlight (`box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05)`) paired with an external ambient occlusion (`box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.5)`).
- **Focus Glows**: Active and keyboard-focused primitives cast a tight, technical glow using the primary accent (`0 0 0 1px #06b6d4, 0 0 12px -2px rgba(6, 182, 212, 0.35)`).

## Shapes

The design system enforces a disciplined, low-radius geometric grammar (`roundedness: 1`). Soft curves (4px base, 8px on large viewports) reflect high-end hardware terminals and production IDE components.

- Standard buttons, badges, chips, text inputs, and code line markers: `0.25rem` (4px).
- Lesson containers, execution output cards, and split views: `0.5rem` (8px).
- Floating modal sheets and system-wide command palette dialogs: `0.75rem` (12px).
- Completely round geometries (`9999px`) are restricted exclusively to circular progress rings, status dot pulses, and media avatar heads.

## Components

### Buttons
- **Primary**: Background `#06b6d4`, foreground `#04151b`, font `label-ui` weight 600. Flat hover transition to `#22d3ee` with no vertical drift.
- **Secondary / Surface**: Background `#0f172a`, border `1px solid #334155`, foreground `#e2e8f0`. Hover shifts background to `#1e293b` and border to `#475569`.
- **Ghost / Tool**: Borderless, foreground `#94a3b8`, hover foreground `#f8fafc` and background `rgba(255, 255, 255, 0.04)`.
- **Command Density**: Compact sizing with vertical padding of `0.375rem` and horizontal padding of `0.75rem`.

### Chips & Badges
- **Status Badges**: Monospace `label-caps` typography, 2px vertical by 6px horizontal padding. Border `1px solid` matching tone.
  - *Completed*: Background `rgba(16, 185, 129, 0.1)`, text `#10b981`, border `rgba(16, 185, 129, 0.2)`.
  - *Experimental / Warning*: Background `rgba(245, 158, 11, 0.1)`, text `#f59e0b`, border `rgba(245, 158, 11, 0.2)`.
  - *AI Token / Architecture*: Background `rgba(6, 182, 212, 0.1)`, text `#06b6d4`, border `rgba(6, 182, 212, 0.2)`.

### Lists & Navigation Trees
- Hierarchical file-tree formatting with strict vertical guide lines (`1px solid #1e293b`).
- Left-edge active indicator: 2px bar in `#06b6d4` inset against the current active lesson node.
- Hover states span 100% item row width with `#0f172a` fill.

### Checkboxes & Radio Controls
- Square 14x14px bounds with 2px corner radius for checkboxes; circular 14x14px for radios.
- Unchecked: `1.5px solid #475569`, background `#090d16`.
- Checked: Fill `#06b6d4`, icon / dot glyph rendered in pure canvas `#070b12`.

### Input Fields & Command Palettes
- Surface `#090d16`, border `1px solid #334155`, text `#f8fafc`.
- Monospace prefix adornments (e.g., `>` or `$`) rendered in `#64748b`.
- Interactive focus states illuminate the full border in `#06b6d4` without fuzzy outer rings.

### Code Display & Syntax Panels
- Header chrome: Surface `#0f172a` housing tab titles, runtime indicators, and copy action buttons.
- Content body: `#070b12` background, persistent line numbers styled in `#475569`, selection highlight `rgba(6, 182, 212, 0.15)`.

### Inline TTS Player
- Embedded audio bar anchored under primary titles or floating persistently at the viewport bottom.
- Visual scrub track: 2px thick slider defaulting to `#1e293b`, filled dynamically with `#06b6d4` progress.
- Speed chips: `1x`, `1.25x`, `1.5x`, `2x` displayed in monospace `label-caps` for rapid toggling.

### Progress Meters
- Minimalist 2px to 4px horizontal tracks. Background `#1e293b`, indicator `#10b981`.
- Step gauges split into discrete segments corresponding to lesson milestones.