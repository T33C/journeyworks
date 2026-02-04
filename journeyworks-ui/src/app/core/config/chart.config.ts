/**
 * Shared chart configuration for consistent sizing across all chart components.
 * Use these constants to ensure visual alignment between side-by-side charts.
 *
 * COLOR THEME: All colors are defined here for easy corporate theming.
 * Update the THEME object to apply branding across all D3 visualizations.
 */

// =============================================================================
// THEME COLORS - Update these for corporate branding
// =============================================================================

export const THEME = {
  // Brand colors
  brand: {
    primary: '#5c6bc0',
    primaryDark: '#3f51b5',
    accent: '#7c4dff',
    secondary: '#1976d2',
  },

  // Sentiment colors
  sentiment: {
    positive: '#66bb6a',
    positiveDark: '#4caf50',
    positiveLight: '#81c784',
    neutral: '#9e9e9e',
    negative: '#ef5350',
    negativeDark: '#f44336',
    negativeLight: '#e57373',
    mixed: '#ffb74d',
    mixedDark: '#ff9800',
  },

  // Quadrant colors
  quadrant: {
    critical: { fill: '#e53935', bg: '#ffebee' },
    watch: { fill: '#ff8f00', bg: '#fff8e1' },
    strength: { fill: '#43a047', bg: '#e8f5e9' },
    noise: { fill: '#9e9e9e', bg: '#fafafa' },
  },

  // Chart element colors
  chart: {
    axis: '#666',
    axisLight: '#999',
    grid: '#ccc',
    gridLight: '#f0f0f0',
    highlight: '#ffeb3b',
    socialBand: '#9c27b0',
  },

  // Gradient colors for sentiment band
  gradient: {
    negative: '#f44336',
    neutral: '#ffc107',
    positive: '#4caf50',
  },

  // NPS specific colors
  nps: {
    positive: '#2e7d32',
    negative: '#c62828',
    accentPositive: '#303f9f',
    accentNegative: '#6a1b9a',
  },

  // Status colors
  status: {
    open: '#1976d2',
    openBg: '#e3f2fd',
    inProgress: '#f57c00',
    inProgressBg: '#fff3e0',
    resolved: '#388e3c',
    resolvedBg: '#e8f5e9',
    escalated: '#d32f2f',
    escalatedBg: '#ffebee',
  },

  // Priority colors
  priority: {
    low: '#4caf50',
    medium: '#ff9800',
    high: '#f44336',
    urgent: '#9c27b0',
  },

  // Text colors
  text: {
    primary: '#333',
    secondary: '#666',
    muted: '#999',
    inverse: '#ffffff',
  },
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
