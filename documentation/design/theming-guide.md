# JourneyWorks UI Theming Guide

This guide explains how to customize the visual appearance of JourneyWorks UI to match your corporate branding.

## Overview

The theming system is centralized in two locations:

| File                                  | Purpose                            | Affects                         |
| ------------------------------------- | ---------------------------------- | ------------------------------- |
| `src/styles/_variables.scss`          | SCSS variables for CSS styling     | Component styles, global styles |
| `src/app/core/config/chart.config.ts` | TypeScript constants for D3 charts | All D3 visualizations           |

Both files should be updated together to maintain visual consistency.

---

## Quick Start: Applying Corporate Colors

### Step 1: Update SCSS Variables

Edit `journeyworks-ui/src/styles/_variables.scss`:

```scss
// =============================================================================
// BRAND COLORS - Update these for corporate theming
// =============================================================================

// Primary brand colors
$brand-primary: #5c6bc0; // ← Your primary brand color
$brand-primary-light: #8e99a4;
$brand-primary-dark: #3f51b5;
$brand-accent: #7c4dff; // ← Your accent color

// Secondary brand colors
$brand-secondary: #1976d2; // ← Links, interactive elements
$brand-secondary-light: #42a5f5;
$brand-secondary-dark: #1565c0;
```

### Step 2: Update Chart Theme

Edit `journeyworks-ui/src/app/core/config/chart.config.ts`:

```typescript
export const THEME = {
  // Brand colors
  brand: {
    primary: '#5c6bc0', // ← Match $brand-primary
    primaryDark: '#3f51b5', // ← Match $brand-primary-dark
    accent: '#7c4dff', // ← Match $brand-accent
    secondary: '#1976d2', // ← Match $brand-secondary
  },
  // ... rest of theme
};
```

### Step 3: Rebuild

```bash
cd journeyworks-ui
npm run build
```

---

## Detailed Theme Configuration

### 1. Brand Colors

These define your organization's primary visual identity.

| Variable              | Usage                           | Default            |
| --------------------- | ------------------------------- | ------------------ |
| `$brand-primary`      | Headers, icons, primary buttons | `#5c6bc0` (Indigo) |
| `$brand-primary-dark` | Hover states, active elements   | `#3f51b5`          |
| `$brand-accent`       | Highlights, special elements    | `#7c4dff` (Purple) |
| `$brand-secondary`    | Links, secondary actions        | `#1976d2` (Blue)   |

### 2. Semantic Colors

These convey meaning and should follow accessibility guidelines.

#### Sentiment Colors

Used throughout the app to indicate positive/negative customer sentiment.

| Variable              | Usage                   | Default            |
| --------------------- | ----------------------- | ------------------ |
| `$sentiment-positive` | Good sentiment, success | `#4caf50` (Green)  |
| `$sentiment-neutral`  | Neutral sentiment       | `#9e9e9e` (Grey)   |
| `$sentiment-negative` | Bad sentiment, errors   | `#f44336` (Red)    |
| `$sentiment-mixed`    | Mixed/uncertain         | `#ff9800` (Orange) |

Each sentiment color has `-dark`, `-light`, and `-bg` variants:

```scss
$sentiment-positive-dark: #388e3c; // Darker shade for text
$sentiment-positive-light: #66bb6a; // Lighter shade for fills
$sentiment-positive-bg: #e8f5e9; // Background tint
```

#### Status Colors

Used for communication/case status badges.

| Variable              | Usage            | Default            |
| --------------------- | ---------------- | ------------------ |
| `$status-open`        | Open items       | `#1976d2` (Blue)   |
| `$status-in-progress` | Work in progress | `#f57c00` (Orange) |
| `$status-resolved`    | Completed items  | `#388e3c` (Green)  |
| `$status-escalated`   | Urgent items     | `#d32f2f` (Red)    |

#### Priority Colors

Used for priority indicators.

