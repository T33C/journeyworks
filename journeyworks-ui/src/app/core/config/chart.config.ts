/**
 * Shared chart configuration for consistent sizing across all chart components.
 * Use these constants to ensure visual alignment between side-by-side charts.
 *
 * CORPORATE THEME: All colors follow official brand guidelines.
 * - Use RAG palette for status/severity indicators
 * - Use Data Visualisation palette for charts
 * - Brand red should be used sparingly
 */

// =============================================================================
// GREY PALETTE
// =============================================================================

export const GREY = {
  1: '#F3F3F3', // Lightest (page backgrounds)
  2: '#EDEDED', // Light (card backgrounds)
  3: '#D7D8D6', // Medium-light (borders)
  4: '#B7B7B7', // Medium (placeholder)
  5: '#9B9B9B', // Neutral (muted text)
  6: '#767676', // Medium-dark (secondary text)
  7: '#545454', // Dark (primary text)
  8: '#333333', // Darkest (headings)
} as const;

// =============================================================================
// RAG PALETTE (Status & Severity)
// =============================================================================

export const RAG = {
  red: '#A8000B', // Strong negative, errors
  amber: '#FFBB33', // Warning, alerts
  green: '#00847F', // Positive, success
  blue: '#305A85', // Informational
} as const;

// =============================================================================
// DATA VISUALISATION PALETTE
// =============================================================================

export const DATA_VIS = {
  blue: {
    1: '#266076', // Darkest
    2: '#347893', // Dark
    3: '#1494C6', // Primary
    4: '#509EBC', // Light
  },
  purple: {
    1: '#7C4386', // Dark
    2: '#7C4386', // Medium
    3: '#A752CF', // Primary
    4: '#B184C7', // Light
  },
  pink: {
    1: '#933D4F', // Dark
    2: '#C03954', // Medium
    3: '#F14E73', // Primary
    4: '#E76E84', // Light
  },
  orange: {
    1: '#9B4822', // Dark
    2: '#C64D24', // Medium
    3: '#ED500D', // Primary
    4: '#EC7046', // Light
  },
  green: {
    1: '#356512', // Darkest
    2: '#518827', // Dark
    3: '#4DA90F', // Primary
    4: '#74A157', // Light
  },
} as const;

// Categorical colour sequence for charts (avoiding purple for more corporate look)
export const CATEGORICAL_COLORS = [
  DATA_VIS.blue[3], // #1494C6
  DATA_VIS.pink[3], // #F14E73
  DATA_VIS.orange[3], // #ED500D
  DATA_VIS.green[3], // #4DA90F
  DATA_VIS.blue[1], // #266076
  DATA_VIS.pink[1], // #933D4F
  DATA_VIS.orange[1], // #9B4822
  DATA_VIS.green[1], // #356512
] as const;

// =============================================================================
// THEME COLORS
// =============================================================================

