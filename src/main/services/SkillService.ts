/**
 * Skill Service
 * Scans and parses Claude Skills from project directories
 * Supports multiple sources: project/.claude/skills, built-in templates, user-defined
 */

import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { Logger } from '../utils/Logger';

const logger = Logger.getInstance('SkillService');

/**
 * Skill Definition
 */
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: 'coding' | 'writing' | 'analysis' | 'automation' | 'custom';
  source: 'project' | 'builtin' | 'user';

  // File information
  filePath?: string;
  content?: string;

  // Parsed metadata
  prompt?: string;
  context?: string[];  // Files/directories to include
  tags?: string[];

  // Project association
  projectPath?: string;
  projectName?: string;

  createdAt: number;
  updatedAt: number;
}

export class SkillService {
  private static instance: SkillService;

  private constructor() {}

  public static getInstance(): SkillService {
    if (!SkillService.instance) {
      SkillService.instance = new SkillService();
    }
    return SkillService.instance;
  }

  /**
   * Scan project for skills
   */
  public async scanProjectSkills(projectPath: string): Promise<SkillDefinition[]> {
    const skills: SkillDefinition[] = [];
    const skillsDir = join(projectPath, '.claude', 'skills');

    try {
      // Check if .claude/skills exists
      const exists = await fs.access(skillsDir).then(() => true).catch(() => false);
      if (!exists) {
        logger.info(`No skills directory found at ${skillsDir}`);
        return skills;
      }

      // Read all .md files
      const files = await fs.readdir(skillsDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const file of mdFiles) {
        const filePath = join(skillsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Get file stats for timestamps
        const stats = await fs.stat(filePath);

        // Parse skill metadata
        const skill = this.parseSkillFile(filePath, content, projectPath, stats);
        if (skill) {
          skills.push(skill);
        }
      }

      logger.info(`Found ${skills.length} skills in ${projectPath}`);
    } catch (error) {
      logger.error(`Failed to scan skills in ${projectPath}:`, error);
    }

    return skills;
  }

  /**
   * Parse Skill file (Markdown format)
   */
  private parseSkillFile(filePath: string, content: string, projectPath: string, stats?: { birthtimeMs: number; mtimeMs: number }): SkillDefinition | null {
    try {
      const fileName = basename(filePath, '.md');

      // Extract frontmatter (YAML-like metadata)
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      let metadata: any = {};

      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        // Simple YAML parser (key: value format)
        frontmatter.split('\n').forEach(line => {
          const match = line.match(/^(\w+):\s*(.+)$/);
          if (match) {
            const [, key, value] = match;
            metadata[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes
          }
        });
      }

      // Extract prompt (first heading or content after frontmatter)
      const contentWithoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
      const promptMatch = contentWithoutFrontmatter.match(/^#\s+(.+)/m);

      // Extract project name from path
      const projectName = basename(projectPath);

      return {
        id: this.generateSkillId(filePath),
        name: metadata.name || promptMatch?.[1] || fileName,
        description: metadata.description || contentWithoutFrontmatter.substring(0, 200),
        category: metadata.category || 'custom',
        source: 'project',
        filePath,
        content,
        prompt: contentWithoutFrontmatter,
        context: metadata.context ? metadata.context.split(',').map((s: string) => s.trim()) : [],
        tags: metadata.tags ? metadata.tags.split(',').map((s: string) => s.trim()) : [],
        projectPath,
        projectName,
        createdAt: stats?.birthtimeMs || Date.now(),
        updatedAt: stats?.mtimeMs || Date.now(),
      };
    } catch (error) {
      logger.error(`Failed to parse skill file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get built-in skills
   */
  public getBuiltinSkills(): SkillDefinition[] {
    const now = Date.now();

    return [
      {
        id: 'builtin-code-review',
        name: 'Code Review',
        description: 'Review code for quality, security, and best practices',
        category: 'coding',
        source: 'builtin',
        prompt: `Please review this code for:
1. Code quality and readability
2. Potential bugs and edge cases
3. Security vulnerabilities
4. Performance issues
5. Best practices and improvements`,
        context: ['src/**/*.ts', 'src/**/*.tsx'],
        tags: ['review', 'quality', 'security'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'builtin-refactor',
        name: 'Refactor Code',
        description: 'Refactor code to improve structure and maintainability',
        category: 'coding',
        source: 'builtin',
        prompt: `Please refactor this code to:
1. Improve code structure and organization
2. Reduce complexity and duplication
3. Apply design patterns where appropriate
4. Maintain existing functionality
5. Add proper documentation`,
        tags: ['refactor', 'quality'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'builtin-document',
        name: 'Generate Documentation',
        description: 'Generate comprehensive documentation for code',
        category: 'writing',
        source: 'builtin',
        prompt: `Please generate documentation for this code including:
1. Overview and purpose
2. API/Interface documentation
3. Usage examples
4. Parameter descriptions
5. Return value documentation`,
        tags: ['documentation', 'writing'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'builtin-test',
        name: 'Generate Tests',
        description: 'Generate unit tests for code',
        category: 'coding',
        source: 'builtin',
        prompt: `Please generate comprehensive unit tests including:
1. Test cases for normal functionality
2. Edge case testing
3. Error handling tests
4. Mock setup if needed
5. Clear test descriptions`,
        tags: ['testing', 'quality'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'builtin-explain',
        name: 'Explain Code',
        description: 'Explain how code works in detail',
        category: 'analysis',
        source: 'builtin',
        prompt: `Please explain this code in detail:
1. What the code does
2. How it works step by step
3. Key concepts and patterns used
4. Dependencies and interactions
5. Potential improvements`,
        tags: ['explain', 'analysis'],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  /**
   * Get all skills for a project
   */
  public async getAllSkills(projectPath?: string): Promise<SkillDefinition[]> {
    const skills: SkillDefinition[] = [];

    // Always include built-in skills
    skills.push(...this.getBuiltinSkills());

    // Include project skills if project path provided
    if (projectPath) {
      const projectSkills = await this.scanProjectSkills(projectPath);
      skills.push(...projectSkills);
    }

    return skills;
  }

  /**
   * Generate unique skill ID (stable based on file path)
   */
  private generateSkillId(filePath: string): string {
    const fileName = basename(filePath, '.md');
    // 使用文件路径的哈希来生成稳定的 ID
    const hash = this.simpleHash(filePath);
    return `project-${fileName}-${hash}`;
  }

  /**
   * Simple hash function for generating stable IDs
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
