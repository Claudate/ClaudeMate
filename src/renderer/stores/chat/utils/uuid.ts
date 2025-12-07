/**
 * UUID Generation Utility
 * 用于生成符合 Claude CLI --resume 要求的标准 UUID 格式
 */

/**
 * 生成标准 UUID (v4)
 * Claude CLI 会严格校验 UUID 格式
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
