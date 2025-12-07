/**
 * SessionSearcher - 会话搜索模块
 * 职责：会话搜索功能（标题、项目名、消息内容）
 */

import { BaseStorageModule } from './BaseStorageModule';
import { ChatSessionMetadata } from '@shared/types/domain.types';

export class SessionSearcher extends BaseStorageModule {
  constructor(baseStoragePath: string) {
    super('SessionSearcher', baseStoragePath);
  }

  /**
   * 搜索会话（标题/项目名）
   * @param allSessions 所有会话列表
   * @param keyword 搜索关键词
   * @param projectName 项目名称（用于过滤，非项目路径）
   */
  async searchSessionsAsync(
    allSessions: ChatSessionMetadata[],
    keyword: string,
    projectName?: string
  ): Promise<ChatSessionMetadata[]> {
    // 如果提供了项目名称，先过滤项目
    let filtered = allSessions;
    if (projectName) {
      filtered = allSessions.filter(s => s.projectName === projectName);
      this.logger.info(`按项目名称过滤: "${projectName}", 结果: ${filtered.length} 个会话`);
    }

    // 如果没有关键词，返回所有（已过滤项目的）会话
    if (!keyword || keyword.trim() === '') {
      return filtered;
    }

    // 按关键词搜索标题和项目名
    const lowerKeyword = keyword.toLowerCase();
    const results = filtered.filter(s =>
      s.title.toLowerCase().includes(lowerKeyword) ||
      s.projectName.toLowerCase().includes(lowerKeyword)
    );

    this.logger.info(`搜索关键词 "${keyword}" (项目: ${projectName || '全部'}): ${results.length} 个结果`);
    return results;
  }

  /**
   * 根据消息内容搜索会话（深度搜索）
   * @param allSessions 所有会话列表
   * @param keyword 搜索关键词
   * @param projectName 项目名称（用于过滤，非项目路径）
   * @param getSessionFunc 获取完整会话的函数
   */
  async searchSessionsByMessageContentAsync(
    allSessions: ChatSessionMetadata[],
    keyword: string,
    projectName: string | undefined,
    getSessionFunc: (projectPath: string, sessionId: string) => Promise<any>
  ): Promise<ChatSessionMetadata[]> {
    // 如果提供了项目名称，先过滤项目
    let filtered = allSessions;
    if (projectName) {
      filtered = allSessions.filter(s => s.projectName === projectName);
      this.logger.info(`消息搜索 - 按项目名称过滤: "${projectName}", ${filtered.length} 个会话`);
    }

    // 如果没有关键词，返回所有（已过滤项目的）会话
    if (!keyword || keyword.trim() === '') {
      return filtered;
    }

    const lowerKeyword = keyword.toLowerCase();

    // 并行搜索所有会话
    const searchPromises = filtered.map(async (sessionMeta) => {
      try {
        const session = await getSessionFunc(sessionMeta.projectPath, sessionMeta.id);
        if (!session) return null;

        const hasMatch = session.messages.some((m: any) =>
          m.content && m.content.toLowerCase().includes(lowerKeyword)
        );

        return hasMatch ? sessionMeta : null;
      } catch (error) {
        this.logger.error(`搜索会话消息失败 ${sessionMeta.id}:`, error);
        return null;
      }
    });

    const results = await Promise.all(searchPromises);
    return results.filter(r => r !== null) as ChatSessionMetadata[];
  }
}
