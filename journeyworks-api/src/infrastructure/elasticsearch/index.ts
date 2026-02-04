/**
 * Elasticsearch Module Exports
 */

export * from './elasticsearch.module';
export * from './elasticsearch-client.service';
export * from './elasticsearch-health.service';
export * from './base-elasticsearch.repository';
export * from './index-management.service';

// Index definitions (golden source)
export * from './indices';

// Legacy export for backward compatibility
export { INDEX_MAPPINGS } from './indices/index-registry';