export const THEME = {
  // Core brand colors (use sparingly)
  brand: {
    primary: '#DB0011', // HSBC Red
    primaryLight: '#E31E22', // Red 1
    primaryDark: '#730014', // Red 3
    accent: '#DB0011', // HSBC Red
    secondary: RAG.blue, // Blue
    white: '#FFFFFF',
    black: '#000000',
  },

  // Grey palette
  grey: GREY,

  // Sentiment colors (aligned with RAG)
  sentiment: {
    positive: RAG.green,
    positiveDark: '#006560',
    positiveLight: '#4DA99F',
    positiveBg: '#E6F3F2',
    neutral: GREY[5],
    neutralDark: GREY[6],
    negative: RAG.red,
    negativeDark: '#730014',
    negativeLight: '#D13D47',
    negativeBg: '#FCEAEB',
    mixed: RAG.amber,
    mixedDark: '#E5A82E',
    mixedBg: '#FFF8E6',
  },

  // Quadrant colors (using RAG)
  quadrant: {
    critical: { fill: RAG.red, bg: '#FCEAEB' },
    watch: { fill: RAG.amber, bg: '#FFF8E6' },
    strength: { fill: RAG.green, bg: '#E6F3F2' },
    noise: { fill: GREY[5], bg: GREY[1] },
  },

  // Chart element colors
  chart: {
    axis: GREY[6],
    axisLight: GREY[5],
    grid: GREY[3],
    gridLight: GREY[1],
    highlight: RAG.amber,
    socialBand: DATA_VIS.pink[3], // Pink for better contrast with RAG
  },

  // Gradient colors for sentiment band
  gradient: {
    negative: RAG.red,
    neutral: RAG.amber,
    positive: RAG.green,
  },

  // NPS specific colors
  nps: {
    positive: RAG.green,
    negative: RAG.red,
    accentPositive: DATA_VIS.blue[1],
    accentNegative: DATA_VIS.pink[1], // Corporate pink instead of purple
  },

  // Status colors (RAG)
  status: {
    open: RAG.blue,
    openBg: '#E8EEF3',
    inProgress: RAG.amber,
    inProgressBg: '#FFF8E6',
    resolved: RAG.green,
    resolvedBg: '#E6F3F2',
    escalated: RAG.red,
    escalatedBg: '#FCEAEB',
  },

  // Priority colors (RAG)
  priority: {
    low: RAG.green,
    medium: RAG.amber,
    high: RAG.red,
    urgent: '#730014', // Dark red
  },

  // Text colors
  text: {
    primary: GREY[8],
    secondary: GREY[6],
    muted: GREY[5],
    inverse: '#FFFFFF',
  },

  // Data visualisation
  dataVis: DATA_VIS,
  categorical: CATEGORICAL_COLORS,
} as const;

// =============================================================================
// CHART CONFIGURATION
// =============================================================================

export const CHART_CONFIG = {
  // Margins - consistent spacing around all charts
  margin: {
    top: 20,
    right: 20,
    bottom: 50,
    left: 50,
  },

  // Fixed chart drawing area dimensions (inside margins)
  // This ensures both side-by-side charts have identical y-axis heights
  chartArea: {
    height: 180, // Fixed height for the chart drawing area
  },

  // Minimum heights for chart containers
  minHeight: 180,

  // Animation timings
  animation: {
    duration: 400,
    stagger: 80,
    delay: 200,
  },

  // Typography
  fontSize: {
    axisLabel: '10px',
    axisTitle: '10px',
    tooltip: '12px',
    quadrantLabel: '11px',
    valueLabel: '11px',
  },

  // Colors - referencing theme for backward compatibility
  colors: {
    axis: THEME.chart.axis,
    gridLine: THEME.chart.grid,
    positive: THEME.sentiment.positive,
    negative: THEME.sentiment.negative,
    accent: THEME.brand.primary,
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate chart dimensions from container
 */
export function getChartDimensions(container: HTMLElement): {
  width: number;
  height: number;
} {
  const margin = CHART_CONFIG.margin;
  return {
    width: container.offsetWidth - margin.left - margin.right,
    height: CHART_CONFIG.chartArea.height,
  };
}

/**
 * Get sentiment color based on value (-1 to 1)
 */
export function getSentimentColor(sentiment: number): string {
  if (sentiment < -0.4) return THEME.sentiment.negative;
  if (sentiment < 0) return THEME.sentiment.mixed;
  return THEME.sentiment.positive;
}

/**
 * Get quadrant fill color
 */
export function getQuadrantColor(quadrant: string): string {
  const q = THEME.quadrant[quadrant as keyof typeof THEME.quadrant];
  return q?.fill ?? THEME.brand.primary;
}

/**
 * Get quadrant background color
 */
export function getQuadrantBgColor(quadrant: string): string {
  const q = THEME.quadrant[quadrant as keyof typeof THEME.quadrant];
  return q?.bg ?? '#e8eaf6';
}

/**
 * Get NPS change color (positive vs negative movement)
 */
export function getNPSChangeColor(change: number): string {
  return change >= 0 ? THEME.nps.positive : THEME.nps.negative;
}

/**
 * Get bar fill color based on sentiment change
 */
export function getChangeColor(change: number): string {
  return change >= 0 ? THEME.sentiment.positive : THEME.sentiment.negative;
}
