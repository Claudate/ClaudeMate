const fs = require('fs');
const path = require('path');

/**
 * 修复HTML文件中的资源路径，将绝对路径改为相对路径
 * 解决Electron打包后的资源加载问题
 */
function fixHtmlPaths() {
  const htmlFilePath = path.join(__dirname, '../dist/renderer/index.html');
  
  if (!fs.existsSync(htmlFilePath)) {
    console.log('HTML文件不存在:', htmlFilePath);
    return;
  }
  
  let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
  
  // 将绝对路径 /assets/ 改为相对路径 ./assets/
  htmlContent = htmlContent.replace(/href="\/assets\//g, 'href="./assets/');
  htmlContent = htmlContent.replace(/src="\/assets\//g, 'src="./assets/');
  
  // 处理URL()函数中的路径
  htmlContent = htmlContent.replace(/url\(\/assets\//g, 'url(./assets/');
  
  // 处理CSS文件中的字体引用
  htmlContent = htmlContent.replace(/src:\/assets\//g, 'src:./assets/');
  
  // 同时处理其他可能的绝对路径引用
  htmlContent = htmlContent.replace(/href="\//g, 'href="./');
  htmlContent = htmlContent.replace(/src="\//g, 'src="./');
  
  fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
  
  console.log('HTML路径修复完成！');
  console.log('已将绝对路径改为相对路径');
}

if (require.main === module) {
  fixHtmlPaths();
}

module.exports = { fixHtmlPaths };