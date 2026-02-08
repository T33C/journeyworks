# JourneyWorks UI Theming Guide

This guide explains how to customize the visual appearance of JourneyWorks UI to match corporate branding guidelines.

## Overview

The theming system is centralized in two locations:

| File                                  | Purpose                            | Affects                         |
| ------------------------------------- | ---------------------------------- | ------------------------------- |
| `src/styles/_variables.scss`          | SCSS variables for CSS styling     | Component styles, global styles |
| `src/app/core/config/chart.config.ts` | TypeScript constants for D3 charts | All D3 visualizations           |

Both files should be updated together to maintain visual consistency.

---

## Corporate Brand Guidelines

> **Important**: This theming guide follows official corporate brand guidelines. Red should be used sparingly alongside other colours from the brand palette.

---

## Quick Start: Applying Corporate Colors

### Step 1: Update SCSS Variables

Edit `journeyworks-ui/src/styles/_variables.scss`:

```scss
// =============================================================================
// CORPORATE BRAND COLORS
// =============================================================================

// Core Palette
$brand-primary: #db0011; // HSBC Red (Pantone 1795C)
$brand-white: #ffffff; // White
$brand-black: #000000; // Black

// Complementary Red Palette (use sparingly)
$brand-red-1: #e31e22; // Pantone 2033C - Lighter red
$brand-red-2: #ba1110; // Pantone 7627C - Medium red
$brand-red-3: #730014; // Pantone 3523C - Dark red

// Complementary Grey Palette
$grey-1: #f3f3f3; // Lightest grey (backgrounds)
$grey-2: #ededed; // Light grey
$grey-3: #d7d8d6; // Medium-light grey
$grey-4: #b7b7b7; // Medium grey
$grey-5: #9b9b9b; // Neutral grey
$grey-6: #767676; // Medium-dark grey
$grey-7: #545454; // Dark grey
$grey-8: #333333; // Darkest grey (text)

// Legacy mappings for backward compatibility
$brand-primary-light: $brand-red-1;
$brand-primary-dark: $brand-red-3;
$brand-accent: $brand-primary;
$brand-secondary: #305a85; // Blue (from RAG palette)
$brand-secondary-light: #347893;
$brand-secondary-dark: #266076;
```

### Step 2: Update Chart Theme

Edit `journeyworks-ui/src/app/core/config/chart.config.ts`:

```typescript
export const THEME = {
  // Core brand colors
  brand: {
    primary: '#DB0011', // HSBC Red
    primaryLight: '#E31E22', // Red 1
    primaryDark: '#730014', // Red 3
    accent: '#DB0011', // HSBC Red
    secondary: '#305A85', // Blue
    white: '#FFFFFF',
    black: '#000000',
  },
  // Grey palette
  grey: {
    1: '#F3F3F3',
    2: '#EDEDED',
    3: '#D7D8D6',
    4: '#B7B7B7',
    5: '#9B9B9B',
    6: '#767676',
    7: '#545454',
    8: '#333333',
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

### 1. Core Brand Palette

The core palette defines the organization's primary visual identity.

| Colour       | HEX       | Pantone | Usage                                |
| ------------ | --------- | ------- | ------------------------------------ |
| **HSBC Red** | `#DB0011` | 1795C   | Primary brand colour (use sparingly) |
| **White**    | `#FFFFFF` | White   | Backgrounds, text on dark surfaces   |
| **Black**    | `#000000` | Black   | Text, high-contrast elements         |

> ⚠️ **Note**: Although red is a strong colour for the brand, it's important to remember that we're not just a 'red brand' — it should be used sparingly and combined with other colours from the brand palette.

### 2. Complementary Red Palette

Extended red palette for flexibility and depth when brand emphasis is needed.

| Variable       | HEX       | Pantone | Usage                        |
| -------------- | --------- | ------- | ---------------------------- |
| `$brand-red-1` | `#E31E22` | 2033C   | Lighter accent, hover states |
| `$brand-red-2` | `#BA1110` | 7627C   | Medium emphasis              |
| `$brand-red-3` | `#730014` | 3523C   | Dark accent, active states   |

### 3. Complementary Grey Palette

