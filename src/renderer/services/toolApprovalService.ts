/**
 * Tool Approval Service
 * 工具使用授权服务（参照 WPF 的 ClaudePermissionDetector 和 FilePermissionDialog）
 *
 * 功能：
 * - 检测 Claude CLI 的权限请求（permission_denials）
 * - 显示授权对话框
 * - 管理授权记录和统计
 */

/**
 * 权限请求信息（参照 WPF 的 PermissionRequest）
 */
export interface ToolApprovalRequest {
  isPermissionRequest: boolean;    // 是否需要权限
  toolName: string;                 // 工具名称（Write, Bash, Read 等）
  toolUseId: string;                // 工具使用 ID
  filePath?: string;                // 文件路径（文件操作）
  content?: string;                 // 文件内容（写入操作）
  command?: string;                 // 命令（Bash 工具）
  pattern?: string;                 // 搜索模式（Grep 工具）
  url?: string;                     // URL（WebFetch 工具）
  message: string;                  // Claude 的文本回复
  rawJson?: string;                 // 原始 JSON 输出
}

/**
 * 授权统计信息（参照 WPF 的 PermissionStats）
 */
export interface ToolApprovalStats {
  approvedCount: number;  // 已批准数量
  deniedCount: number;    // 已拒绝数量
  totalCount: number;     // 总请求数量
}

/**
 * 授权结果
 */
export interface ToolApprovalResult {
  approved: boolean;       // 是否批准
  rememberChoice: boolean; // 是否记住选择
}

/**
 * 检测 Claude CLI 输出中的权限请求
 * 参照 WPF 的 ClaudePermissionDetector.DetectPermissionRequest
 */
export function detectToolApprovalRequest(jsonOutput: string): ToolApprovalRequest | null {
  if (!jsonOutput || jsonOutput.trim() === '') {
    return null;
  }

  try {
    const json = JSON.parse(jsonOutput);

    // 检查 permission_denials 数组（Claude CLI 官方字段）
    if (json.permission_denials && Array.isArray(json.permission_denials) && json.permission_denials.length > 0) {
      const denial = json.permission_denials[0]; // 取第一个权限请求

      const toolName = denial.tool_name || 'Unknown';
      const toolUseId = denial.tool_use_id || '';
      const toolInput = denial.tool_input || {};

      // 提取工具参数
      const filePath = toolInput.file_path || toolInput.path;
      const content = toolInput.content || toolInput.new_string;
      const command = toolInput.command;
      const pattern = toolInput.pattern;
      const url = toolInput.url;

      // 获取 Claude 的文本回复
      const message = json.result || '';

      return {
        isPermissionRequest: true,
        toolName,
        toolUseId,
        filePath,
        content,
        command,
        pattern,
        url,
        message,
        rawJson: jsonOutput,
      };
    }

    // 没有权限请求
    return null;
  } catch (error) {
    console.error('[ToolApprovalService] JSON 解析失败:', error);
    return null;
  }
}

/**
 * 获取友好的权限请求消息
 * 参照 WPF 的 PermissionRequest.GetFriendlyMessage
 */
export function getToolApprovalMessage(request: ToolApprovalRequest): string {
  const { toolName, filePath, command, pattern, url } = request;

  switch (toolName) {
    case 'Write':
      return `Claude 需要创建/写入文件：\n${filePath || '(未知路径)'}`;

    case 'Edit':
      return `Claude 需要编辑文件：\n${filePath || '(未知路径)'}`;

    case 'Read':
      return `Claude 需要读取文件：\n${filePath || '(未知路径)'}`;

    case 'Bash':
      return `Claude 需要执行命令：\n${command || '(未知命令)'}`;

    case 'Glob':
      return `Claude 需要搜索文件：\n${pattern || '(未知模式)'}`;

    case 'Grep':
      return `Claude 需要搜索内容：\n${pattern || '(未知模式)'}`;

    case 'WebFetch':
      return `Claude 需要访问网页：\n${url || '(未知URL)'}`;

    case 'WebSearch':
      return `Claude 需要搜索网页：\n${pattern || '(未知关键词)'}`;

    default:
      return `Claude 需要使用工具：${toolName}`;
  }
}

/**
 * 获取工具图标
 */
export function getToolIcon(toolName: string): string {
  switch (toolName) {
    case 'Write':
      return 'codicon-edit';
    case 'Edit':
      return 'codicon-edit';
    case 'Read':
      return 'codicon-file';
    case 'Bash':
      return 'codicon-terminal';
    case 'Glob':
    case 'Grep':
      return 'codicon-search';
    case 'WebFetch':
    case 'WebSearch':
      return 'codicon-globe';
    default:
      return 'codicon-tools';
  }
}

/**
 * 获取操作类型的友好名称（参照 WPF 的图标映射）
 */
export function getToolDisplayName(toolName: string): string {
  switch (toolName) {
    case 'Write':
      return '✏️ 写入文件';
    case 'Edit':
      return '✏️ 编辑文件';
    case 'Read':
      return '📄 读取文件';
    case 'Bash':
      return '⚡ 执行命令';
    case 'Glob':
      return '🔍 搜索文件';
    case 'Grep':
      return '🔍 搜索内容';
    case 'WebFetch':
      return '🌐 访问网页';
    case 'WebSearch':
      return '🌐 搜索网页';
    default:
      return `${toolName}`;
  }
}

/**
 * 工具授权管理器
 * 管理授权记录和统计信息
 */
export class ToolApprovalManager {
  private stats: ToolApprovalStats = {
    approvedCount: 0,
    deniedCount: 0,
    totalCount: 0,
  };

  private rememberedChoices: Map<string, boolean> = new Map(); // key: toolName, value: approved

  /**
   * 获取统计信息
   */
  getStats(): ToolApprovalStats {
    return { ...this.stats };
  }

  /**
   * 记录授权结果
   */
  recordApproval(request: ToolApprovalRequest, result: ToolApprovalResult): void {
    this.stats.totalCount++;
    if (result.approved) {
      this.stats.approvedCount++;
    } else {
      this.stats.deniedCount++;
    }

    // 如果用户选择记住选择
    if (result.rememberChoice) {
      this.rememberedChoices.set(request.toolName, result.approved);
      console.log(`[ToolApprovalManager] 记住选择: ${request.toolName} -> ${result.approved ? '批准' : '拒绝'}`);
    }
  }

  /**
   * 检查是否有记住的选择
   */
  getRememberedChoice(toolName: string): boolean | null {
    if (this.rememberedChoices.has(toolName)) {
      return this.rememberedChoices.get(toolName)!;
    }
    return null;
  }

  /**
   * 清除记住的选择
   */
  clearRememberedChoices(): void {
    this.rememberedChoices.clear();
    console.log('[ToolApprovalManager] 已清除所有记住的选择');
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      approvedCount: 0,
      deniedCount: 0,
      totalCount: 0,
    };
    console.log('[ToolApprovalManager] 已重置统计信息');
  }
}

// 全局授权管理器实例
export const toolApprovalManager = new ToolApprovalManager();
