/**
 * SessionStatistics - 会话统计模块
 * 职责：计算全局会话统计信息
 */

import { BaseStorageModule } from './BaseStorageModule';
import { ChatSessionMetadata, SessionStatistics } from '@shared/types/domain.types';

export class SessionStatisticsModule extends BaseStorageModule {
  constructor(baseStoragePath: string) {
    super('SessionStatistics', baseStoragePath);
  }

  /**
   * 获取全局会话统计信息
   */
  async getGlobalSessionStatisticsAsync(
    allSessions: ChatSessionMetadata[],
    projectNames: string[]
  ): Promise<SessionStatistics> {
    const stats: SessionStatistics = {
      projectCount: projectNames.length,
      totalSessions: allSessions.length,
      totalMessages: allSessions.reduce((sum, s) => sum + s.messageCount, 0),
      totalFileSize: allSessions.reduce((sum, s) => sum + s.fileSize, 0),
      totalTokens: allSessions.reduce((sum, s) => sum + s.totalTokens, 0),
    };

    if (allSessions.length > 0) {
      const dates = allSessions.map(s => new Date(s.createdAt).getTime());
      stats.earliestSession = new Date(Math.min(...dates)).toISOString();
      stats.latestSession = new Date(Math.max(...dates.map((_, i) =>
        new Date(allSessions[i].modifiedAt).getTime()
      ))).toISOString();

      // 按项目分组统计
      const projectStats: Record<string, any> = {};
      allSessions.forEach(s => {
        if (!projectStats[s.projectName]) {
          projectStats[s.projectName] = {
            sessionCount: 0,
            messageCount: 0,
            fileSize: 0,
            lastModified: s.modifiedAt,
          };
        }

        projectStats[s.projectName].sessionCount++;
        projectStats[s.projectName].messageCount += s.messageCount;
        projectStats[s.projectName].fileSize += s.fileSize;

        if (new Date(s.modifiedAt) > new Date(projectStats[s.projectName].lastModified)) {
          projectStats[s.projectName].lastModified = s.modifiedAt;
        }
      });

      stats.projectStatistics = projectStats;
    }

    return stats;
  }
}
