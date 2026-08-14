/* encryption.js - 可选加密核心：PBKDF2(600k) 派生 + AES-GCM-256 + 迁移自检锁
 * 兼容浏览器(<script> 暴露 window.SonderCrypto)与 Node(module.exports)。
 * 设计要点：
 *  - 每次加密使用全新的 12 字节随机 IV（GCM 禁止 IV 重用）
 *  - Salt 由 getRandomValues 生成 16 字节，随密文同存（salt 无需保密）
 *  - 解密失败一律抛错（GCM 认证标签兜底），绝不返回脏数据
 *  - selfTest 供"迁移自检锁"：密码先加密-解密 'test_migration_safety' 通过后才允许动真实数据 */
(function () {
  'use strict';

  var cr = (typeof crypto !== 'undefined' && crypto) ? crypto : globalThis.crypto;
  var ALGO = { name: 'AES-GCM', length: 256 };
  var ITERATIONS = 600000;
  var BUNDLE_V = 'sonder-enc-v1';

  function requireCrypto() {
    if (!cr || !cr.subtle) throw new Error('当前环境不支持 Web Crypto（AES-GCM/PBKDF2）');
    return cr;
  }

  function bytesToB64(bytes) {
    var bin = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToText(bytes) {
    return new TextDecoder().decode(bytes);
  }

  /* 随机盐（16 字节）——严禁硬编码，随数据存储 */
  function saltBytes() { return cr.getRandomValues(new Uint8Array(16)); }
  /* 全新随机 IV（12 字节）——每次加密必须重新生成 */
  function ivBytes() { return cr.getRandomValues(new Uint8Array(12)); }

  /* PBKDF2(600k, SHA-256) 派生 AES-GCM-256 密钥，可导出便于测试盐/密码不同性。
   * 会话缓存：页面未刷新时相同 (密码, 盐, 迭代数) 只派第一次，不再重跑 60 万次迭代。
   * 指纹 = SHA-256(密码字节 + 盐 + 迭代数)：毫秒级摘要即可命中；指纹不可还原密码。
   * 密钥仅存内存闭包，随页面关闭释放。 */
  var derivedKeyCache = { fp: null, it: 0, key: null };
  function bytesEq(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function deriveKey(password, salt, iterations) {
    requireCrypto();
    var pw = new TextEncoder().encode(String(password));
    var it = typeof iterations === 'number' ? iterations : ITERATIONS;
    var fpBuf = new Uint8Array(pw.length + salt.length + 4);
    fpBuf.set(pw, 0);
    fpBuf.set(salt, pw.length);
    fpBuf[fpBuf.length - 4] = (it >>> 24) & 0xff;
    fpBuf[fpBuf.length - 3] = (it >>> 16) & 0xff;
    fpBuf[fpBuf.length - 2] = (it >>> 8) & 0xff;
    fpBuf[fpBuf.length - 1] = it & 0xff;
    return cr.subtle.digest('SHA-256', fpBuf).then(function (fpHash) {
      var fp = new Uint8Array(fpHash);
      if (derivedKeyCache.key !== null && derivedKeyCache.it === it && bytesEq(derivedKeyCache.fp, fp)) {
        return derivedKeyCache.key;
      }
      return cr.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveKey']).then(function (base) {
        return cr.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: it, hash: 'SHA-256' },
          base, ALGO, true, ['encrypt', 'decrypt']
        );
      }).then(function (key) {
        derivedKeyCache = { fp: fp, it: it, key: key };
        return key;
      });
    });
  }

  /* 加密文本 → { v, iv, data }；iv 与 data 均为 base64。默认仅加密文本，二进制由上层按需封包 */
  function encryptText(text, key) {
    requireCrypto();
    var iv = ivBytes();
    return cr.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(String(text)))
      .then(function (cipher) {
        return { v: BUNDLE_V, iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(cipher)) };
      });
  }

  /* 解密 bundle → 原始文本；密码错误 / 数据被篡改 / 结构异常一律抛错 */
  function decryptBundle(bundle, key) {
    requireCrypto();
    if (!bundle || typeof bundle !== 'object' || !bundle.iv || !bundle.data) {
      return Promise.reject(new Error('密文数据格式不完整'));
    }
    var iv = b64ToBytes(bundle.iv);
    if (iv.length !== 12) return Promise.reject(new Error('IV 非法（应为 12 字节）'));
    return cr.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, b64ToBytes(bundle.data))
      .then(function (plain) { return bytesToText(new Uint8Array(plain)); });
  }

  /* 迁移自检锁：用该密码 encrypt('test_migration_safety') → decrypt 必须原样返回 */
  function selfTest(password, salt) {
    var marker = 'test_migration_safety';
    return deriveKey(password, salt).then(function (key) {
      return encryptText(marker, key).then(function (bundle) {
        return decryptBundle(bundle, key).then(function (out) {
          return out === marker;
        });
      });
    });
  }

  var api = {
    ALGO: ALGO,
    ITERATIONS: ITERATIONS,
    BUNDLE_V: BUNDLE_V,
    saltBytes: saltBytes,
    ivBytes: ivBytes,
    deriveKey: deriveKey,
    encryptText: encryptText,
    decryptBundle: decryptBundle,
    selfTest: selfTest,
    bytesToB64: bytesToB64,
    b64ToBytes: b64ToBytes
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SonderCrypto = api;
})();