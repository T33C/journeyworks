/**
 * Skill Manager Service
 *
 * Loads, parses, and manages skill definitions from .skill.md markdown files.
 * Provides skill discovery and filtering for the conversational agent.
 *
 * Skill files live in src/modules/research/skills/ and use YAML frontmatter
 * to declare metadata (name, executor, category) with a markdown body that
 * contains the description, trigger phrases, and example queries.
 *
 * This is adapted from the Anthropic-devised "embedded tool discovery" pattern
 * used in the trade-search reference app, but without the vector-based semantic
 * layer (which becomes valuable at 30+ tools). Currently all 19 skills are
 * loaded and available; the enabledTools filter on ResearchRequest allows
 * per-request scoping.
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillCategory, SkillDefinition, SkillSummary } from './skill.types';
import { AgentTools } from './agent-tools.service';

@Injectable()
export class SkillManagerService implements OnModuleInit {
  private readonly logger = new Logger(SkillManagerService.name);
  private readonly skills = new Map<string, SkillDefinition>();

  /** Absolute path to the skills directory */
  private readonly skillsPath: string;

  constructor(
    @Inject(forwardRef(() => AgentTools))
    private readonly agentTools: AgentTools,
  ) {
    // Skills are .md source files — resolve from compiled dist back to src
    // From dist/src/modules/research/ → src/modules/research/skills/
    const distDir = __dirname;
    const projectRoot = path.resolve(distDir, '../../../../');
    this.skillsPath = path.resolve(projectRoot, 'src/modules/research/skills');
  }

  async onModuleInit(): Promise<void> {
    await this.loadSkillsFromDirectory();
    this.logger.log(
      `Loaded ${this.skills.size} skills from ${this.skillsPath}`,
    );
    this.validateSkillToolAlignment();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get all loaded skill definitions
   */
  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get a single skill by name
   */
  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * Get skills filtered to a specific set of names.
   * If `names` is undefined or empty, returns ALL skills.
   */
  getSkillsByNames(names?: string[]): SkillDefinition[] {
    if (!names || names.length === 0) {
      return this.getAllSkills();
    }
    const nameSet = new Set(names);
    return this.getAllSkills().filter(
      (s) => nameSet.has(s.name) || nameSet.has(s.executor),
    );
  }

  /**
   * Get skills filtered by category
   */
  getSkillsByCategory(category: SkillCategory): SkillDefinition[] {
    return this.getAllSkills().filter((s) => s.category === category);
  }

  /**
   * Build lightweight skill summaries for prompt injection.
   * Optionally filter to only the specified tool names.
   */
  getSkillSummaries(enabledTools?: string[]): SkillSummary[] {
    const skills = this.getSkillsByNames(enabledTools);
    return skills.map((s) => ({
      name: s.name,
      description: s.description,
      examples: s.examples,
      category: this.formatCategory(s.category),
    }));
  }

  /**
   * Format skill summaries into the "Your Capabilities" prompt section.
   * Groups skills by category with descriptions and example questions.
   */
  formatCapabilitiesPrompt(enabledTools?: string[]): string {
    const skills = this.getSkillsByNames(enabledTools);

    // Group by category
    const groups = new Map<SkillCategory, SkillDefinition[]>();
    for (const skill of skills) {
      const bucket = groups.get(skill.category) || [];
      bucket.push(skill);
      groups.set(skill.category, bucket);
    }

    // Ordered categories
    const categoryOrder: SkillCategory[] = [
      SkillCategory.INFORMATION_RETRIEVAL,
      SkillCategory.SENTIMENT_TOPIC_ANOMALY,
      SkillCategory.CUSTOMER_HEALTH_RISK,
      SkillCategory.OPERATIONAL_ANALYTICS,
    ];

    const sections: string[] = [];
    for (const cat of categoryOrder) {
      const bucket = groups.get(cat);
      if (!bucket || bucket.length === 0) continue;

      sections.push(`**${this.formatCategory(cat)}**`);
      for (const skill of bucket) {
        const exampleLines =
          skill.examples.length > 0
            ? `\n  Example questions: ${skill.examples.map((e) => `"${e}"`).join(', ')}`
            : '';
        sections.push(`- ${skill.name}: ${skill.description}${exampleLines}`);
      }
    }

    return sections.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Loading & Parsing
  // ---------------------------------------------------------------------------

  /**
   * Cross-validate that every skill has a matching registered tool and
   * every registered tool has a matching skill file.
   * Logs warnings for any mismatches — does not throw.
   */
  private validateSkillToolAlignment(): void {
    const toolNames = new Set(this.agentTools.getToolNames());
    const skillExecutors = new Set(this.getAllSkills().map((s) => s.executor));

    // Skills referencing tools that don't exist
    for (const skill of this.getAllSkills()) {
      if (!toolNames.has(skill.executor)) {
        this.logger.warn(
          `Skill "${skill.name}" references executor "${skill.executor}" which is not a registered tool`,
        );
      }
    }

    // Tools without a matching skill file
    for (const toolName of toolNames) {
      if (!skillExecutors.has(toolName)) {
        this.logger.warn(
          `Tool "${toolName}" has no matching .skill.md file — it will be missing from the capabilities prompt`,
        );
      }
    }
  }

  /**
   * Load all .skill.md files from the skills directory
   */
  async loadSkillsFromDirectory(): Promise<void> {
    try {
      const files = await fs.readdir(this.skillsPath);
      const skillFiles = files.filter((f) => f.endsWith('.skill.md'));

      for (const file of skillFiles) {
        try {
          const filePath = path.join(this.skillsPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const skill = this.parseSkillMarkdown(content, filePath);

          if (skill) {
            this.skills.set(skill.name, skill);
            this.logger.debug(
              `Loaded skill: ${skill.name} (${skill.category})`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Failed to load skill from ${file}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to read skills directory: ${error.message}`);
    }
  }

  /**
   * Parse a .skill.md file into a SkillDefinition.
   * Uses lightweight inline parsing — no js-yaml dependency required.
   */
  private parseSkillMarkdown(
    content: string,
    filePath: string,
  ): SkillDefinition | null {
    try {
      // Extract YAML frontmatter between --- delimiters
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) {
        this.logger.warn(`No frontmatter found in ${filePath}`);
        return null;
      }

      const frontmatter = this.parseSimpleYaml(fmMatch[1]);
      const body = content.slice(fmMatch[0].length).trim();

      const name = frontmatter.name;
      const executor = frontmatter.executor || name;
      const category = this.parseCategory(frontmatter.category);

      if (!name) {
        this.logger.warn(`Skill missing name in ${filePath}`);
        return null;
      }

      // Parse markdown sections
      const description = this.extractSection(body, 'Description');
      const whenToUse = this.extractListItems(body, 'When to Use');
      const examples = this.extractListItems(body, 'Examples');

      return {
        name,
        executor,
        category,
        description: description || `Tool: ${name}`,
        whenToUse,
        examples,
        filePath,
      };
    } catch (error) {
      this.logger.error(`Failed to parse skill ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Minimal YAML parser for simple key: value frontmatter.
   * Handles string values (quoted or unquoted). No nested objects needed.
   */
  private parseSimpleYaml(yaml: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of yaml.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const key = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();
      // Strip quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  }

  /**
   * Extract a markdown section's paragraph content.
   * Looks for ## SectionName and reads until next ## or end.
   */
  private extractSection(body: string, sectionName: string): string {
    const regex = new RegExp(
      `##\\s+${sectionName}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
      'i',
    );
    const match = body.match(regex);
    if (!match) return '';
    // Collapse to a single paragraph, stripping list markers
    return match[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('-'))
      .join(' ')
      .trim();
  }

  /**
   * Extract bullet-point list items from a markdown section.
   */
  private extractListItems(body: string, sectionName: string): string[] {
    const regex = new RegExp(
      `##\\s+${sectionName}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
      'i',
    );
    const match = body.match(regex);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) =>
        l
          .slice(2)
          .replace(/^"(.*)"$/, '$1')
          .trim(),
      );
  }

  /**
   * Map a category string from frontmatter to the enum
   */
  private parseCategory(raw: string): SkillCategory {
    const upper = (raw || '').toUpperCase().replace(/-/g, '_');
    if (upper in SkillCategory) {
      return SkillCategory[upper as keyof typeof SkillCategory];
    }
    this.logger.warn(
      `Unknown category "${raw}", defaulting to INFORMATION_RETRIEVAL`,
    );
    return SkillCategory.INFORMATION_RETRIEVAL;
  }

  /**
   * Human-friendly category label
   */
  private formatCategory(category: SkillCategory): string {
    const labels: Record<SkillCategory, string> = {
      [SkillCategory.INFORMATION_RETRIEVAL]: 'Information Retrieval',
      [SkillCategory.SENTIMENT_TOPIC_ANOMALY]:
        'Sentiment, Topic & Anomaly Analysis',
      [SkillCategory.CUSTOMER_HEALTH_RISK]: 'Customer Health & Risk',
      [SkillCategory.OPERATIONAL_ANALYTICS]: 'Operational Analytics',
    };
    return labels[category] || category;
  }
}
