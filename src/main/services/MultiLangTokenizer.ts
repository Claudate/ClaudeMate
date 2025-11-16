/**
 * Multi-Language Tokenizer
 * 支持中英日多语言分词
 * - 中文：字符级分词（避免原生依赖）
 * - 日文：字符级分词
 * - 英文：lunr 分词（支持词干提取）
 */

import { Logger } from '../utils/Logger';

const logger = Logger.getInstance('MultiLangTokenizer');

export class MultiLangTokenizer {
  private static instance: MultiLangTokenizer;

  private constructor() {
    logger.info('[MultiLangTokenizer] 已初始化');
  }

  static getInstance(): MultiLangTokenizer {
    if (!MultiLangTokenizer.instance) {
      MultiLangTokenizer.instance = new MultiLangTokenizer();
    }
    return MultiLangTokenizer.instance;
  }

  /**
   * 检测文本主要语言类型
   */
  private detectLanguage(text: string): 'zh' | 'ja' | 'en' {
    // 中文字符范围（包括汉字、中文标点）
    const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/;

    // 日文字符范围（平假名、片假名）
    const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;

    const chineseCount = (text.match(new RegExp(chineseRegex, 'g')) || []).length;
    const japaneseCount = (text.match(new RegExp(japaneseRegex, 'g')) || []).length;

    // 根据字符数量判断主要语言
    if (chineseCount > japaneseCount && chineseCount > text.length * 0.1) {
      return 'zh';
    } else if (japaneseCount > chineseCount && japaneseCount > text.length * 0.1) {
      return 'ja';
    } else {
      return 'en';
    }
  }

  /**
   * 英文分词（简单空格分割 + 小写化 + 去除标点）
   */
  private tokenizeEnglish(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // 去除标点符号
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }

  /**
   * 中文分词（字符级分词 + 双字组合）
   * 例如："搜索功能" -> ["搜", "索", "功", "能", "搜索", "索功", "功能"]
   */
  private tokenizeChinese(text: string): string[] {
    const tokens = new Set<string>();

    // 1. 提取所有中文字符（单字）
    const chineseChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || [];
    chineseChars.forEach((char) => tokens.add(char));

    // 2. 生成双字组合（bigrams）
    for (let i = 0; i < chineseChars.length - 1; i++) {
      const bigram = chineseChars[i] + chineseChars[i + 1];
      tokens.add(bigram);
    }

    // 3. 提取连续的中文词汇（2-4 字）
    const chineseWords = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]{2,4}/g) || [];
    chineseWords.forEach((word) => tokens.add(word));

    // 4. 提取英文单词（保留混合文本中的英文）
    const englishWords = this.tokenizeEnglish(text);
    englishWords.forEach((word) => tokens.add(word));

    return Array.from(tokens);
  }

  /**
   * 日文分词（字符级分词 + 词组组合）
   * 类似中文处理逻辑
   */
  private tokenizeJapanese(text: string): string[] {
    const tokens = new Set<string>();

    // 1. 提取所有日文字符（平假名、片假名、汉字）
    const japaneseChars =
      text.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\u3400-\u4dbf]/g) || [];
    japaneseChars.forEach((char) => tokens.add(char));

    // 2. 生成双字组合
    for (let i = 0; i < japaneseChars.length - 1; i++) {
      const bigram = japaneseChars[i] + japaneseChars[i + 1];
      tokens.add(bigram);
    }

    // 3. 提取连续的日文词汇（2-4 字）
    const japaneseWords =
      text.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\u3400-\u4dbf]{2,4}/g) || [];
    japaneseWords.forEach((word) => tokens.add(word));

    // 4. 提取英文单词
    const englishWords = this.tokenizeEnglish(text);
    englishWords.forEach((word) => tokens.add(word));

    return Array.from(tokens);
  }

  /**
   * 通用分词接口（自动检测语言）
   */
  public tokenize(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const lang = this.detectLanguage(text);

    switch (lang) {
      case 'zh':
        return this.tokenizeChinese(text);
      case 'ja':
        return this.tokenizeJapanese(text);
      case 'en':
      default:
        return this.tokenizeEnglish(text);
    }
  }

  /**
   * 批量分词（用于索引构建）
   * 返回去重后的词汇列表
   */
  public tokenizeBatch(texts: string[]): string[] {
    const allTokens = new Set<string>();

    for (const text of texts) {
      const tokens = this.tokenize(text);
      tokens.forEach((token) => {
        if (token.length > 0) {
          allTokens.add(token.toLowerCase());
        }
      });
    }

    return Array.from(allTokens);
  }

  /**
   * 为搜索查询分词（保留原始大小写，用于高亮显示）
   */
  public tokenizeQuery(query: string): string[] {
    return this.tokenize(query).filter((token) => token.length > 0);
  }
}
