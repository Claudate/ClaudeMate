/**
 * 修复Vite构建后的动态导入路径问题
 * 用于Electron打包环境
 */

const fs = require('fs');
const path = require('path');

function fixViteDynamicImports() {
  const assetsDir = path.join(__dirname, '../dist/renderer/assets');
  
  if (!fs.existsSync(assetsDir)) {
    console.log('Assets目录不存在，跳过修复');
    return;
  }

  // 查找主JS文件
  const files = fs.readdirSync(assetsDir);
  const mainJsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js') && !f.includes('vendor'));
  
  if (!mainJsFile) {
    console.log('未找到主JS文件，跳过修复');
    return;
  }

  const filePath = path.join(assetsDir, mainJsFile);
  let content = fs.readFileSync(filePath, 'utf8');

  // 修复 __vite__mapDeps 中的路径
  content = content.replace(
    /__vite__mapDeps\s*=\s*\(i[^}]+\}\)/g,
    (match) => {
      // 将路径中的 assets/ 替换为 ./assets/
      return match.replace(/"assets\//g, '"./assets/');
    }
  );

  // 修复动态导入中的绝对路径
  content = content.replace(
    /(import\s*\(\s*['"])\/(assets\/[^'"]+['"]\s*\))/g,
    '$1./$2'
  );

  // 修复 CSS 预加载中的路径
  content = content.replace(
    /(preloadCSS|loadCSS)\s*\(\s*['"]\/assets\/([^'"]+)['"]/g,
    '$1("./assets/$2"'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`已修复动态导入路径: ${mainJsFile}`);
}

if (require.main === module) {
  fixViteDynamicImports();
}

module.exports = { fixViteDynamicImports };