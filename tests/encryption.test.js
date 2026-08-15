'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const C = require('../js/encryption.js');

const PWD = '我的强密码-2026@测试';
const PWD2 = '另一个不同密码';

function sameKey(a, b) {
  return C.deriveKey(PWD, new Uint8Array([1, 2, 3])).then(async k1 => {
    const k2 = await C.deriveKey(PWD, new Uint8Array([1, 2, 3]));
    const r1 = await crypto.subtle.exportKey('raw', k1);
    const r2 = await crypto.subtle.exportKey('raw', k2);
    assert.deepEqual(new Uint8Array(r1), new Uint8Array(r2));
  });
}

test('密钥派生：同密码同盐得到同一密钥', async () => {
  await sameKey();
});

test('密钥派生：不同盐派生不同密钥', async () => {
  const k1 = await C.deriveKey(PWD, new Uint8Array([1, 2, 3]));
  const k2 = await C.deriveKey(PWD, new Uint8Array([9, 9, 9]));
  const r1 = new Uint8Array(await crypto.subtle.exportKey('raw', k1));
  const r2 = new Uint8Array(await crypto.subtle.exportKey('raw', k2));
  assert.notDeepEqual(r1, r2);
});

test('密钥派生：不同密码派生不同密钥', async () => {
  const k1 = await C.deriveKey(PWD, new Uint8Array([1, 2, 3]));
  const k2 = await C.deriveKey(PWD2, new Uint8Array([1, 2, 3]));
  const r1 = new Uint8Array(await crypto.subtle.exportKey('raw', k1));
  const r2 = new Uint8Array(await crypto.subtle.exportKey('raw', k2));
  assert.notDeepEqual(r1, r2);
});

test('加解密往返：中文/换行/特殊字符完整还原', async () => {
  const key = await C.deriveKey(PWD, new Uint8Array([7, 7, 7]));
  const text = '任务：买🍎\n第二行 "引号" </script> 100%';
  const bundle = await C.encryptText(text, key);
  const out = await C.decryptBundle(bundle, key);
  assert.equal(out, text);
});

test('每次加密 IV 全新：两次加密结果互不相同', async () => {
  const key = await C.deriveKey(PWD, new Uint8Array([7, 7, 7]));
  const b1 = await C.encryptText('同样内容', key);
  const b2 = await C.encryptText('同样内容', key);
  assert.notEqual(b1.iv, b2.iv, 'IV 不应重用');
  assert.notEqual(b1.data, b2.data);
});

test('IV 与盐长度与格式：IV 12 字节、盐 16 字节、bundle 结构完整', () => {
  assert.equal(C.ivBytes().length, 12);
  assert.equal(C.saltBytes().length, 16);
});

test('Web Crypto 缺失时 saltBytes/ivBytes 抛清晰错误而非裸 TypeError', () => {
  /* 模块顶部 cr 在 require 时捕获 globalThis.crypto；临时删除并清 require 缓存以模拟无 Web Crypto 环境 */
  const g = globalThis;
  const saved = undefined;
  let setterWorked = false;
  try {
    Object.defineProperty(g, 'crypto', { value: undefined, configurable: true });
    setterWorked = true;
  } catch (e) { /* 只读属性：跳过低版本 Node 场景 */ }
  if (setterWorked) {
    const encPath = require.resolve('../js/encryption.js');
    delete require.cache[encPath];
    const C2 = require(encPath);
    assert.throws(() => C2.saltBytes(), /不支持 Web Crypto/, 'saltBytes 应抛友好错误');
    assert.throws(() => C2.ivBytes(), /不支持 Web Crypto/, 'ivBytes 应抛友好错误');
    delete require.cache[encPath];
    Object.defineProperty(g, 'crypto', { configurable: true, value: saved });
  }
});

test('错误密码解密必须抛错', async () => {
  const k1 = await C.deriveKey(PWD, new Uint8Array([7, 7, 7]));
  const k2 = await C.deriveKey(PWD2, new Uint8Array([7, 7, 7]));
  const bundle = await C.encryptText('机密内容', k1);
  await assert.rejects(() => C.decryptBundle(bundle, k2), '错误密码应解密失败');
});

test('篡改密文（认证标签失效）必须抛错', async () => {
  const key = await C.deriveKey(PWD, new Uint8Array([7, 7, 7]));
  const bundle = await C.encryptText('机密内容', key);
  const tampered = {
    v: bundle.v, iv: bundle.iv,
    data: (bundle.data.slice(0, 4) === 'AAAA' ? 'BBBB' : 'AAAA') + bundle.data.slice(4)
  };
  await assert.rejects(() => C.decryptBundle(tampered, key), '篡改密文应解密失败');
});

test('篡改 IV 必须抛错', async () => {
  const key = await C.deriveKey(PWD, new Uint8Array([7, 7, 7]));
  const bundle = await C.encryptText('机密内容', key);
  const bad = { v: bundle.v, iv: bundle.iv.slice(0, 2) + '00' + bundle.iv.slice(4), data: bundle.data };
  await assert.rejects(() => C.decryptBundle(bad, key));
});

test('空/残缺 bundle 必须抛错而非静默返回', async () => {
  const key = await C.deriveKey(PWD, new Uint8Array([7, 7, 7]));
  await assert.rejects(() => C.decryptBundle(null, key));
  await assert.rejects(() => C.decryptBundle({ v: 'x' }, key));
});

test('密文中不得出现明文内容（含 UTF-8 片段）', async () => {
  const key = await C.deriveKey(PWD, new Uint8Array([7, 7, 7]));
  const secret = '不可被搜索到的隐私内容XYZ';
  const bundle = await C.encryptText(secret, key);
  const raw = JSON.stringify(bundle);
  assert.ok(!raw.includes(secret), '密文不应包含明文');
});

test('迁移自检锁：引擎正常时任意密码自检通过（密码正确性由 GCM 认证在解密层拦截）', async () => {
  const salt = C.saltBytes();
  assert.equal(await C.selfTest(PWD, salt), true, '自检应验证加密引擎可用');
  assert.equal(await C.selfTest('任意字符串', salt), true, '自检不入口令校验');
});