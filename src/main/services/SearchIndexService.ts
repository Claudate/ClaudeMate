/**
 * Search Index Service
 * 基于 SQLite FTS5 的全文搜索索引服务
 * 支持中英日多语言分词搜索
 */

import * as path from 'path';
import * as fs from 'fs';
import { ChatSessionMetadata } from '@shared/types/domain.types';
import { MultiLangTokenizer } from './MultiLangTokenizer';
import { Logger } from '../utils/Logger';

// 使用 require 导入 better-sqlite3（避免 TypeScript 类型检查错误）
const Database = require('better-sqlite3');

const logger = Logger.getInstance('SearchIndexService');

export interface SearchResult extends ChatSessionMetadata {
  relevanceScore: number; // 相关度评分
  matchedContent?: string; // 匹配的内容片段（用于高亮显示）
}

export interface SearchOptions {
  limit?: number; // 返回结果数量限制
  offset?: number; // 分页偏移
  projectPath?: string; // 按项目过滤
  sortBy?: 'relevance' | 'time'; // 排序方式
}

export class SearchIndexService {
  private static instance: SearchIndexService;
  private db: any; // Database 实例
  private tokenizer: MultiLangTokenizer;

  private constructor(dbPath?: string) {
    const defaultDbPath = path.join(process.cwd(), 'ChatHistory', 'search_index.db');
    const finalDbPath = dbPath || defaultDbPath;

    // 确保目录存在
    const dir = path.dirname(finalDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(finalDbPath);
    this.tokenizer = MultiLangTokenizer.getInstance();

    this.initialize();
    logger.info(`[SearchIndexService] 初始化完成，数据库路径: ${finalDbPath}`);
  }

  static getInstance(dbPath?: string): SearchIndexService {
    if (!SearchIndexService.instance) {
      SearchIndexService.instance = new SearchIndexService(dbPath);
    }
    return SearchIndexService.instance;
  }

  /**
   * 初始化数据库表结构
   */
  private initialize(): void {
    // 创建 FTS5 全文搜索表
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
        session_id UNINDEXED,
        title,
        project_name,
        content,
        tokenize = 'unicode61 remove_diacritics 0'
      );
    `);

    // 创建元数据表（存储完整的会话元数据，用于搜索结果展示）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions_metadata (
        session_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        indexed_at INTEGER NOT NULL
      );
    `);

