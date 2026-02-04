/**
 * Elasticsearch Index Definitions
 *
 * This is the GOLDEN SOURCE for all Elasticsearch index definitions.
 * All index mappings, settings, and configurations are defined here.
 *
 * Index naming convention:
 * - Development: {name} (e.g., customers, communications)
 * - Production: journeyworks_{name} (configurable via env)
 */

export * from './customers.index';
export * from './communications.index';
export * from './chunks.index';
export * from './cases.index';
export * from './events.index';
export * from './social.index';
export * from './index-registry';
