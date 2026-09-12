/* eslint.config.js - ESLint 9 flat config（由 .eslintrc.json 等价迁移，C-2：eslint 8 已 EOL）
 * 规则与行为对齐原 .eslintrc.json：
 *   - env browser+node+es2020 → globals.browser + globals.node
 *   - extends eslint:recommended → @eslint/js configs.recommended
 *   - .mjs override（sourceType: module）保留，quotes-core.mjs 实验田可正常解析
 * 说明：.eslintrc.json 已被本文件取代（eslint 9 不再读取），文件本身暂保留待确认删除。 */
'use strict';
const js = require('@eslint/js');
const globals = require('globals');
const jsdoc = require('eslint-plugin-jsdoc');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**', 'js/globals.d.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: Object.assign(
        {},
        globals.browser,
        globals.node,
        {
          SonderStore: 'readonly',
          SonderMarkdown: 'readonly',
          SonderCrypto: 'readonly',
          SonderGames: 'readonly',
          SonderQuotes: 'readonly',
          importScripts: 'readonly',
          self: 'readonly'
        }
      )
    },
    plugins: { jsdoc: jsdoc },
    rules: {
      'no-console': 'off',
      /* eslint 8 行为等价（v9 默认把 catch 参数也纳入检查，本库 catch(e) 常不读 e）：
       * args 不查、catch 参数不查、_ 前缀变量忽略 */
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-implicit-globals': 'error',
      'eqeqeq': ['warn', 'smart'],
      'no-throw-literal': 'error',
      'no-self-compare': 'error',
      /* v9 新推荐规则 no-useless-assignment：本库大量"块顶声明-后赋值"ES5 风格，
       * 与 eslint 8 时代不一致，暂关闭、留作后续专项清理 */
      'no-useless-assignment': 'off',
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/check-param-names': 'warn',
      'jsdoc/check-types': 'warn'
    }
  },
  /* 测试/脚本/E2E（CommonJS 顶层 helper 风格）：eslint 8 时代不报，保持等价放行 */
  {
    files: ['tests/**/*.js', 'e2e/**/*.js', 'scripts/**/*.js'],
    rules: {
      'no-implicit-globals': 'off',
      'no-redeclare': 'off'
    }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module' },
    rules: { 'no-implicit-globals': 'off' }
  }
];