| Variable           | Usage           | Default            |
| ------------------ | --------------- | ------------------ |
| `$priority-low`    | Low priority    | `#4caf50` (Green)  |
| `$priority-medium` | Medium priority | `#ff9800` (Orange) |
| `$priority-high`   | High priority   | `#f44336` (Red)    |
| `$priority-urgent` | Urgent priority | `#9c27b0` (Purple) |

### 3. Quadrant Chart Colors

The analysis quadrant chart uses specific colors for each zone:

| Quadrant | Meaning                         | Fill Color | Background |
| -------- | ------------------------------- | ---------- | ---------- |
| Critical | High volume, negative sentiment | `#e53935`  | `#ffebee`  |
| Watch    | Low volume, negative sentiment  | `#ff8f00`  | `#fff8e1`  |
| Strength | High volume, positive sentiment | `#43a047`  | `#e8f5e9`  |
| Noise    | Low volume, positive sentiment  | `#9e9e9e`  | `#fafafa`  |

Update in `chart.config.ts`:

```typescript
quadrant: {
  critical: { fill: '#e53935', bg: '#ffebee' },
  watch: { fill: '#ff8f00', bg: '#fff8e1' },
  strength: { fill: '#43a047', bg: '#e8f5e9' },
  noise: { fill: '#9e9e9e', bg: '#fafafa' },
},
```

### 4. UI Colors

General interface colors for backgrounds, borders, and text.

```scss
// Backgrounds
$bg-page: #f5f5f5; // Main page background
$bg-card: #ffffff; // Card backgrounds
$bg-surface: #fafafa; // Subtle surface color
$bg-sidebar: #1e1e2f; // Dark sidebar

// Borders
$border-light: #e0e0e0;
$border-default: #ccc;
$border-dark: #999;

// Text colors
$text-primary: #333; // Main text
$text-secondary: #666; // Secondary text
$text-muted: #999; // Muted/placeholder text
$text-inverse: #ffffff; // Text on dark backgrounds
```

### 5. Spacing & Typography

```scss
// Spacing scale
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 32px;
$spacing-xxl: 48px;

// Font sizes
$font-size-xs: 10px;
$font-size-sm: 12px;
$font-size-md: 14px;
$font-size-lg: 16px;
$font-size-xl: 20px;
$font-size-xxl: 24px;

// Border radius
$border-radius-sm: 4px;
$border-radius-md: 8px;
$border-radius-lg: 16px;
$border-radius-pill: 9999px;
```

---

## File Structure

```
journeyworks-ui/src/
├── styles/
│   ├── _variables.scss      # All theme variables
│   ├── _mixins.scss         # Reusable SCSS patterns
│   └── (imported by styles.scss)
├── app/
│   ├── core/
│   │   └── config/
│   │       └── chart.config.ts  # D3 chart theme
│   └── shared/
│       ├── constants/
│       │   └── app.constants.ts # Dropdown options, labels
│       └── utils/
│           └── ui.utils.ts      # Shared utility functions
```

---

## Using Theme in Components

### In SCSS Files

```scss
// Import variables (relative path from component)
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.my-component {
  color: $text-primary;
  background: $bg-card;
  padding: $spacing-md;

  .status {
    @include status-badge;
    @include status-open;
  }
}
```

### In TypeScript (for D3 charts)

```typescript
import {
  THEME,
  getQuadrantColor,
  getSentimentColor,
} from '../../../core/config/chart.config';

// Use theme colors
svg.append('rect').attr('fill', THEME.sentiment.positive);

// Use helper functions
const color = getSentimentColor(sentimentValue); // Returns color based on -1 to 1 value
const quadColor = getQuadrantColor('critical'); // Returns #e53935
```

### In Templates (CSS classes)

The global `styles.scss` provides utility classes:

```html
<!-- Sentiment classes -->
<span class="sentiment-positive">Good</span>
<span class="sentiment-negative">Bad</span>

<!-- Status badges -->
<span class="status-badge status-open">Open</span>
<span class="status-badge status-resolved">Resolved</span>

<!-- Priority indicators -->
<div class="priority-high">Urgent Issue</div>
```

