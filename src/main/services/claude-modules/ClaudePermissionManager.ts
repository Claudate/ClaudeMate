/**
 * Claude Permission Manager - 权限管理模块
 * 负责处理手动授权模式下的权限请求和响应
 */

import { ChildProcess } from 'child_process';
import { BaseClaudeModule } from './BaseClaudeModule';

export interface PermissionRequest {
  id: string;
  sessionId: string;
  toolName: string;
  action: string;
  timestamp: number;
}

export class ClaudePermissionManager extends BaseClaudeModule {
  constructor() {
    super('PermissionManager');
  }

  /**
   * 检测 stderr 输出中的授权请求
   */
  public detectPermissionRequest(
    chunk: string,
    sessionId: string
  ): PermissionRequest | null {
    // Claude CLI 授权请求的特征模式
    const permissionPatterns = [
      // 工具使用授权
      /approve.*?(write|edit|create|delete|bash|execute|read|glob|grep|task)/i,
      /permission.*?(write|edit|create|delete|bash|read|glob|grep|task)/i,
      /allow.*?(write|edit|create|delete|bash|execute|read|glob|grep|task)/i,
      // 文件操作授权
      /do you want to.*?(write|edit|create|delete|read).*?file/i,
      /confirm.*?(write|edit|create|delete).*?file/i,
      // 命令执行授权
      /execute.*?command/i,
      /run.*?(command|script)/i,
      // 通用授权提示
      /\(y\/n\)/i,
      /continue\?/i,
    ];

    for (const pattern of permissionPatterns) {
      if (pattern.test(chunk)) {
        // 尝试解析工具名称
        let toolName = 'Unknown';
        const toolMatch = chunk.match(/(Write|Edit|Read|Bash|Glob|Grep|Task|Delete|Create)/i);
        if (toolMatch) {
          toolName = toolMatch[1];
        }

        this.logger.warn(`检测到授权请求 (${toolName}): ${chunk.substring(0, 100)}`);

        return {
          id: `${sessionId}-${Date.now()}`,
          sessionId,
          toolName,
          action: chunk.trim(),
          timestamp: Date.now(),
        };
      }
    }

    return null;
  }

  /**
   * 响应授权请求
   */
  public respondToPermission(
    process: ChildProcess,
    sessionId: string,
    approved: boolean
  ): boolean {
    if (process && process.stdin && !process.killed) {
      // 向 Claude CLI 的 stdin 发送授权响应
      const response = approved ? 'y\n' : 'n\n';
      process.stdin.write(response);
      this.logger.info(
        `发送授权响应: ${approved ? 'approved' : 'denied'} for session ${sessionId}`
      );
      return true;
    }

    this.logger.warn(
      `无法发送授权响应: session ${sessionId} not found or stdin not available`
    );
    return false;
  }
}
