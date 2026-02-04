/**
 * Index Registry
 *
 * Central registry of all Elasticsearch indices.
 * This is the GOLDEN SOURCE for index definitions.
 */

import { CUSTOMERS_INDEX } from './customers.index';
import { COMMUNICATIONS_INDEX } from './communications.index';
import { CHUNKS_INDEX } from './chunks.index';
import { CASES_INDEX } from './cases.index';
import { EVENTS_INDEX } from './events.index';
import { SOCIAL_INDEX } from './social.index';

/**
 * Index definition structure
 */
export interface IndexDefinition {
  /** Index name (without prefix) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Schema version for migrations */
  version: string;
  /** Elasticsearch index settings */
  settings: Record<string, unknown>;
  /** Elasticsearch mapping definition */
  mappings: {
    properties: Record<string, unknown>;
  };
}

/**
 * All registered indices
 */
export const INDEX_REGISTRY: Record<string, IndexDefinition> = {
  customers: CUSTOMERS_INDEX,
  communications: COMMUNICATIONS_INDEX,
  chunks: CHUNKS_INDEX,
  cases: CASES_INDEX,
  events: EVENTS_INDEX,
  social: SOCIAL_INDEX,
};

/**
 * Get all index names
 */
export function getAllIndexNames(): string[] {
  return Object.keys(INDEX_REGISTRY);
}

/**
 * Get index definition by name
 */
export function getIndexDefinition(name: string): IndexDefinition | undefined {
  return INDEX_REGISTRY[name];
}

/**
 * Get index configuration in Elasticsearch format
 */
export function getIndexConfig(
  name: string,
): { settings: unknown; mappings: unknown } | undefined {
  const def = INDEX_REGISTRY[name];
  if (!def) return undefined;
  return {
    settings: def.settings,
    mappings: def.mappings,
  };
}

/**
 * Convert index name to prefixed name
 */
export function getPrefixedIndexName(name: string, prefix?: string): string {
  return prefix ? `${prefix}_${name}` : name;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use INDEX_REGISTRY instead
 */
export const INDEX_MAPPINGS: Record<string, object> = Object.fromEntries(
  Object.entries(INDEX_REGISTRY).map(([key, def]) => [
    key,
    {
      settings: def.settings,
      mappings: def.mappings,
    },
  ]),
);