The grey palette supports other palettes and adds depth and clarity to the interface.

| Variable  | HEX       | Usage                                 |
| --------- | --------- | ------------------------------------- |
| `$grey-1` | `#F3F3F3` | Page backgrounds, light surfaces      |
| `$grey-2` | `#EDEDED` | Card backgrounds, subtle dividers     |
| `$grey-3` | `#D7D8D6` | Borders, disabled states              |
| `$grey-4` | `#B7B7B7` | Placeholder text, icons               |
| `$grey-5` | `#9B9B9B` | Secondary text, muted content         |
| `$grey-6` | `#767676` | Body text (minimum for accessibility) |
| `$grey-7` | `#545454` | Primary text, headings                |
| `$grey-8` | `#333333` | High-emphasis text, titles            |

#### Grey Background Accessibility

When using grey as a background, ensure text meets the minimum contrast ratio of **4.5:1**.

| Background | Recommended Text Colour |
| ---------- | ----------------------- |
| Grey 1–5   | Grey 8 or Black         |
| Grey 6–8   | White                   |

### 4. RAG Palette (Status & Severity)

The RAG (Red-Amber-Green) palette uses the traffic light system to convey status or severity levels within data visualisation and messaging.

> ⚠️ **Important**: The Core brand red palette should NOT be used in charts and graphs. Use the RAG palette instead to ensure clear meaning.

| Status    | HEX       | RGB          | Usage                                     |
| --------- | --------- | ------------ | ----------------------------------------- |
| **Red**   | `#A8000B` | 168, 0, 11   | Strong negative sentiment, errors         |
| **Amber** | `#FFBB33` | 255, 187, 51 | Warning, alerts, caution                  |
| **Green** | `#00847F` | 0, 132, 127  | Positive sentiment, success, confirmation |
| **Blue**  | `#305A85` | 48, 90, 133  | Informational, no action required         |

```scss
// RAG Status Colors
$rag-red: #a8000b;
$rag-amber: #ffbb33;
$rag-green: #00847f;
$rag-blue: #305a85;
```

### 5. Semantic Colors

These convey meaning and should follow accessibility guidelines.

#### Sentiment Colors

Updated to align with corporate RAG palette.

| Variable              | HEX       | Usage                   |
| --------------------- | --------- | ----------------------- |
| `$sentiment-positive` | `#00847F` | Good sentiment, success |
| `$sentiment-neutral`  | `#9B9B9B` | Neutral sentiment       |
| `$sentiment-negative` | `#A8000B` | Bad sentiment, errors   |
| `$sentiment-mixed`    | `#FFBB33` | Mixed/uncertain         |

Each sentiment color has `-dark`, `-light`, and `-bg` variants:

```scss
$sentiment-positive: #00847f;
$sentiment-positive-dark: #006560;
$sentiment-positive-light: #4da99f;
$sentiment-positive-bg: #e6f3f2;

$sentiment-negative: #a8000b;
$sentiment-negative-dark: #730014;
$sentiment-negative-light: #d13d47;
$sentiment-negative-bg: #fceaeb;
```

#### Status Colors

Used for communication/case status badges.

| Variable              | HEX       | Usage            |
| --------------------- | --------- | ---------------- |
| `$status-open`        | `#305A85` | Open items       |
| `$status-in-progress` | `#FFBB33` | Work in progress |
| `$status-resolved`    | `#00847F` | Completed items  |
| `$status-escalated`   | `#A8000B` | Urgent items     |

#### Priority Colors

Used for priority indicators.

| Variable           | HEX       | Usage           |
| ------------------ | --------- | --------------- |
| `$priority-low`    | `#00847F` | Low priority    |
| `$priority-medium` | `#FFBB33` | Medium priority |
| `$priority-high`   | `#A8000B` | High priority   |
| `$priority-urgent` | `#730014` | Urgent priority |

### 6. Data Visualisation Palette

This palette is specifically designed for representing data graphically (bar charts, pie charts, etc.). The colours work in harmony with the Core and Grey palettes and can be used on both light and dark backgrounds.

