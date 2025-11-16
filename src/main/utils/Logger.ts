/**
 * Logger utility with different log levels
 * Supports file logging in production
 */

import log from 'electron-log';
import { app } from 'electron';
import { join } from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private static instances = new Map<string, Logger>();
  private static configured = false;
  private context: string;

  private constructor(context: string) {
    this.context = context;
    Logger.configure();
  }

  private static configure(): void {
    if (Logger.configured) return;
    Logger.configured = true;

    // Configure electron-log
    try {
      if (app && app.isPackaged) {
        log.transports.file.level = 'info';
        log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB
        log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] [{context}] {text}';
        log.transports.file.resolvePathFn = () =>
          join(app.getPath('userData'), 'logs', 'main.log');
      } else {
        log.transports.console.level = 'debug';
        log.transports.file.level = false;
      }
    } catch (error) {
      // App not ready yet, use console only
      log.transports.console.level = 'debug';
      log.transports.file.level = false;
    }
  }

  public static getInstance(context: string): Logger {
    if (!Logger.instances.has(context)) {
      Logger.instances.set(context, new Logger(context));
    }
    return Logger.instances.get(context)!;
  }

  public debug(message: string, ...args: unknown[]): void {
    log.debug(`[${this.context}]`, message, ...args);
  }

  public info(message: string, ...args: unknown[]): void {
    log.info(`[${this.context}]`, message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    log.warn(`[${this.context}]`, message, ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    log.error(`[${this.context}]`, message, ...args);
  }

  public log(level: LogLevel, message: string, ...args: unknown[]): void {
    this[level](message, ...args);
  }
}