---

## Angular Material Integration

The app uses Angular Material with a custom theme. The Material theme is defined in `styles.scss`:

```scss
$journeyworks-theme: mat.define-theme(
  (
    color: (
      theme-type: light,
      primary: mat.$blue-palette,
      // ← Change for different Material palette
      tertiary: mat.$violet-palette,
    ),
    density: (
      scale: 0,
    ),
  )
);
```

To change the Material theme, replace the palette references with your preferred [Material Design palettes](https://material.angular.io/guide/theming).

---

## Best Practices

1. **Keep SCSS and TypeScript themes in sync** - When updating brand colors, update both `_variables.scss` and `chart.config.ts`

2. **Use semantic variables** - Don't use `#f44336` directly; use `$sentiment-negative` so the meaning is clear

3. **Test accessibility** - Ensure sufficient contrast between text and background colors (WCAG 2.1 AA minimum)

4. **Use the mixins** - For common patterns like status badges, use the provided mixins rather than duplicating styles

5. **Rebuild after changes** - Always run `npm run build` to verify your changes compile correctly

---

## Troubleshooting

### Colors not updating?

1. Clear the build cache: `rm -rf dist/`
2. Rebuild: `npm run build`
3. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### SCSS import errors?

Ensure you're using the correct relative path from your component to the styles folder:

```scss
// From src/app/features/dashboard/
@use '../../../../styles/variables' as *;

// From src/app/shared/
@use '../../../styles/variables' as *;
```

### Chart colors not updating?

D3 charts use TypeScript constants, not SCSS. Update colors in `chart.config.ts`, not `_variables.scss`.

---

## Color Reference Card

| Category      | Light Mode                                                         | Usage            |
| ------------- | ------------------------------------------------------------------ | ---------------- |
| **Brand**     |                                                                    |                  |
| Primary       | ![#5c6bc0](https://via.placeholder.com/20/5c6bc0/5c6bc0) `#5c6bc0` | Headers, buttons |
| Accent        | ![#7c4dff](https://via.placeholder.com/20/7c4dff/7c4dff) `#7c4dff` | Highlights       |
| Secondary     | ![#1976d2](https://via.placeholder.com/20/1976d2/1976d2) `#1976d2` | Links            |
| **Sentiment** |                                                                    |                  |
| Positive      | ![#4caf50](https://via.placeholder.com/20/4caf50/4caf50) `#4caf50` | Good sentiment   |
| Neutral       | ![#9e9e9e](https://via.placeholder.com/20/9e9e9e/9e9e9e) `#9e9e9e` | Neutral          |
| Negative      | ![#f44336](https://via.placeholder.com/20/f44336/f44336) `#f44336` | Bad sentiment    |
| Mixed         | ![#ff9800](https://via.placeholder.com/20/ff9800/ff9800) `#ff9800` | Mixed            |
| **Status**    |                                                                    |                  |
| Open          | ![#1976d2](https://via.placeholder.com/20/1976d2/1976d2) `#1976d2` | New items        |
| In Progress   | ![#f57c00](https://via.placeholder.com/20/f57c00/f57c00) `#f57c00` | Working          |
| Resolved      | ![#388e3c](https://via.placeholder.com/20/388e3c/388e3c) `#388e3c` | Complete         |
| Escalated     | ![#d32f2f](https://via.placeholder.com/20/d32f2f/d32f2f) `#d32f2f` | Urgent           |
| **Priority**  |                                                                    |                  |
| Low           | ![#4caf50](https://via.placeholder.com/20/4caf50/4caf50) `#4caf50` | Low              |
| Medium        | ![#ff9800](https://via.placeholder.com/20/ff9800/ff9800) `#ff9800` | Medium           |
| High          | ![#f44336](https://via.placeholder.com/20/f44336/f44336) `#f44336` | High             |
| Urgent        | ![#9c27b0](https://via.placeholder.com/20/9c27b0/9c27b0) `#9c27b0` | Critical         |