> ⚠️ **Note**: For print, data visualisations should only be displayed on a white background to meet the 3:1 colour contrast ratio requirement.

#### Blue Series

| Variable  | HEX       | RGB          | Usage        |
| --------- | --------- | ------------ | ------------ |
| `$blue-1` | `#266076` | 38, 96, 118  | Darkest blue |
| `$blue-2` | `#347893` | 52, 120, 147 | Dark blue    |
| `$blue-3` | `#1494C6` | 20, 148, 198 | Primary blue |
| `$blue-4` | `#509EBC` | 80, 158, 188 | Light blue   |

#### Purple Series

| Variable    | HEX       | RGB           | Usage          |
| ----------- | --------- | ------------- | -------------- |
| `$purple-1` | `#7C4386` | 124, 67, 134  | Dark purple    |
| `$purple-2` | `#7C4386` | 124, 67, 134  | Medium purple  |
| `$purple-3` | `#A752CF` | 167, 82, 207  | Primary purple |
| `$purple-4` | `#B184C7` | 177, 132, 199 | Light purple   |

#### Pink Series

| Variable  | HEX       | RGB           | Usage        |
| --------- | --------- | ------------- | ------------ |
| `$pink-1` | `#933D4F` | 147, 61, 79   | Dark pink    |
| `$pink-2` | `#C03954` | 192, 57, 84   | Medium pink  |
| `$pink-3` | `#F14E73` | 241, 78, 115  | Primary pink |
| `$pink-4` | `#E76E84` | 231, 110, 132 | Light pink   |

#### Orange Series

| Variable    | HEX       | RGB          | Usage          |
| ----------- | --------- | ------------ | -------------- |
| `$orange-1` | `#9B4822` | 155, 72, 34  | Dark orange    |
| `$orange-2` | `#C64D24` | 198, 77, 36  | Medium orange  |
| `$orange-3` | `#ED500D` | 237, 80, 13  | Primary orange |
| `$orange-4` | `#EC7046` | 236, 112, 70 | Light orange   |

#### Green Series

| Variable   | HEX       | RGB          | Usage         |
| ---------- | --------- | ------------ | ------------- |
| `$green-1` | `#356512` | 53, 101, 18  | Darkest green |
| `$green-2` | `#518827` | 81, 136, 39  | Dark green    |
| `$green-3` | `#4DA90F` | 77, 169, 15  | Primary green |
| `$green-4` | `#74A157` | 116, 161, 87 | Light green   |

#### Data Colour Sequence Guidelines

- **Similar data**: Use colours close to each other on the spectrum (e.g., blue, purple, pink)
- **Contrasting data**: Use opposing colours (e.g., loss = red/orange, gain = green/blue)
- **Sequential data**: Use light-to-dark progression within the same colour family
- **Categorical data**: Use distinct colours from different families for clear differentiation

```typescript
// Data visualisation palette for charts
export const DATA_VIS_COLORS = {
  blue: ['#266076', '#347893', '#1494C6', '#509EBC'],
  purple: ['#7C4386', '#7C4386', '#A752CF', '#B184C7'],
  pink: ['#933D4F', '#C03954', '#F14E73', '#E76E84'],
  orange: ['#9B4822', '#C64D24', '#ED500D', '#EC7046'],
  green: ['#356512', '#518827', '#4DA90F', '#74A157'],
};

// Recommended categorical sequence
export const CATEGORICAL_COLORS = [
  '#1494C6', // Blue 3
  '#A752CF', // Purple 3
  '#F14E73', // Pink 3
  '#ED500D', // Orange 3
  '#4DA90F', // Green 3
  '#266076', // Blue 1
  '#7C4386', // Purple 1
  '#933D4F', // Pink 1
];
```

### 7. Quadrant Chart Colors

The analysis quadrant chart uses specific colors for each zone:

| Quadrant | Meaning                         | Fill Color | Background |
| -------- | ------------------------------- | ---------- | ---------- |
| Critical | High volume, negative sentiment | `#A8000B`  | `#FCEAEB`  |
| Watch    | Low volume, negative sentiment  | `#FFBB33`  | `#FFF8E6`  |
| Strength | High volume, positive sentiment | `#00847F`  | `#E6F3F2`  |
| Noise    | Low volume, positive sentiment  | `#9B9B9B`  | `#F3F3F3`  |

