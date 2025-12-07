/**
 * Claude TOON Optimizer - TOON 格式优化模块
 * 负责检测并转换结构化数据为 TOON 格式,节省 token
 */

import { BaseClaudeModule } from './BaseClaudeModule';

// TOON 库动态导入(ESM 模块)
let toonEncode: ((data: any, options?: any) => string) | null = null;

export class ClaudeTOONOptimizer extends BaseClaudeModule {
  private toonReady: boolean = false;

  constructor() {
    super('TOONOptimizer');
    this.initializeTOON();
  }

  /**
   * 初始化 TOON 库(异步)
   */
  private async initializeTOON(): Promise<void> {
    try {
      // 使用 eval 绕过 TypeScript 编译器将 import() 转换为 require()
      // eslint-disable-next-line no-eval
      const toon = await eval('import("@toon-format/toon")');
      toonEncode = toon.encode;
      this.toonReady = true;
      this.logger.info('TOON 库加载成功');
    } catch (error) {
      this.logger.warn('TOON 库加载失败,将禁用 TOON 优化:', error);
      this.toonReady = false;
    }
  }

  /**
   * 判断数组是否均匀(所有元素结构相似)
   */
  private isUniformArray(arr: any[]): boolean {
    if (arr.length === 0) return false;

    const firstItem = arr[0];
    if (typeof firstItem !== 'object' || firstItem === null) return false;

    const firstKeys = Object.keys(firstItem).sort().join(',');

    // 检查至少 80% 的元素具有相同的键
    const uniformCount = arr.filter(item => {
      if (typeof item !== 'object' || item === null) return false;
      const keys = Object.keys(item).sort().join(',');
      return keys === firstKeys;
    }).length;

    return uniformCount / arr.length >= 0.8;
  }

  /**
   * TOON 优化:智能检测并转换结构化数据
   * 只在消息包含 JSON 数组/对象时转换为 TOON 格式,节省 token
   */
  public optimizeMessageWithTOON(message: string | any[]): string | any[] {
    // 如果 TOON 库未加载,直接返回原消息
    if (!toonEncode || !this.toonReady) {
      return message;
    }

    // 如果是数组(多模态消息),不做处理
    if (Array.isArray(message)) {
      return message;
    }

    // 尝试检测消息中是否包含 JSON 数据块
    const jsonBlockPattern = /```json\n([\s\S]*?)\n```/g;
    const jsonInlinePattern = /(\{[\s\S]{100,}\}|\[[\s\S]{100,}\])/g;

    let optimizedMessage = message;
    let tokensSaved = 0;

    // 替换 JSON 代码块
    optimizedMessage = optimizedMessage.replace(jsonBlockPattern, (match, jsonContent) => {
      try {
        const data = JSON.parse(jsonContent);

        // 只对数组或大对象使用 TOON
        if (Array.isArray(data) && data.length >= 5 && toonEncode) {
          const toonFormat = toonEncode(data, { indent: 1, delimiter: ',' });
          const originalLength = jsonContent.length;
          const toonLength = toonFormat.length;
          tokensSaved += originalLength - toonLength;

          this.logger.info(
            `优化 JSON 代码块: ${originalLength} → ${toonLength} 字符,节省 ${((1 - toonLength / originalLength) * 100).toFixed(1)}%`
          );

          return `\`\`\`toon\n${toonFormat}\n\`\`\``;
        }

        return match;
      } catch (e) {
        // 无效JSON,保持原样
        return match;
      }
    });

    // 替换内联 JSON(>100字符的对象/数组)
    optimizedMessage = optimizedMessage.replace(jsonInlinePattern, (match) => {
      try {
        const data = JSON.parse(match);

        // 只对均匀数组使用 TOON
        if (Array.isArray(data) && data.length >= 5 && this.isUniformArray(data) && toonEncode) {
          const toonFormat = toonEncode(data, { indent: 1, delimiter: ',' });
          const originalLength = match.length;
          const toonLength = toonFormat.length;
          tokensSaved += originalLength - toonLength;

          this.logger.info(
            `优化内联 JSON: ${originalLength} → ${toonLength} 字符,节省 ${((1 - toonLength / originalLength) * 100).toFixed(1)}%`
          );

          return toonFormat;
        }

        return match;
      } catch (e) {
        // 无效JSON,保持原样
        return match;
      }
    });

    if (tokensSaved > 0) {
      this.logger.info(`总计节省约 ${tokensSaved} 字符 ≈ ${Math.ceil(tokensSaved / 4)} tokens`);
    }

    return optimizedMessage;
  }

  /**
   * 获取 TOON 库状态
   */
  public isReady(): boolean {
    return this.toonReady;
  }
}
