/**
 * Base Claude Module - 所有 Claude 服务模块的基类
 * 提供统一的日志系统和工具方法
 */

import { Logger } from '../../utils/Logger';

export abstract class BaseClaudeModule {
  protected logger: Logger;

  constructor(protected moduleName: string) {
    this.logger = Logger.getInstance(`Claude:${moduleName}`);
  }

  /**
   * 安全执行异步操作
   */
  protected async safeExecute<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(errorMessage, error);
      throw error;
    }
  }

  /**
   * 等待指定毫秒数
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
