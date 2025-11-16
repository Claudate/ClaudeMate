import { Logger } from '../utils/Logger';

const logger = Logger.getInstance('TokenizerService');

/**
 * 分词结果接口
 */
export interface TokenizeResult {
  tokens: string[];        // 分词结果
  language: 'zh' | 'en' | 'ja' | 'mixed';  // 检测到的语言
}

/**
 * 多语言分词服务
 * 支持中文、英文、日文及混合文本的智能分词
 */
export class TokenizerService {
  private nodejieba: any;
  private natural: any;
  private kuromoji: any;
  private kuromojiTokenizer: any;
  private initialized: boolean = false;
  private japaneseReady: boolean = false;

  constructor() {
    this.initializeLibraries();
  }

  /**
   * 延迟加载分词库
   */
  private async initializeLibraries() {
    try {
      // 动态加载 natural（英文分词）
      this.natural = await import('natural');

      // ⚠️ nodejieba 和 kuromoji 需要 C++ 编译环境，跳过加载
      // 将使用降级的 JavaScript 分词方案
      logger.warn('⚠️ 使用 JavaScript 降级分词（nodejieba/kuromoji 需要 C++ 编译）');

      this.initialized = true;
      logger.info('✅ 分词库初始化完成（英文 + 降级中日文）');
    } catch (error) {
      logger.warn(`⚠️ 分词库加载失败（将使用简单分词）: ${error}`);
      this.initialized = false;
    }
  }

  /**
   * 初始化日语分词器（kuromoji 需要异步构建）
   * ⚠️ 已禁用，使用降级方案
   */
  private async initializeKuromoji() {
    // Kuromoji 需要 C++ 编译环境，跳过
    this.japaneseReady = false;
    logger.debug('⚠️ 日语分词器已禁用，使用降级方案');
  }

  /**
   * 检测文本语言
   */
  private detectLanguage(text: string): 'zh' | 'en' | 'ja' | 'mixed' {
    // 统计中文字符（CJK统一表意文字）
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
    const chineseCount = chineseChars ? chineseChars.length : 0;

    // 统计日文字符（平假名、片假名）
    const japaneseChars = text.match(/[\u3040-\u309f\u30a0-\u30ff]/g);
    const japaneseCount = japaneseChars ? japaneseChars.length : 0;

    // 统计英文字符
    const englishChars = text.match(/[a-zA-Z]/g);
    const englishCount = englishChars ? englishChars.length : 0;

    const total = chineseCount + japaneseCount + englishCount;
    if (total === 0) return 'en';

    const chineseRatio = chineseCount / total;
    const japaneseRatio = japaneseCount / total;
    const englishRatio = englishCount / total;

    // 判断主要语言
    if (japaneseRatio > 0.3) return 'ja';  // 有30%以上假名即判定为日语
    if (chineseRatio > 0.5) return 'zh';   // 50%以上汉字判定为中文
    if (englishRatio > 0.6) return 'en';   // 60%以上英文判定为英文
    return 'mixed';  // 混合语言
  }

  /**
   * 中文分词（使用结巴分词）
   */
  private tokenizeChinese(text: string): string[] {
    if (!this.initialized || !this.nodejieba) {
      // 降级方案：简单字符级分词
      return this.fallbackChineseTokenize(text);
    }

    try {
      // 使用结巴分词
      const tokens = this.nodejieba.cut(text);
      return tokens.filter((token: string) => token.trim().length > 0);
    } catch (error) {
      logger.warn(`中文分词失败，使用降级方案: ${error}`);
      return this.fallbackChineseTokenize(text);
    }
  }

  /**
   * 英文分词（使用 Natural）
   */
  private tokenizeEnglish(text: string): string[] {
    if (!this.initialized || !this.natural) {
      // 降级方案：简单空格分词
      return this.fallbackEnglishTokenize(text);
    }

    try {
      // 使用 Natural 的 WordTokenizer
      const tokenizer = new this.natural.WordTokenizer();
      const tokens = tokenizer.tokenize(text);
      return tokens
        .map((token: string) => token.toLowerCase())
        .filter((token: string) => token.length > 0);
    } catch (error) {
      logger.warn(`英文分词失败，使用降级方案: ${error}`);
      return this.fallbackEnglishTokenize(text);
    }
  }

  /**
   * 日文分词（使用 Kuromoji）
   */
  private tokenizeJapanese(text: string): string[] {
    if (!this.japaneseReady || !this.kuromojiTokenizer) {
      // 降级方案：简单字符级分词
      return this.fallbackJapaneseTokenize(text);
    }

    try {
      // 使用 Kuromoji 分词
      const tokens = this.kuromojiTokenizer.tokenize(text);
      return tokens
        .map((token: any) => token.surface_form)  // 获取词的表面形式
        .filter((token: string) => token.trim().length > 0);
    } catch (error) {
      logger.warn(`日文分词失败，使用降级方案: ${error}`);
      return this.fallbackJapaneseTokenize(text);
    }
  }

  /**
   * 混合语言分词
   */
  private tokenizeMixed(text: string): string[] {
    // 使用正则分离中英日文片段
    const segments: string[] = [];
    const regex = /([\u4e00-\u9fa5]+|[\u3040-\u309f\u30a0-\u30ff]+|[a-zA-Z]+)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      segments.push(match[0]);
    }

