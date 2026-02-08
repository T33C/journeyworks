/**
 * Date Range Parser Utility
 *
 * Shared date/time range parsing used by both the ReAct agent tools
 * and the RRG (Retrieval-Refined Generation) service.
 *
 * Consolidates duplicate parsing logic into a single source of truth.
 *
 * @example
 * ```ts
 * // Agent tools — returns null for "all time" (no date filter)
 * const range = DateRangeParser.parse('last 7 days');   // { from: '...', to: '...' }
 * const none  = DateRangeParser.parse('all');            // null
 *
 * // RRG service — parse a relative expression
 * const range = DateRangeParser.parseRelative('this month');
 *
 * // RRG service — validate/normalise an ISO date string
 * const iso = DateRangeParser.parseDate('2025-01-15');
 * ```
 */

/**
 * Resolved date range with ISO-8601 strings
 */
export interface ResolvedDateRange {
  from: string;
  to: string;
}

export class DateRangeParser {
  /**
   * Parse a time range string into from/to dates.
   *
   * Returns `null` when the input means "no date filter" (e.g. "all", "all time", empty).
   * Returns `null` for unrecognised formats as a safe fallback.
   *
   * Supported patterns:
   *  - "all" / "all time" / ""        → null (no filter)
   *  - "today"                         → start-of-day … now
   *  - "yesterday"                     → yesterday 00:00 … 23:59:59
   *  - "this week"                     → Sunday 00:00 … now
   *  - "this month"                    → 1st of month … now
   *  - "this year"                     → Jan 1st … now
   *  - "last week"                     → previous full Sun–Sat
   *  - "last month"                    → previous full calendar month
   *  - "last N day(s)/week(s)/month(s)/year(s)" → N units ago … now
   */
  static parse(timeRange: string): ResolvedDateRange | null {
    const normalized = (timeRange || '').toLowerCase().trim();

    // No date filter
    if (
      normalized === '' ||
      normalized === 'all' ||
      normalized === 'all time'
    ) {
      return null;
    }

    return DateRangeParser.parseRelative(normalized);
  }

  /**
   * Parse a relative time expression into an absolute from/to range.
   *
   * Unlike `parse()`, this does NOT treat empty / "all" as null —
   * it returns `null` only for genuinely unrecognised formats.
   *
   * Used by the RRG service when the LLM emits a `relative` field.
   */
  static parseRelative(relative: string): ResolvedDateRange | null {
    const now = new Date();
    const lower = (relative || '').toLowerCase().trim();

    // --- Exact matches ---

    if (lower === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }

    if (lower === 'yesterday') {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }

    if (lower === 'this week') {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }

    if (lower === 'this month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: now.toISOString() };
    }

    if (lower === 'this year') {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.toISOString(), to: now.toISOString() };
    }

    // "last week" → previous full Sunday–Saturday
    if (lower === 'last week') {
      const endOfLastWeek = new Date(now);
      endOfLastWeek.setDate(endOfLastWeek.getDate() - endOfLastWeek.getDay());
      endOfLastWeek.setHours(0, 0, 0, -1); // Saturday 23:59:59.999
      const startOfLastWeek = new Date(endOfLastWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 6);
      startOfLastWeek.setHours(0, 0, 0, 0);
      return {
        from: startOfLastWeek.toISOString(),
        to: endOfLastWeek.toISOString(),
      };
    }

    // "last month" → previous full calendar month
    if (lower === 'last month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );
      return { from: start.toISOString(), to: end.toISOString() };
    }

    // --- Pattern: "last N <unit>" ---

    const match = lower.match(/last\s+(\d+)\s+(day|week|month|year)s?/);
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2];
      const from = new Date(now);

      switch (unit) {
        case 'day':
          from.setDate(from.getDate() - amount);
          break;
        case 'week':
          from.setDate(from.getDate() - amount * 7);
          break;
        case 'month':
          from.setMonth(from.getMonth() - amount);
          break;
        case 'year':
          from.setFullYear(from.getFullYear() - amount);
          break;
      }

      return { from: from.toISOString(), to: now.toISOString() };
    }

    // --- Fuzzy / .includes() fallbacks for LLM output that wraps the keyword ---
    // e.g. "for today", "within this week", "during this month"

    if (lower.includes('today')) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }

    if (lower.includes('yesterday')) {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }

    if (lower.includes('this week')) {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }

    if (lower.includes('this month')) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: now.toISOString() };
    }

    if (lower.includes('this year')) {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.toISOString(), to: now.toISOString() };
    }

    // Unrecognised
    return null;
  }

  /**
   * Validate / normalise a date string.
   *
   * If the value is already ISO-8601, returns it as-is.
   * Otherwise attempts `new Date(value)` parsing.
   * Returns the original string if it cannot be parsed.
   */
  static parseDate(value: string): string {
    if (!value) return '';

    // Already ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value;
    }

    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    return value;
  }
}