Update in `chart.config.ts`:

```typescript
quadrant: {
  critical: { fill: '#A8000B', bg: '#FCEAEB' },
  watch: { fill: '#FFBB33', bg: '#FFF8E6' },
  strength: { fill: '#00847F', bg: '#E6F3F2' },
  noise: { fill: '#9B9B9B', bg: '#F3F3F3' },
},
```

### 8. UI Colors

General interface colors for backgrounds, borders, and text, mapped to corporate grey palette.

```scss
// Backgrounds
$bg-page: $grey-1; // #F3F3F3 - Main page background
$bg-card: $brand-white; // #FFFFFF - Card backgrounds
$bg-surface: $grey-2; // #EDEDED - Subtle surface color
$bg-sidebar: $grey-8; // #333333 - Dark sidebar

// Borders
$border-light: $grey-2; // #EDEDED
$border-default: $grey-3; // #D7D8D6
$border-dark: $grey-5; // #9B9B9B

// Text colors
$text-primary: $grey-8; // #333333 - Main text
$text-secondary: $grey-6; // #767676 - Secondary text (accessibility safe)
$text-muted: $grey-5; // #9B9B9B - Muted/placeholder text
$text-inverse: $brand-white; // #FFFFFF - Text on dark backgrounds
```

### 9. Spacing & Typography

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

2. **Use semantic variables** - Don't use `#A8000B` directly; use `$rag-red` or `$sentiment-negative` so the meaning is clear

3. **Test accessibility** - Ensure sufficient contrast between text and background colors (WCAG 2.1 AA minimum of 4.5:1)

4. **Use the mixins** - For common patterns like status badges, use the provided mixins rather than duplicating styles

5. **Rebuild after changes** - Always run `npm run build` to verify your changes compile correctly

6. **Use brand red sparingly** - Per corporate guidelines, HSBC Red should be used as an accent, not a dominant colour

7. **Separate data vis from brand** - Use the Data Visualisation palette for charts, not the Core or Complementary Red palettes

8. **Grey accessibility** - When using Grey 1-5 as backgrounds, use Grey 8 or Black for text; when using Grey 6-8 as backgrounds, use White for text

9. **RAG consistency** - Always use RAG palette colours for status indicators to ensure clear, consistent meaning

10. **Colour sequence in charts** - For similar data use adjacent spectrum colours; for contrasting data use opposing colours

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