    logger.info('[SearchIndexService] 数据库表结构初始化完成');
  }

  /**
   * 索引单个会话
   */
  public indexSession(session: ChatSessionMetadata, messages: string[]): void {
    try {
      // 1. 对标题和消息内容进行分词
      const titleTokens = this.tokenizer.tokenize(session.title).join(' ');
      const projectNameTokens = this.tokenizer.tokenize(session.projectName).join(' ');
      const contentTokens = this.tokenizer.tokenizeBatch(messages).join(' ');

      // 2. 删除旧索引（如果存在）
      this.db.prepare('DELETE FROM sessions_fts WHERE session_id = ?').run(session.id);
      this.db.prepare('DELETE FROM sessions_metadata WHERE session_id = ?').run(session.id);

      // 3. 插入 FTS5 索引
      this.db
        .prepare(
          `INSERT INTO sessions_fts (session_id, title, project_name, content) VALUES (?, ?, ?, ?)`
        )
        .run(session.id, titleTokens, projectNameTokens, contentTokens);

      // 4. 插入元数据
      this.db
        .prepare(
          `INSERT INTO sessions_metadata (session_id, data, indexed_at) VALUES (?, ?, ?)`
        )
        .run(session.id, JSON.stringify(session), Date.now());

      logger.info(`[SearchIndexService] 会话已索引: ${session.id} (${session.title})`);
    } catch (error) {
      logger.error(`[SearchIndexService] 索引会话失败 ${session.id}:`, error);
      throw error;
    }
  }

  /**
   * 批量索引会话
   */
  public indexSessionsBatch(sessions: Array<{ session: ChatSessionMetadata; messages: string[] }>): void {
    const insertFts = this.db.prepare(
      `INSERT OR REPLACE INTO sessions_fts (session_id, title, project_name, content) VALUES (?, ?, ?, ?)`
    );
    const insertMetadata = this.db.prepare(
      `INSERT OR REPLACE INTO sessions_metadata (session_id, data, indexed_at) VALUES (?, ?, ?)`
    );

    const transaction = this.db.transaction((items: Array<{ session: ChatSessionMetadata; messages: string[] }>) => {
      for (const { session, messages } of items) {
        const titleTokens = this.tokenizer.tokenize(session.title).join(' ');
        const projectNameTokens = this.tokenizer.tokenize(session.projectName).join(' ');
        const contentTokens = this.tokenizer.tokenizeBatch(messages).join(' ');

        insertFts.run(session.id, titleTokens, projectNameTokens, contentTokens);
        insertMetadata.run(session.id, JSON.stringify(session), Date.now());
      }
    });

    try {
      transaction(sessions);
      logger.info(`[SearchIndexService] 批量索引完成，共 ${sessions.length} 个会话`);
    } catch (error) {
      logger.error('[SearchIndexService] 批量索引失败:', error);
      throw error;
    }
  }

  /**
   * 删除会话索引
   */
  public deleteSession(sessionId: string): void {
    try {
      this.db.prepare('DELETE FROM sessions_fts WHERE session_id = ?').run(sessionId);
      this.db.prepare('DELETE FROM sessions_metadata WHERE session_id = ?').run(sessionId);
      logger.info(`[SearchIndexService] 会话索引已删除: ${sessionId}`);
    } catch (error) {
      logger.error(`[SearchIndexService] 删除会话索引失败 ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * 全文搜索
   */
  public search(query: string, options: SearchOptions = {}): SearchResult[] {
    const { limit = 50, offset = 0, projectPath, sortBy = 'relevance' } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      // 1. 对查询进行分词
      const queryTokens = this.tokenizer.tokenizeQuery(query);
      if (queryTokens.length === 0) {
        return [];
      }

      // 2. 构建 FTS5 查询表达式（使用 OR 连接，任意词匹配即可）
      const ftsQuery = queryTokens.map((token) => `"${token}"`).join(' OR ');

      // 3. 执行搜索
      let sql = `
        SELECT
          sessions_fts.session_id,
          sessions_metadata.data,
          rank as relevanceScore
        FROM sessions_fts
        INNER JOIN sessions_metadata ON sessions_fts.session_id = sessions_metadata.session_id
        WHERE sessions_fts MATCH ?
      `;

      const params: any[] = [ftsQuery];

      // 4. 项目过滤（如果指定）
      if (projectPath) {
        sql += ` AND json_extract(sessions_metadata.data, '$.projectPath') = ?`;
        params.push(projectPath);
      }

      // 5. 排序
      if (sortBy === 'relevance') {
        sql += ` ORDER BY rank`;
      } else if (sortBy === 'time') {
        sql += ` ORDER BY json_extract(sessions_metadata.data, '$.modifiedAt') DESC`;
      }

      // 6. 分页
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = this.db.prepare(sql).all(...params) as Array<{
        session_id: string;
        data: string;
        relevanceScore: number;
      }>;

      // 7. 解析结果
      const results: SearchResult[] = rows.map((row) => {
        const session = JSON.parse(row.data) as ChatSessionMetadata;
        return {
          ...session,
          relevanceScore: Math.abs(row.relevanceScore), // rank 是负数，取绝对值
        };
      });

      logger.info(`[SearchIndexService] 搜索完成: "${query}" 找到 ${results.length} 个结果`);
      return results;
    } catch (error) {
      logger.error(`[SearchIndexService] 搜索失败:`, error);
      return [];
    }
  }

  /**
   * 清空所有索引
   */
  public clearAll(): void {
    try {
      this.db.exec('DELETE FROM sessions_fts');
      this.db.exec('DELETE FROM sessions_metadata');
      logger.info('[SearchIndexService] 所有索引已清空');
    } catch (error) {
      logger.error('[SearchIndexService] 清空索引失败:', error);
      throw error;
    }
  }

  /**
   * ⭐⭐⭐ 获取所有会话（从 SQLite）
   * @param projectPath 可选，按项目路径过滤
   * @returns 会话元数据数组，按修改时间降序排列
   */
  public getAllSessions(projectPath?: string): ChatSessionMetadata[] {
    try {
      let sql = `SELECT data FROM sessions_metadata`;
      const params: any[] = [];

      // 按项目过滤
      if (projectPath) {
        sql += ` WHERE json_extract(data, '$.projectPath') = ?`;
        params.push(projectPath);
      }

      // 按修改时间降序排序
      sql += ` ORDER BY json_extract(data, '$.modifiedAt') DESC`;

      const rows = this.db.prepare(sql).all(...params) as Array<{ data: string }>;

      const sessions = rows.map(row => JSON.parse(row.data) as ChatSessionMetadata);

      logger.info(`[SearchIndexService] 获取会话列表: ${sessions.length} 个会话${projectPath ? ` (项目: ${projectPath})` : ''}`);
      return sessions;
    } catch (error) {
      logger.error('[SearchIndexService] 获取会话列表失败:', error);
      return [];
    }
  }

  /**
   * ⭐⭐⭐ 获取所有项目名称（从 SQLite）
   * @returns 去重的项目名称数组
   */
  public getAllProjectNames(): string[] {
    try {
      const sql = `
        SELECT DISTINCT json_extract(data, '$.projectName') as project_name
        FROM sessions_metadata
        WHERE json_extract(data, '$.projectName') IS NOT NULL
        ORDER BY project_name
      `;

      const rows = this.db.prepare(sql).all() as Array<{ project_name: string }>;
      const projectNames = rows.map(row => row.project_name);

      logger.info(`[SearchIndexService] 获取项目名称列表: ${projectNames.length} 个项目`);
      return projectNames;
    } catch (error) {
      logger.error('[SearchIndexService] 获取项目名称失败:', error);
      return [];
    }
  }

  /**
   * 获取索引统计信息
   */
  public getStatistics(): {
    totalSessions: number;
    totalTokens: number;
    dbSize: number;
  } {
    try {
      const totalSessions = this.db
        .prepare('SELECT COUNT(*) as count FROM sessions_metadata')
        .get() as { count: number };

      const dbSize = fs.statSync(this.db.name).size;

      return {
        totalSessions: totalSessions.count,
        totalTokens: 0, // FTS5 不提供 token 统计
        dbSize,
      };
    } catch (error) {
      logger.error('[SearchIndexService] 获取统计信息失败:', error);
      return { totalSessions: 0, totalTokens: 0, dbSize: 0 };
    }
  }

  /**
   * 关闭数据库连接
   */
  public close(): void {
    try {
      this.db.close();
      logger.info('[SearchIndexService] 数据库连接已关闭');
    } catch (error) {
      logger.error('[SearchIndexService] 关闭数据库失败:', error);
    }
  }
}
