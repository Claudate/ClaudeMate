/**
 * Base Handler - 所有 IPC Handler 的基类
 * 提供统一的注册接口和工具方法
 */

import { IPCChannel, IPCHandler } from '../../../shared/types/ipc.types';
import { ZodSchema } from 'zod';
import { Logger } from '../../utils/Logger';

export interface HandlerRegistration {
  channel: IPCChannel;
  handler: IPCHandler;
  validator?: ZodSchema;
}

export abstract class BaseHandler {
  protected logger: Logger;

  constructor(protected moduleName: string) {
    this.logger = Logger.getInstance(`IPC:${moduleName}`);
  }

  /**
   * 注册当前模块的所有 handlers
   * @param registerFn - IPCManager 提供的注册函数
   */
  abstract register(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: IPCHandler<TInput, TOutput>,
      validator?: ZodSchema<TInput>
    ) => void
  ): void;

  /**
   * 获取所有 handler 注册信息
   * 子类可以覆盖此方法来提供注册信息
   */
  protected getHandlerRegistrations(): HandlerRegistration[] {
    return [];
  }

  /**
   * 批量注册 handlers（便捷方法）
   */
  protected registerAll(
    registerFn: <TInput, TOutput>(
      channel: IPCChannel,
      handler: IPCHandler<TInput, TOutput>,
      validator?: ZodSchema<TInput>
    ) => void
  ): void {
    const registrations = this.getHandlerRegistrations();

    for (const { channel, handler, validator } of registrations) {
      registerFn(channel, handler, validator);
    }

    this.logger.info(`Registered ${registrations.length} handlers`);
  }

  /**
   * 工具方法：安全地执行异步操作
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
}