| Category              | Colour                                                   | HEX       | Usage                  |
| --------------------- | -------------------------------------------------------- | --------- | ---------------------- |
| **Core Brand**        |                                                          |           |                        |
| HSBC Red              | ![#DB0011](https://via.placeholder.com/20/DB0011/DB0011) | `#DB0011` | Primary brand (sparse) |
| White                 | ![#FFFFFF](https://via.placeholder.com/20/FFFFFF/FFFFFF) | `#FFFFFF` | Backgrounds            |
| Black                 | ![#000000](https://via.placeholder.com/20/000000/000000) | `#000000` | High-contrast text     |
| **Complementary Red** |                                                          |           |                        |
| Red 1                 | ![#E31E22](https://via.placeholder.com/20/E31E22/E31E22) | `#E31E22` | Accent, hover          |
| Red 2                 | ![#BA1110](https://via.placeholder.com/20/BA1110/BA1110) | `#BA1110` | Medium emphasis        |
| Red 3                 | ![#730014](https://via.placeholder.com/20/730014/730014) | `#730014` | Dark accent            |
| **Grey Palette**      |                                                          |           |                        |
| Grey 1                | ![#F3F3F3](https://via.placeholder.com/20/F3F3F3/F3F3F3) | `#F3F3F3` | Page backgrounds       |
| Grey 2                | ![#EDEDED](https://via.placeholder.com/20/EDEDED/EDEDED) | `#EDEDED` | Card backgrounds       |
| Grey 3                | ![#D7D8D6](https://via.placeholder.com/20/D7D8D6/D7D8D6) | `#D7D8D6` | Borders                |
| Grey 4                | ![#B7B7B7](https://via.placeholder.com/20/B7B7B7/B7B7B7) | `#B7B7B7` | Placeholder text       |
| Grey 5                | ![#9B9B9B](https://via.placeholder.com/20/9B9B9B/9B9B9B) | `#9B9B9B` | Muted text             |
| Grey 6                | ![#767676](https://via.placeholder.com/20/767676/767676) | `#767676` | Secondary text         |
| Grey 7                | ![#545454](https://via.placeholder.com/20/545454/545454) | `#545454` | Primary text           |
| Grey 8                | ![#333333](https://via.placeholder.com/20/333333/333333) | `#333333` | Headings, titles       |
| **RAG Status**        |                                                          |           |                        |
| Red (Error)           | ![#A8000B](https://via.placeholder.com/20/A8000B/A8000B) | `#A8000B` | Errors, negative       |
| Amber (Warning)       | ![#FFBB33](https://via.placeholder.com/20/FFBB33/FFBB33) | `#FFBB33` | Warnings, alerts       |
| Green (Success)       | ![#00847F](https://via.placeholder.com/20/00847F/00847F) | `#00847F` | Success, positive      |
| Blue (Info)           | ![#305A85](https://via.placeholder.com/20/305A85/305A85) | `#305A85` | Informational          |
| **Data Vis - Blue**   |                                                          |           |                        |
| Blue 1                | ![#266076](https://via.placeholder.com/20/266076/266076) | `#266076` | Darkest                |
| Blue 2                | ![#347893](https://via.placeholder.com/20/347893/347893) | `#347893` | Dark                   |
| Blue 3                | ![#1494C6](https://via.placeholder.com/20/1494C6/1494C6) | `#1494C6` | Primary                |
| Blue 4                | ![#509EBC](https://via.placeholder.com/20/509EBC/509EBC) | `#509EBC` | Light                  |
| **Data Vis - Purple** |                                                          |           |                        |
| Purple 1              | ![#7C4386](https://via.placeholder.com/20/7C4386/7C4386) | `#7C4386` | Dark                   |
| Purple 3              | ![#A752CF](https://via.placeholder.com/20/A752CF/A752CF) | `#A752CF` | Primary                |
| Purple 4              | ![#B184C7](https://via.placeholder.com/20/B184C7/B184C7) | `#B184C7` | Light                  |
| **Data Vis - Pink**   |                                                          |           |                        |
| Pink 1                | ![#933D4F](https://via.placeholder.com/20/933D4F/933D4F) | `#933D4F` | Dark                   |
| Pink 2                | ![#C03954](https://via.placeholder.com/20/C03954/C03954) | `#C03954` | Medium                 |
| Pink 3                | ![#F14E73](https://via.placeholder.com/20/F14E73/F14E73) | `#F14E73` | Primary                |
| Pink 4                | ![#E76E84](https://via.placeholder.com/20/E76E84/E76E84) | `#E76E84` | Light                  |
| **Data Vis - Orange** |                                                          |           |                        |
| Orange 1              | ![#9B4822](https://via.placeholder.com/20/9B4822/9B4822) | `#9B4822` | Dark                   |
| Orange 2              | ![#C64D24](https://via.placeholder.com/20/C64D24/C64D24) | `#C64D24` | Medium                 |
| Orange 3              | ![#ED500D](https://via.placeholder.com/20/ED500D/ED500D) | `#ED500D` | Primary                |
| Orange 4              | ![#EC7046](https://via.placeholder.com/20/EC7046/EC7046) | `#EC7046` | Light                  |
| **Data Vis - Green**  |                                                          |           |                        |
| Green 1               | ![#356512](https://via.placeholder.com/20/356512/356512) | `#356512` | Darkest                |
| Green 2               | ![#518827](https://via.placeholder.com/20/518827/518827) | `#518827` | Dark                   |
| Green 3               | ![#4DA90F](https://via.placeholder.com/20/4DA90F/4DA90F) | `#4DA90F` | Primary                |
| Green 4               | ![#74A157](https://via.placeholder.com/20/74A157/74A157) | `#74A157` | Light                  |
