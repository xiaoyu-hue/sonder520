'use strict';
/* PBKDF2 派生缓存测试：页面会话内相同 (密码, 盐, 迭代数) 只派生一次，
 * 避免解锁/加密等路径重复执行 60 万次迭代阻塞主线程。
 * 通过包装 crypto.subtle.deriveKey 计数断言实际派生次数。 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const C = require('../js/encryption.js');

const subtle = globalThis.crypto.subtle;
const realDeriveKey = subtle.deriveKey.bind(subtle);
let deriveCalls = 0;
subtle.deriveKey = function () {
  deriveCalls++;
  return realDeriveKey.apply(subtle, arguments);
};
after(() => { subtle.deriveKey = realDeriveKey; });

async function rawOf(key) {
  return new Uint8Array(await subtle.exportKey('raw', key));
}

test('PBKDF2 缓存：同密码同盐只派生一次，密钥一致', async () => {
  const salt = new Uint8Array([1, 2, 3]);
  const before = deriveCalls;
  const k1 = await C.deriveKey('缓存测试密码-2026', salt);
  const k2 = await C.deriveKey('缓存测试密码-2026', salt);
  assert.equal(deriveCalls, before + 1, '同参只应派生一次（60 万次迭代不重跑）');
  assert.deepEqual(await rawOf(k1), await rawOf(k2), '两次密钥必须一致');
});

test('PBKDF2 缓存：异盐/异密码/异迭代数都会重新派生', async () => {
  const saltA = new Uint8Array([1, 2, 3]);
  const saltB = new Uint8Array([9, 9, 9]);
  const before = deriveCalls;
  await C.deriveKey('pwd-cache-a', saltA);
  await C.deriveKey('pwd-cache-a', saltB);
  await C.deriveKey('pwd-cache-b', saltA);
  await C.deriveKey('pwd-cache-a', saltA, 123456);
  assert.equal(deriveCalls, before + 4, '每组合法参数都应重新派生');
});

test('PBKDF2 缓存：缓存结果仍可正常加解密往返', async () => {
  const salt = new Uint8Array([7, 7, 7]);
  const k1 = await C.deriveKey('缓存往返密码', salt);
  const k2 = await C.deriveKey('缓存往返密码', salt);
  const bundle = await C.encryptText('缓存命中后的加解密', k2);
  assert.equal(await C.decryptBundle(bundle, k1), '缓存命中后的加解密');
});