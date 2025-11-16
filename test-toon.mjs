/**
 * TOON 格式测试脚本
 * 演示如何将 JSON 数据转换为 TOON 格式并计算 token 节省量
 */

import { encode, decode } from '@toon-format/toon';

console.log('='.repeat(60));
console.log('TOON 格式优化测试');
console.log('='.repeat(60));
console.log();

// 测试场景1：会话元数据列表（最佳场景）
console.log('📊 场景1：20个会话元数据');
console.log('-'.repeat(60));

const sessionMetadata = Array.from({ length: 20 }, (_, i) => ({
  id: `session-${i + 1}`,
  title: `修复bug ${i + 1}`,
  projectName: 'claude-skills-app',
  projectPath: 'H:\\Electron\\claude-skills-app',
  createdAt: '2025-01-15T10:30:00Z',
  modifiedAt: '2025-01-15T11:45:00Z',
  startTime: '2025-01-15T10:30:00Z',
  duration: 4500 + i * 100,
  model: 'claude-sonnet-3.5',
  approval: 'auto',
  cliVersion: '1.0.0',
  messageCount: 12 + i,
  fileSize: 45000 + i * 1000,
  totalTokens: 3500 + i * 100,
  inputTokens: 2000 + i * 50,
  outputTokens: 1500 + i * 50,
  uploadCount: 3,
  downloadCount: 5,
  summary: `修复了用户登录时的验证逻辑问题，涉及${i + 3}个文件的修改...`
}));

const jsonSessions = JSON.stringify(sessionMetadata, null, 2);
const toonSessions = encode(sessionMetadata, { indent: 1, delimiter: ',' });

console.log(`JSON 格式长度: ${jsonSessions.length} 字符`);
console.log(`TOON 格式长度: ${toonSessions.length} 字符`);
console.log(`节省: ${jsonSessions.length - toonSessions.length} 字符 (${((1 - toonSessions.length / jsonSessions.length) * 100).toFixed(1)}%)`);
console.log(`估算 token 节省: ${Math.ceil((jsonSessions.length - toonSessions.length) / 4)} tokens`);
console.log();

console.log('TOON 输出示例（前500字符）:');
console.log(toonSessions.substring(0, 500) + '...');
console.log();

// 测试场景2：Token 使用历史
console.log('📊 场景2：50条 Token 使用记录');
console.log('-'.repeat(60));

const tokenUsages = Array.from({ length: 50 }, (_, i) => ({
  inputTokens: 150 + i * 10,
  outputTokens: 200 + i * 5,
  totalTokens: 350 + i * 15,
  cacheCreationTokens: i % 10 === 0 ? 100 : 0,
  cacheReadTokens: i % 10 !== 0 ? 50 : 0,
  timestamp: 1700000001000 + i * 60000
}));

const jsonTokens = JSON.stringify(tokenUsages, null, 2);
const toonTokens = encode(tokenUsages, { indent: 1, delimiter: ',' });

console.log(`JSON 格式长度: ${jsonTokens.length} 字符`);
console.log(`TOON 格式长度: ${toonTokens.length} 字符`);
console.log(`节省: ${jsonTokens.length - toonTokens.length} 字符 (${((1 - toonTokens.length / jsonTokens.length) * 100).toFixed(1)}%)`);
console.log(`估算 token 节省: ${Math.ceil((jsonTokens.length - toonTokens.length) / 4)} tokens`);
console.log();

console.log('TOON 输出示例（前500字符）:');
console.log(toonTokens.substring(0, 500) + '...');
console.log();

// 测试场景3：消息历史（简化版）
console.log('📊 场景3：10条对话消息');
console.log('-'.repeat(60));

const messages = [
  { role: 'user', content: '请帮我修复登录bug', timestamp: 1700000001000 },
  { role: 'assistant', content: '好的，让我先检查登录相关的代码...', timestamp: 1700000002000 },
  { role: 'user', content: '问题出现在用户输入验证那里', timestamp: 1700000003000 },
  { role: 'assistant', content: '我找到问题了，是正则表达式的问题', timestamp: 1700000004000 },
  { role: 'user', content: '能给我详细说明一下吗？', timestamp: 1700000005000 },
  { role: 'assistant', content: '当前的正则表达式没有正确验证邮箱格式...', timestamp: 1700000006000 },
  { role: 'user', content: '明白了，那应该怎么修改？', timestamp: 1700000007000 },
  { role: 'assistant', content: '建议使用这个正则表达式：/^[a-zA-Z0-9...', timestamp: 1700000008000 },
  { role: 'user', content: '好的，还有其他需要注意的吗？', timestamp: 1700000009000 },
  { role: 'assistant', content: '是的，还需要添加防抖处理避免重复提交', timestamp: 1700000010000 }
];

const jsonMessages = JSON.stringify(messages, null, 2);
const toonMessages = encode(messages, { indent: 1, delimiter: ',' });

console.log(`JSON 格式长度: ${jsonMessages.length} 字符`);
console.log(`TOON 格式长度: ${toonMessages.length} 字符`);
console.log(`节省: ${jsonMessages.length - toonMessages.length} 字符 (${((1 - toonMessages.length / jsonMessages.length) * 100).toFixed(1)}%)`);
console.log(`估算 token 节省: ${Math.ceil((jsonMessages.length - toonMessages.length) / 4)} tokens`);
console.log();

console.log('TOON 输出示例:');
console.log(toonMessages);
console.log();

// 测试场景4：复杂嵌套数据（不适合TOON）
console.log('📊 场景4：深度嵌套对象（对比测试）');
console.log('-'.repeat(60));

const complexData = {
  project: {
    name: 'claude-skills-app',
    config: {
      build: {
        target: 'es2020',
        options: {
          minify: true,
          sourcemap: false
        }
      },
      dev: {
        port: 3000,
        hot: true
      }
    }
  }
};

const jsonComplex = JSON.stringify(complexData, null, 2);
const toonComplex = encode(complexData, { indent: 1 });

console.log(`JSON 格式长度: ${jsonComplex.length} 字符`);
console.log(`TOON 格式长度: ${toonComplex.length} 字符`);
console.log(`差异: ${toonComplex.length - jsonComplex.length} 字符 (${((toonComplex.length / jsonComplex.length - 1) * 100).toFixed(1)}%)`);
console.log('⚠️ 注意：深度嵌套数据TOON可能更长，不推荐使用');
console.log();

// 总结
console.log('='.repeat(60));
console.log('📈 总结');
console.log('='.repeat(60));
console.log('✅ 推荐使用 TOON 的场景:');
console.log('  - 均匀的对象数组（如会话元数据、token记录）');
console.log('  - 数组长度 >= 5');
console.log('  - 对象字段数量适中（5-20个字段）');
console.log();
console.log('❌ 不推荐使用 TOON 的场景:');
console.log('  - 深度嵌套的对象');
console.log('  - 非均匀数组（每个元素结构不同）');
console.log('  - 单个对象或小数组（< 5个元素）');
console.log();
console.log('💡 在 claude-skills-app 中的应用:');
console.log('  - 自动检测用户消息中的JSON数据块');
console.log('  - 仅对符合条件的数据转换为TOON');
console.log('  - 本地存储仍使用JSON');
console.log('  - 只在发送给Claude API时优化');
console.log('='.repeat(60));
