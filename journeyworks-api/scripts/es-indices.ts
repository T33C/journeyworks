#!/usr/bin/env ts-node
/**
 * Elasticsearch Index Management CLI
 *
 * Commands:
 *   create [--all] [--force] [index...]  Create indices
 *   delete [--all] [index...]            Delete indices
 *   status [--all] [index...]            Show index status
 *   list                                 List all registered indices
 *
 * Examples:
 *   npx ts-node scripts/es-indices.ts create --all
 *   npx ts-node scripts/es-indices.ts create customers communications
 *   npx ts-node scripts/es-indices.ts delete --all
 *   npx ts-node scripts/es-indices.ts status --all
 *   npx ts-node scripts/es-indices.ts list
 */

import { Client } from '@elastic/elasticsearch';
import {
  INDEX_REGISTRY,
  getAllIndexNames,
  getIndexConfig,
} from '../src/infrastructure/elasticsearch/indices';

// Configuration
const ES_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const ES_USERNAME = process.env.ELASTICSEARCH_USERNAME;
const ES_PASSWORD = process.env.ELASTICSEARCH_PASSWORD;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message: string, color = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string): void {
  log(`✓ ${message}`, colors.green);
}

function error(message: string): void {
  log(`✗ ${message}`, colors.red);
}

function info(message: string): void {
  log(`ℹ ${message}`, colors.blue);
}

function warn(message: string): void {
  log(`⚠ ${message}`, colors.yellow);
}

async function getClient(): Promise<Client> {
  const config: any = {
    node: ES_URL,
    maxRetries: 3,
    requestTimeout: 10000,
  };

  if (ES_USERNAME && ES_PASSWORD) {
    config.auth = { username: ES_USERNAME, password: ES_PASSWORD };
  }

  const client = new Client(config);

  // Test connection
  try {
    await client.ping();
    return client;
  } catch (err) {
    error(`Cannot connect to Elasticsearch at ${ES_URL}`);
    process.exit(1);
  }
}

async function createIndex(
  client: Client,
  name: string,
  force: boolean,
): Promise<boolean> {
  const config = getIndexConfig(name);
  if (!config) {
    error(`Unknown index: ${name}`);
    return false;
  }

  try {
    const exists = await client.indices.exists({ index: name });

    if (exists) {
      if (force) {
        await client.indices.delete({ index: name });
        warn(`Deleted existing index: ${name}`);
      } else {
        info(`Index already exists: ${name}`);
        return true;
      }
    }

    await client.indices.create({
      index: name,
      settings: config.settings as any,
      mappings: config.mappings as any,
    });

    success(`Created index: ${name}`);
    return true;
  } catch (err: any) {
    error(`Failed to create index ${name}: ${err.message}`);
    return false;
  }
}

async function deleteIndex(client: Client, name: string): Promise<boolean> {
  try {
    const exists = await client.indices.exists({ index: name });
    if (!exists) {
      info(`Index does not exist: ${name}`);
      return true;
    }

    await client.indices.delete({ index: name });
    success(`Deleted index: ${name}`);
    return true;
  } catch (err: any) {
    error(`Failed to delete index ${name}: ${err.message}`);
    return false;
  }
}

async function getIndexStatus(client: Client, name: string): Promise<void> {
  const definition = INDEX_REGISTRY[name];
  if (!definition) {
    error(`Unknown index: ${name}`);
    return;
  }

  try {
    const exists = await client.indices.exists({ index: name });
    if (!exists) {
      console.log(`  ${name}:`);
      console.log(
        `    ${colors.dim}Status:${colors.reset} ${colors.yellow}Not Created${colors.reset}`,
      );
      console.log(
        `    ${colors.dim}Version:${colors.reset} ${definition.version}`,
      );
      console.log(
        `    ${colors.dim}Description:${colors.reset} ${definition.description}`,
      );
      return;
    }

    const stats = await client.indices.stats({ index: name });
    const indexStats = stats.indices?.[name];
    const docCount = indexStats?.primaries?.docs?.count ?? 0;
    const sizeBytes = indexStats?.primaries?.store?.size_in_bytes ?? 0;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

    console.log(`  ${name}:`);
    console.log(
      `    ${colors.dim}Status:${colors.reset} ${colors.green}Active${colors.reset}`,
    );
    console.log(
      `    ${colors.dim}Version:${colors.reset} ${definition.version}`,
    );
    console.log(
      `    ${colors.dim}Documents:${colors.reset} ${docCount.toLocaleString()}`,
    );
    console.log(`    ${colors.dim}Size:${colors.reset} ${sizeMB} MB`);
    console.log(
      `    ${colors.dim}Description:${colors.reset} ${definition.description}`,
    );
  } catch (err: any) {
    error(`Failed to get status for ${name}: ${err.message}`);
  }
}

