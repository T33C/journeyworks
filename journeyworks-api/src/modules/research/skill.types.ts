/**
 * Skill Types
 *
 * Type definitions for the skill definition system.
 * Skills are authored as .skill.md markdown files and loaded at startup.
 */

/**
 * Skill categories — maps to the four tool groups
 */
export enum SkillCategory {
  INFORMATION_RETRIEVAL = 'INFORMATION_RETRIEVAL',
  SENTIMENT_TOPIC_ANOMALY = 'SENTIMENT_TOPIC_ANOMALY',
  CUSTOMER_HEALTH_RISK = 'CUSTOMER_HEALTH_RISK',
  OPERATIONAL_ANALYTICS = 'OPERATIONAL_ANALYTICS',
}

/**
 * A skill definition loaded from a .skill.md file
 */
export interface SkillDefinition {
  /** Unique skill name (matches the executor/tool name) */
  name: string;
  /** The tool name to execute (from YAML frontmatter) */
  executor: string;
  /** Skill category */
  category: SkillCategory;
  /** Human-readable description (from markdown body) */
  description: string;
  /** Trigger phrases — when should the agent use this skill */
  whenToUse: string[];
  /** Example queries that demonstrate usage */
  examples: string[];
  /** Path to the .skill.md source file */
  filePath: string;
}

/**
 * Lightweight summary of a skill for prompt injection
 */
export interface SkillSummary {
  /** Skill name */
  name: string;
  /** Short description */
  description: string;
  /** Example queries */
  examples: string[];
  /** Category label */
  category: string;
}
