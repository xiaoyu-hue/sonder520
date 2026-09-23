#!/usr/bin/env node
/**
 * var → let/const 迁移脚本
 * 策略：
 * 1. 未被重新赋值的变量 → const
 * 2. 被重新赋值的变量 → let
 * 3. 保留原逻辑，逐文件验证
 */

const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '..', 'js');
const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const changes = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 匹配 var 声明
    const varMatch = line.match(/^(\s*)var\s+([\w$]+)\s*=\s*(.+)$/);
    if (!varMatch) continue;
    
    const indent = varMatch[1];
    const varName = varMatch[2];
    const initValue = varMatch[3].trim();
    
    // 检查后续行是否重新赋值
    const restOfCode = lines.slice(i + 1).join('\n');
    const isReassigned = new RegExp('\\b' + varName + '\\s*=[^=]').test(restOfCode);
    
    // 检查是否是模块导出或全局变量
    const isGlobalExport = varName === 'window' || varName.startsWith('window.');
    const isModuleExport = line.includes('module.exports') || line.includes('exports.');
    
    if (!isGlobalExport && !isModuleExport) {
      const newKeyword = isReassigned ? 'let' : 'const';
      const newLine = line.replace(`var ${varName}`, `${newKeyword} ${varName}`);
      if (newLine !== line) {
        changes.push({ line: i + 1, old: line.trim(), new: newLine.trim() });
        lines[i] = newLine;
      }
    }
  }
  
  const newContent = lines.join('\n');
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(path.basename(filePath) + ': ' + changes.length + ' 处变更');
    return changes;
  }
  return [];
}

// 处理关键文件
const priorityFiles = ['motion.js', 'ui.js', 'home.js', 'event-bus.js', 'error-guard.js'];
let totalChanges = 0;

priorityFiles.forEach(f => {
  const filePath = path.join(JS_DIR, f);
  if (fs.existsSync(filePath)) {
    const changes = migrateFile(filePath);
    totalChanges += changes.length;
    changes.slice(0, 5).forEach(c => console.log('  行' + c.line + ': ' + c.old + ' → ' + c.new));
  }
});

console.log('\n总计变更: ' + totalChanges + ' 处');
console.log('请运行测试验证...');
