/**
 * JourneyWorks UI - Shared UI Utilities
 *
 * Common utility functions for UI rendering used across multiple components.
 * Import these instead of duplicating logic in each component.
 */

// =============================================================================
// CHANNEL ICONS
// =============================================================================

const CHANNEL_ICONS: Record<string, string> = {
  email: 'email',
  phone: 'phone',
  chat: 'chat',
  social: 'public',
  letter: 'mail',
};

/**
 * Get Material icon name for a communication channel
 */
export function getChannelIcon(channel: string): string {
  return CHANNEL_ICONS[channel] || 'message';
}

// =============================================================================
// STATUS CLASSES
// =============================================================================

/**
 * Get CSS class for a status value
 * Returns class like 'status-open', 'status-in-progress', etc.
 */
export function getStatusClass(status: string): string {
  return `status-${status.replace('_', '-')}`;
}

// =============================================================================
// PRIORITY CLASSES
// =============================================================================

/**
 * Get CSS class for a priority value
 * Returns class like 'priority-low', 'priority-high', etc.
 */
export function getPriorityClass(priority: string): string {
  return `priority-${priority}`;
}

// =============================================================================
// SENTIMENT CLASSES
// =============================================================================

interface SentimentLike {
  label: string;
}

/**
 * Get CSS class for sentiment analysis result
 * Returns class like 'sentiment-positive', 'sentiment-negative', etc.
 */
export function getSentimentClass(sentiment?: SentimentLike): string {
  if (!sentiment) return '';
  return `sentiment-${sentiment.label}`;
}

/**
 * Get sentiment label from numeric score
 */
export function getSentimentLabel(
  score: number,
): 'positive' | 'neutral' | 'negative' | 'mixed' {
  if (score > 0.3) return 'positive';
  if (score < -0.3) return 'negative';
  if (Math.abs(score) < 0.1) return 'neutral';
  return 'mixed';
}

// =============================================================================
// URGENCY CLASSES
// =============================================================================

/**
 * Get CSS class for urgency level
 */
export function getUrgencyClass(urgency: string): string {
  return `urgency-${urgency}`;
}

// =============================================================================
// DATE/TIME UTILITIES
// =============================================================================

/**
 * Format a date for display in relative terms
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString();
}

// =============================================================================
// NUMBER FORMATTING
// =============================================================================

/**
 * Format a number with sign prefix (+/-)
 */
export function formatWithSign(value: number, decimals = 0): string {
  const formatted = value.toFixed(decimals);
  return value > 0 ? `+${formatted}` : formatted;
}

/**
 * Format percentage value
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format NPS score with sign
 */
export function formatNPS(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

// =============================================================================
// COLOR UTILITIES FOR D3 CHARTS
// Corporate theme colours - RAG palette for status/sentiment
// =============================================================================

/**
 * Get color for sentiment value (-1 to 1)
 */
export function getSentimentColor(sentiment: number): string {
  if (sentiment < -0.4) return '#A8000B'; // Negative (RAG Red)
  if (sentiment < 0) return '#FFBB33'; // Slightly negative (RAG Amber)
  return '#00847F'; // Positive/neutral (RAG Green)
}

/**
 * Get color for quadrant type
 */
export function getQuadrantColor(quadrant: string): string {
  switch (quadrant) {
    case 'critical':
      return '#A8000B'; // RAG Red
    case 'watch':
      return '#FFBB33'; // RAG Amber
    case 'strength':
      return '#00847F'; // RAG Green
    case 'noise':
      return '#9B9B9B'; // Grey 5
    default:
      return '#305A85'; // Blue (secondary)
  }
}

/**
 * Get background color for quadrant type
 */
export function getQuadrantBgColor(quadrant: string): string {
  switch (quadrant) {
    case 'critical':
      return '#FCEAEB'; // Light red
    case 'watch':
      return '#FFF8E6'; // Light amber
    case 'strength':
      return '#E6F3F2'; // Light green
    case 'noise':
      return '#F3F3F3'; // Grey 1
    default:
      return '#E8EEF3'; // Light blue
  }
}
