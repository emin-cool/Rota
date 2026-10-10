---
name: Bosphorus Kinetic
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#3e4945'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#6e7a75'
  outline-variant: '#bdc9c4'
  surface-tint: '#006b57'
  primary: '#00614f'
  on-primary: '#ffffff'
  primary-container: '#0e7c66'
  on-primary-container: '#bcffe9'
  inverse-primary: '#7bd7bd'
  secondary: '#ab3500'
  on-secondary: '#ffffff'
  secondary-container: '#fe6a34'
  on-secondary-container: '#5d1900'
  tertiary: '#00614f'
  on-tertiary: '#ffffff'
  tertiary-container: '#007c65'
  on-tertiary-container: '#b9ffe8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#97f4d9'
  primary-fixed-dim: '#7bd7bd'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#005141'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59d'
  on-secondary-fixed: '#390c00'
  on-secondary-fixed-variant: '#832600'
  tertiary-fixed: '#85f7d7'
  tertiary-fixed-dim: '#68dabc'
  on-tertiary-fixed: '#002019'
  on-tertiary-fixed-variant: '#005141'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  metric-numeral:
    fontFamily: Plus Jakarta Sans
    fontSize: 34px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.025em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-md-medium:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0em
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system is crafted for an urban outdoors ethos tailored to Istanbul’s geographic drama—bridging historic shorelines, hilly cobblestones, and modern transit corridors. It blends functional sports-tracking ergonomics with the understated elegance of modern iOS human interface aesthetics.

### Visual Persona
- **Energetic & Motivating:** Clean spatial layouts paired with vibrant chromatic accents convey continuous forward momentum without visual noise.
- **Topographic & Fresh:** An earthy, maritime palette captures the chill of the Bosphorus strait alongside the warm evening glow over historical ridges.
- **Tactile iOS Modernism:** Light translucent blurs, soft layered cards, and liquid pill controls that conform naturally to one-handed thumb interaction during motion.

### Core Philosophy
Every interface layer honors the map canvas as the primary viewport. Chrome, controls, and social metrics float as deliberate overlay cards and bottom sheets, allowing users to remain visually grounded within their physical environment.

## Colors

The system uses an ambient, maritime-inspired foundation punctuated by athletic energy accents.

### Palette Roles
- **Primary (`#0E7C66` - Bosphorus Teal):** The brand anchor. Applied to primary navigational anchors, active route paths, completed progress rings, and key confirmations.
  - Deep Shade (`#0A5E4E`): Pressed states, high-contrast badges on light fills.
  - Mid Tint (`#149B80`): Elevation charts, secondary activity toggles, pacing indicators.
  - Soft Surface (`#E6F4F1`): Active chip fills, selected segment backgrounds, subtle map route buffers.
- **Secondary / Accent (`#FF6B35` - Sunset Orange):** Kinetic spark for dynamic callouts, recording triggers, personal best markers, live location pulses, and sprint intervals.
  - Deep Accent (`#E0531F`): Pressed state for active workout triggers.
  - Soft Accent (`#FFF0EB`): Mile/kilometer split highlights, workout notifications.
- **Surfaces & Canvas:**
  - Background Canvas: `#F7F8F6` (warm off-white stone ensuring map contrast without harsh pure white glare).
  - Primary Surface: `#FFFFFF` (elevated sheets, floating panels, pill chips).
  - Subtle Dividing Border: `#E5E7EB` (neutral hairline dividers).
- **Typography & Content Hierarchy:**
  - Primary Content: `#111827` (headings, primary metrics, map search inputs).
  - Secondary Content: `#4B5563` (subtitles, secondary metrics, user bios).
  - Muted / Inactive: `#9CA3AF` (empty states, disabled icons, trailing units such as "km/s").

## Typography

The typography leverages **Plus Jakarta Sans** across all breakpoints. Its geometric precision and wide aperture provide superior legibility when glancing at activity tracking screens while jogging or cycling.

### Typographic Guidelines
- **Metric Presentation:** Telemetry (tempo, mesafe, süre, yükseklik) relies on `metric-numeral` set with tabular numerals (`tnum`) to avoid layout jitter during live session updates.
- **Language Localization:** Designed with Turkish diacritics (`ç, ğ, ı, İ, ö, ş, ü`) in focus. Avoid automatic uppercase conversions that destroy the Turkish dotted capital "İ" or dotless lowercase "ı".
- **Weight Pairing:** High contrast hierarchy pairings—combine `headline-sm` (600) with `body-md` (400) for route cards, keeping screen scan times under 1.5 seconds.

## Layout & Spacing

A strict **8pt (0.5rem) spatial grid system** guides visual rhythm, augmented by safe-area considerations for mobile iOS hardware.

### Viewport & Safe Margins
- **Horizontal Screen Padding:** Standard screen edge margin is `1rem` (16pt), expanding to `1.25rem` (20pt) on larger device viewports (Max/Plus devices).
- **Vertical Insets:** Adhere to iOS dynamic island, notch, and bottom home indicator constraints with a minimum thumb-safe bottom inset of `2rem` (32pt) above the gesture bar.

### Layout Principles
- **Map-Canvas Overlay:** Overlays float at fixed insets (16pt from side edges), maximizing visible topographic map area beneath.
- **Bottom Sheet Snapping:** Contextual cards (elevation profiles, route detail overviews) utilize three-tier sheet anchors: collapsed (110pt peek), half-sheet (50% screen height), and full-sheet (90% view).