function listIndices(): void {
  console.log(
    '\n' +
      colors.cyan +
      'Registered Elasticsearch Indices:' +
      colors.reset +
      '\n',
  );

  for (const [name, def] of Object.entries(INDEX_REGISTRY)) {
    console.log(`  ${colors.blue}${name}${colors.reset}`);
    console.log(`    ${colors.dim}Version:${colors.reset} ${def.version}`);
    console.log(
      `    ${colors.dim}Description:${colors.reset} ${def.description}`,
    );
    console.log();
  }
}

function printUsage(): void {
  console.log(`
${colors.cyan}Elasticsearch Index Management CLI${colors.reset}

${colors.yellow}Usage:${colors.reset}
  npx ts-node scripts/es-indices.ts <command> [options] [indices...]

${colors.yellow}Commands:${colors.reset}
  create    Create indices
  delete    Delete indices
  status    Show index status
  list      List all registered indices

${colors.yellow}Options:${colors.reset}
  --all     Apply to all registered indices
  --force   Force recreate (delete if exists)

${colors.yellow}Examples:${colors.reset}
  npx ts-node scripts/es-indices.ts create --all
  npx ts-node scripts/es-indices.ts create --all --force
  npx ts-node scripts/es-indices.ts create customers communications
  npx ts-node scripts/es-indices.ts delete --all
  npx ts-node scripts/es-indices.ts delete communications
  npx ts-node scripts/es-indices.ts status --all
  npx ts-node scripts/es-indices.ts list

${colors.yellow}Environment Variables:${colors.reset}
  ELASTICSEARCH_URL       Elasticsearch URL (default: http://localhost:9200)
  ELASTICSEARCH_USERNAME  Elasticsearch username (optional)
  ELASTICSEARCH_PASSWORD  Elasticsearch password (optional)
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const hasAll = args.includes('--all');
  const hasForce = args.includes('--force');
  const indices = args.slice(1).filter((a) => !a.startsWith('--'));

  // Determine which indices to operate on
  let targetIndices: string[];
  if (hasAll) {
    targetIndices = getAllIndexNames();
  } else if (indices.length > 0) {
    targetIndices = indices;
  } else if (command === 'list') {
    targetIndices = [];
  } else {
    error('Please specify indices or use --all');
    printUsage();
    process.exit(1);
  }

  switch (command) {
    case 'create': {
      info(`Connecting to Elasticsearch at ${ES_URL}...`);
      const client = await getClient();
      success('Connected to Elasticsearch');
      console.log();

      let succeeded = 0;
      let failed = 0;

      for (const name of targetIndices) {
        const ok = await createIndex(client, name, hasForce);
        if (ok) succeeded++;
        else failed++;
      }

      console.log();
      info(`Created: ${succeeded}, Failed: ${failed}`);
      break;
    }

    case 'delete': {
      info(`Connecting to Elasticsearch at ${ES_URL}...`);
      const client = await getClient();
      success('Connected to Elasticsearch');
      console.log();

      let succeeded = 0;
      let failed = 0;

      for (const name of targetIndices) {
        const ok = await deleteIndex(client, name);
        if (ok) succeeded++;
        else failed++;
      }

      console.log();
      info(`Deleted: ${succeeded}, Failed: ${failed}`);
      break;
    }

    case 'status': {
      info(`Connecting to Elasticsearch at ${ES_URL}...`);
      const client = await getClient();
      success('Connected to Elasticsearch');
      console.log();

      console.log(colors.cyan + 'Index Status:' + colors.reset + '\n');
      for (const name of targetIndices) {
        await getIndexStatus(client, name);
        console.log();
      }
      break;
    }

    case 'list': {
      listIndices();
      break;
    }

    default:
      error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});
