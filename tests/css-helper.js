/* tests/css-helper.js - CSS 文件读取 helper（style.css 拆分后的兼容层）
 * 读取4个拆分后的CSS文件并拼接为完整内容，供测试使用。 */
'use strict';

const fs = require('fs');
const path = require('path');

const CSS_FILES = [
  'css/style-base.css',
  'css/style-animations.css',
  'css/style-modules.css',
  'css/style-responsive.css'
];

/**
 * 读取所有拆分后的CSS文件并拼接
 * @param {string} root - 项目根目录
 * @returns {string} 拼接后的完整CSS内容
 */
function readAllCss(root) {
  return CSS_FILES.map(f => {
    const fp = path.join(root, f);
    return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
  }).join('\n');
}

module.exports = { readAllCss, CSS_FILES };