## Elevation & Depth

Visual depth is achieved through ambient, diffused light-scattering rather than heavy directional drop shadows, maintaining an airy and modern iOS feel.

### Depth Hierarchy
- **Level 0 (Base Canvas):** Map tile layer and foundational `#F7F8F6` background.
- **Level 1 (Docked & Tiled Cards):** Route list cards and stats panels resting on canvas.
  - Border: 1px solid `#E5E7EB`.
  - Shadow: None or hairline blur (`0 1px 3px rgba(0, 0, 0, 0.04)`).
- **Level 2 (Floating Floating Action Elements & Map Controls):** Floating compass, layer switches, tracking controls, and detached category pills.
  - Shadow: `0 4px 20px -2px rgba(0, 0, 0, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.03)`.
  - Backdrop Filter: `blur(20px)` at 88% surface opacity (`rgba(255, 255, 255, 0.88)`).
- **Level 3 (Interactive Modals & Drawer Sheets):** Live route recording panel and user profile sheets.
  - Shadow: `0 -8px 32px 0 rgba(14, 124, 102, 0.08), 0 4px 24px rgba(0, 0, 0, 0.08)`.

## Shapes

The interface balances generous radii on container surfaces with high-curvature pill shapes for action elements.

### Curvature Taxonomy
- **Containers & Sheet Cards (`rounded-2xl` / 16px):** All summary panels, itinerary previews, waypoint summaries, and elevation charts feature a 16px corner radius using continuous iOS squircle curvature.
- **Action Buttons & Badges (`rounded-full` / 9999px):** Buttons, filter pills, split flags, and metric badges use fully circular end caps. This eliminates visual friction and supports rapid identification of tappable targets.
- **Mini Badges & Avatars (`rounded-full` / 9999px):** Micro activity icons (running, cycling, walking) are nested in circular discs.

## Components

### Buttons
- **Primary Action (e.g., "Rotayı Başlat"):** Pill-shaped (`rounded-full`), height 52px. Background `#0E7C66`, text `#FFFFFF`, font weight 700. Pressed state transitions to `#0A5E4E`. Accompanied by soft directional ambient shadow.
- **Urgent / Live Action (e.g., "Kaydı Bitir"):** Pill-shaped, height 52px. Background `#FF6B35`, text `#FFFFFF`. Pressed state `#E0531F`.
- **Secondary / Ghost Pill:** Background `#E6F4F1`, text `#0E7C66`, 0px border. For non-terminal tasks ("Daha Fazla Göster", "Filtrele").
- **Floating Map Action Icon (FAB):** 44x44px circular disc, `#FFFFFF` translucent glass background, 1px border `#E5E7EB`, housing 20px rounded line icons.

### Chips & Activity Toggles
- **Activity Selectors ("Koşu", "Yürüyüş", "Bisiklet"):**
  - Unselected: Surface `#FFFFFF`, border 1px solid `#E5E7EB`, text `#4B5563`, icon muted `#9CA3AF`.
  - Selected: Surface `#E6F4F1`, border 1.5px solid `#0E7C66`, text `#0E7C66`, icon `#0E7C66`.
- **Metric Micro-Chips:** Height 24px, pill-shaped, subtle tint background (`#FFF0EB`), text `#E0531F` for personal records or steep gradient warnings.

### Route Cards
- Built with a 16px corner radius, `#FFFFFF` fill, 1px `#E5E7EB` outline, and soft ambient shadow (`0 4px 20px -2px rgba(0, 0, 0, 0.06)`).
- **Internal Anatomy:** Top half features an aspect-ratio 16:9 topographic route preview with dynamic gradient path; bottom half houses route title, distance (`km`), elevation gain (`m`), surface indicator ("Asfalt", "Arnavut Kaldırımı"), and creator avatar.

### Lists & Activity Feeds
- Clean row layouts with 56px minimum touch target heights.
- Separated by hairline borders (`#E5E7EB`) indented 56px from the leading edge to align with title text anchors.
- Trailing chevron indicators use `#9CA3AF`.

### Input Fields & Search Bars
- Floating Search Input ("Kadıköy, Belgrad Ormanı, Boğaz Turu ara..."): Height 48px, pill-shaped (`rounded-full`), background `#FFFFFF` with glass backdrop blur, leading search icon in `#0E7C66`, inner text `#111827`, placeholder text `#9CA3AF`.
- Form Fields: Height 48px, rounded 12px, border 1px solid `#E5E7EB`, focus state highlighting 1.5px border `#0E7C66` with zero drop shadow.

### Checkboxes & Segmented Switches
- **Segmented Control:** Enclosed container in `#F7F8F6` with 28px rounded pill, active sliding segment in pure `#FFFFFF` with ambient shadow.
- **Toggles:** Native iOS scale switch with track active fill `#0E7C66` and thumb `#FFFFFF`.

### Fitness-Specific Components
- **Elevation Cross-Section:** SVG area chart filled with vertical gradient from `#149B80` (15% opacity) down to transparent, capped with a 2px `#0E7C66` stroke.
- **Pace Split Strip:** Compact horizontal scroll rail displaying kilometer markers with color-coded tempo bars (Teal for fast, Neutral for average, Orange for sprint).