/**
 * Claude 授权服务
 * 参照 WPF 的 VerifyAuthenticationAsync 和 HandleAuthRequired 方法
 *
 * 功能：
 * - 检测 Claude CLI 授权状态
 * - 处理授权请求
 * - 提供授权流程引导
 */

import { IPCChannels } from '@shared/types/ipc.types';

export interface AuthStatus {
  isAuthenticated: boolean;
  message?: string;
  cliVersion?: string;
}

/**
 * 检查 Claude CLI 授权状态
 * 参照 WPF 的 VerifyAuthenticationAsync
 */
export async function checkClaudeAuthStatus(): Promise<AuthStatus> {
  try {
    console.log('[AuthService] 检查 Claude CLI 授权状态...');

    // 调用 claude auth status 命令
    const result = await window.electronAPI.invoke(IPCChannels.CLAUDE_AUTH_STATUS);

    if (result.success) {
      console.log('[AuthService] 已授权');
      return {
        isAuthenticated: true,
        message: '已授权',
        cliVersion: result.version,
      };
    } else {
      console.log('[AuthService] 未授权:', result.error);
      return {
        isAuthenticated: false,
        message: result.error || '未授权',
      };
    }
  } catch (error) {
    console.error('[AuthService] 检查授权状态失败:', error);
    return {
      isAuthenticated: false,
      message: error instanceof Error ? error.message : '检查授权状态失败',
    };
  }
}

/**
 * 启动 Claude CLI 授权流程
 * 参照 WPF 的 OnStartAuth 方法
 */
export async function startClaudeAuth(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[AuthService] 启动 Claude CLI 授权流程...');

    // 调用 claude auth 命令
    const result = await window.electronAPI.invoke(IPCChannels.CLAUDE_AUTH);

    if (result.success) {
      console.log('[AuthService] 授权成功');
      return {
        success: true,
        message: '授权成功！现在可以开始使用 Claude AI 助手了。',
      };
    } else {
      console.error('[AuthService] 授权失败:', result.error);
      return {
        success: false,
        message: result.error || '授权失败，请重试',
      };
    }
  } catch (error) {
    console.error('[AuthService] 授权流程异常:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '授权流程异常',
    };
  }
}

/**
 * 获取授权引导消息
 * 参照 WPF 的授权提示消息
 */
export function getAuthGuidanceMessage(): string {
  return `🔐 需要授权才能使用 Claude AI

请按照以下步骤完成授权：

1️⃣ 点击下方「启动授权」按钮
2️⃣ 在打开的浏览器中登录 Anthropic 账号
3️⃣ 复制生成的授权令牌
4️⃣ 粘贴令牌并确认

📌 需要 Claude Pro 或 Claude Team 订阅

如果已完成授权，请重新尝试发送消息。`;
}

/**
 * 获取授权成功消息
 */
export function getAuthSuccessMessage(version?: string): string {
  return `✅ Claude CLI 授权成功！

版本: ${version || '未知'}
授权状态: 已授权

🎉 现在可以开始使用 Claude AI 助手了

💡 提示：如果遇到问题，请尝试刷新页面`;
}

/**
 * 检测响应中是否包含授权错误
 * 参照 WPF 的 ClaudePermissionDetector
 */
export function detectAuthError(errorMessage: string): boolean {
  const authErrorPatterns = [
    'not authenticated',
    'authentication required',
    'unauthorized',
    'invalid api key',
    'missing credentials',
    'auth token',
  ];

  const lowerMessage = errorMessage.toLowerCase();
  return authErrorPatterns.some((pattern) => lowerMessage.includes(pattern));
}