    // 对每个片段进行相应的分词
    const tokens: string[] = [];
    for (const segment of segments) {
      const lang = this.detectLanguage(segment);
      if (lang === 'zh') {
        tokens.push(...this.tokenizeChinese(segment));
      } else if (lang === 'ja') {
        tokens.push(...this.tokenizeJapanese(segment));
      } else {
        tokens.push(...this.tokenizeEnglish(segment));
      }
    }

    return tokens;
  }

  /**
   * 中文分词降级方案（简单切分）
   */
  private fallbackChineseTokenize(text: string): string[] {
    // 按字符切分中文，保留标点和空格作为分隔符
    const tokens: string[] = [];
    let currentToken = '';

    for (const char of text) {
      if (/[\u4e00-\u9fa5]/.test(char)) {
        // 中文字符
        if (currentToken) tokens.push(currentToken);
        tokens.push(char);
        currentToken = '';
      } else if (/[a-zA-Z0-9]/.test(char)) {
        // 英文字符或数字
        currentToken += char;
      } else {
        // 标点或空格
        if (currentToken) tokens.push(currentToken);
        currentToken = '';
      }
    }

    if (currentToken) tokens.push(currentToken);
    return tokens.filter(t => t.trim().length > 0);
  }

  /**
   * 英文分词降级方案（按空格和标点切分）
   */
  private fallbackEnglishTokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s\p{P}]+/u)
      .filter(token => token.length > 0);
  }

  /**
   * 日文分词降级方案（简单字符级切分）
   */
  private fallbackJapaneseTokenize(text: string): string[] {
    const tokens: string[] = [];
    let currentToken = '';

    for (const char of text) {
      if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fa5]/.test(char)) {
        // 日文字符（平假名、片假名、汉字）
        if (currentToken) tokens.push(currentToken);
        tokens.push(char);
        currentToken = '';
      } else if (/[a-zA-Z0-9]/.test(char)) {
        // 英文字符或数字
        currentToken += char;
      } else {
        // 标点或空格
        if (currentToken) tokens.push(currentToken);
        currentToken = '';
      }
    }

    if (currentToken) tokens.push(currentToken);
    return tokens.filter(t => t.trim().length > 0);
  }

  /**
   * 主分词方法
   */
  public tokenize(text: string): TokenizeResult {
    if (!text || text.trim().length === 0) {
      return { tokens: [], language: 'en' };
    }

    const language = this.detectLanguage(text);
    let tokens: string[];

    switch (language) {
      case 'zh':
        tokens = this.tokenizeChinese(text);
        break;
      case 'en':
        tokens = this.tokenizeEnglish(text);
        break;
      case 'ja':
        tokens = this.tokenizeJapanese(text);
        break;
      case 'mixed':
        tokens = this.tokenizeMixed(text);
        break;
      default:
        tokens = this.fallbackEnglishTokenize(text);
    }

    logger.debug(`分词完成: language=${language}, tokens=${tokens.length}`);
    return { tokens, language };
  }

  /**
   * 批量分词
   */
  public tokenizeBatch(texts: string[]): TokenizeResult[] {
    return texts.map(text => this.tokenize(text));
  }

  /**
   * 计算两个文本的相似度（基于分词后的 Jaccard 相似度）
   */
  public similarity(text1: string, text2: string): number {
    const tokens1 = new Set(this.tokenize(text1).tokens);
    const tokens2 = new Set(this.tokenize(text2).tokens);

    if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
    if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

    // 计算交集
    const intersection = new Set(
      [...tokens1].filter(token => tokens2.has(token))
    );

    // 计算并集
    const union = new Set([...tokens1, ...tokens2]);

    // Jaccard 相似度
    return intersection.size / union.size;
  }

  /**
   * 提取关键词（简单实现：去除停用词后按频率排序）
   */
  public extractKeywords(text: string, limit: number = 10): string[] {
    const { tokens } = this.tokenize(text);

    // 简单的停用词列表
    const stopWords = new Set([
      // 中文停用词
      '的', '了', '和', '是', '在', '我', '有', '个', '不', '这', '你', '也', '就', '会', '着',
      '要', '可以', '能', '他', '她', '它', '们', '吗', '吧', '啊', '呢', '么', '上', '下',
      '很', '来', '去', '说', '看', '那', '得', '到', '都', '没', '还', '与', '及', '对',
      // 英文停用词
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that', 'these',
      'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when',
      'where', 'why', 'how',
      // 日文停用词（助词、助动词等）
      'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'ある', 'いる',
      'も', 'する', 'から', 'な', 'こと', 'として', 'い', 'や', 'れる', 'など', 'なっ', 'ない',
      'この', 'ため', 'その', 'あっ', 'よう', 'また', 'もの', 'という', 'あり', 'まで', 'られ',
      'なる', 'へ', 'か', 'だ', 'これ', 'によって', 'により', 'おり', 'より', 'による', 'ず',
      'なり', 'られる', 'において', 'ば', 'なかっ', 'なく', 'しかし', 'について', 'せ', 'だっ',
      'その後', 'できる', 'それ', 'う', 'ので', 'なお', 'のみ', 'でき', 'き', 'つ', 'における',
      'および', 'いう', 'さらに', 'でも', 'ら', 'たり', 'その他', 'に関する', 'たち', 'ます'
    ]);

    // 过滤停用词并统计频率
    const frequency = new Map<string, number>();
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (!stopWords.has(lower) && token.length > 1) {
        frequency.set(token, (frequency.get(token) || 0) + 1);
      }
    }

    // 按频率排序
    const sorted = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    return sorted.slice(0, limit);
  }
}

// 导出单例
export const tokenizerService = new TokenizerService();
