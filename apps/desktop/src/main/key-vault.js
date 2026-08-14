'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { safeStorage } = require('electron');

const KEY_BYTES = 32;

function atomicWrite(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const handle = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(handle, bytes);
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  fs.renameSync(temporary, filePath);
}

class KeyVault {
  constructor(vaultRoot) {
    this.vaultRoot = path.resolve(vaultRoot);
  }

  fileFor(instanceId) {
    if (!/^[0-9a-f-]{36}$/i.test(instanceId)) throw new Error('Invalid project instance identifier.');
    return path.join(this.vaultRoot, `${instanceId}.key`);
  }

  put(instanceId, key) {
    if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) throw new Error('Invalid project data key.');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows protected storage is unavailable.');
    const encrypted = safeStorage.encryptString(key.toString('base64'));
    atomicWrite(this.fileFor(instanceId), encrypted);
  }

  get(instanceId) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows protected storage is unavailable.');
    const encrypted = fs.readFileSync(this.fileFor(instanceId));
    const key = Buffer.from(safeStorage.decryptString(encrypted), 'base64');
    if (key.length !== KEY_BYTES) {
      key.fill(0);
      throw new Error('The protected project data key is invalid.');
    }
    return key;
  }

  remove(instanceId) {
    const filePath = this.fileFor(instanceId);
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
  }
}

module.exports = { KEY_BYTES, KeyVault, atomicWrite };
