/**
 * 主进程打包后置混淆脚本
 * 作用：对 `dist/main` 下的所有 JS 文件进行强混淆处理，确保打包内容不可读（乱码）
 * 使用：在构建完成后运行（集成于 npm scripts）
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

/**
 * 读取指定目录下的所有文件（递归）
 * @param {string} dir 目标目录
 * @returns {string[]} 目录下所有文件的绝对路径
 */
function readAllFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readAllFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

/**
 * 判断是否为可混淆的 JS 文件
 * @param {string} filePath 文件路径
 * @returns {boolean} 是否为 .js 文件
 */
function isJsFile(filePath) {
  return filePath.endsWith('.js');
}

/**
 * 对文件内容进行混淆并覆盖写入
 * @param {string} filePath 文件路径
 */
function obfuscateFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    disableConsoleOutput: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    renameGlobals: true,
    rotateStringArray: true,
    selfDefending: true,
    transformObjectKeys: true,
    unicodeEscapeSequence: true,
  });
  fs.writeFileSync(filePath, result.getObfuscatedCode(), 'utf8');
}

/**
 * 执行主进程目录混淆
 * - 目标路径：`dist/main`
 * - 仅处理 `.js` 文件
 */
function run() {
  const targetDir = path.resolve(__dirname, '..', 'dist', 'main');
  if (!fs.existsSync(targetDir)) {
    console.error('[obfuscate-main] 目录不存在：', targetDir);
    process.exit(1);
  }

  const files = readAllFiles(targetDir).filter(isJsFile);
  console.log(`[obfuscate-main] 待处理文件数：${files.length}`);
  for (const f of files) {
    try {
      obfuscateFile(f);
      console.log(`[obfuscate-main] 已混淆：${path.relative(targetDir, f)}`);
    } catch (err) {
      console.error(`[obfuscate-main] 处理失败：${f}`, err);
      process.exitCode = 1;
    }
  }
}

// 执行入口
run();