/**
 * Renderer Process Logger
 * 轻量级日志工具（仅输出到控制台）
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private static instances = new Map<string, Logger>();
  private context: string;

  private constructor(context: string) {
    this.context = context;
  }

  public static getInstance(context: string): Logger {
    if (!Logger.instances.has(context)) {
      Logger.instances.set(context, new Logger(context));
    }
    return Logger.instances.get(context)!;
  }

  public debug(message: string, ...args: unknown[]): void {
    console.debug(`[${this.context}]`, message, ...args);
  }

  public info(message: string, ...args: unknown[]): void {
    console.info(`[${this.context}]`, message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.context}]`, message, ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    console.error(`[${this.context}]`, message, ...args);
  }

  public log(level: LogLevel, message: string, ...args: unknown[]): void {
    this[level](message, ...args);
  }
}
