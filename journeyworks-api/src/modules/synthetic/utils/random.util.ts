/**
 * Shared Random Utilities for Synthetic Data Generation
 *
 * Eliminates duplication across generators by centralising
 * common random selection, date generation, and subset methods.
 */

/**
 * Pick a random element from an array
 */
export function randomChoice<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Weighted random selection from [value, weight] pairs
 */
export function weightedChoice(options: Array<[string, number]>): string {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  const random = Math.random() * total;
  let cumulative = 0;

  for (const [value, weight] of options) {
    cumulative += weight;
    if (random < cumulative) {
      return value;
    }
  }

  return options[options.length - 1][0];
}

/**
 * Weighted random selection from parallel arrays of items and weights
 */
export function weightedChoiceFromArrays<T>(
  items: readonly T[],
  weights: number[],
): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Generate a random date between start and end, biased toward recent dates.
 * Uses Math.pow(random, 0.5) to skew distribution toward the end of the range.
 */
export function randomDate(start: Date, end: Date): Date {
  const diff = end.getTime() - start.getTime();
  const biasedRandom = Math.pow(Math.random(), 0.5);
  return new Date(start.getTime() + biasedRandom * diff);
}

/**
 * Generate a uniformly distributed random date (no recency bias)
 */
export function randomDateUniform(start: Date, end: Date): Date {
  const diff = end.getTime() - start.getTime();
  return new Date(start.getTime() + Math.random() * diff);
}

/**
 * Pick a random subset of items from an array
 */
export function randomSubset<T>(array: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Generate a sentiment score based on sentiment label
 */
export function getSentimentScore(sentiment: string): number {
  switch (sentiment) {
    case 'positive':
      return 0.5 + Math.random() * 0.5;
    case 'negative':
      return -0.5 - Math.random() * 0.5;
    case 'mixed':
      return -0.2 + Math.random() * 0.4;
    default:
      return -0.1 + Math.random() * 0.2;
  }
}

/**
 * Deterministic hash code for a string (for seeded random generation)
 */
export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
