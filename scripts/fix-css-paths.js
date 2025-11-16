const fs = require('fs');
const path = require('path');

/**
 * 修复CSS文件中的资源路径，将绝对路径改为相对路径
 * 解决Electron打包后的字体和其他资源加载问题
 */
function fixCssPaths() {
  const assetsDir = path.join(__dirname, '../dist/renderer/assets');
  
  if (!fs.existsSync(assetsDir)) {
    console.log('Assets目录不存在:', assetsDir);
    return;
  }
  
  // 获取所有CSS文件
  const cssFiles = fs.readdirSync(assetsDir)
    .filter(file => file.endsWith('.css'))
    .map(file => path.join(assetsDir, file));
  
  let fixedCount = 0;
  
  cssFiles.forEach(cssFile => {
    let cssContent = fs.readFileSync(cssFile, 'utf8');
    const originalContent = cssContent;
    
    // 修复url()中的绝对路径
    cssContent = cssContent.replace(/url\(\/assets\//g, 'url(./assets/');
    
    // 修复src属性中的绝对路径
    cssContent = cssContent.replace(/src:\/assets\//g, 'src:./assets/');
    
    // 修复其他可能的绝对路径引用
    cssContent = cssContent.replace(/\/assets\//g, './assets/');
    
    if (cssContent !== originalContent) {
      fs.writeFileSync(cssFile, cssContent, 'utf8');
      fixedCount++;
      console.log(`已修复CSS文件: ${path.basename(cssFile)}`);
    }
  });
  
  console.log(`CSS路径修复完成！共修复了 ${fixedCount} 个文件`);
}

if (require.main === module) {
  fixCssPaths();
}

module.exports = { fixCssPaths };