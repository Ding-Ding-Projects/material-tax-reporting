'use strict';

/**
 * Authenticator pairing (RFC 4226 and RFC 6238).
 *
 * This is a standards utility. It is bound to no account, it grants access to
 * nothing in this application, and it performs no network access. The shared
 * secret is sealed with the operating system's protected storage using the
 * project key-vault pattern and is returned to the interface exactly once, on
 * the registration screen, so it can be paired and then never shown again.
 */

const fs = require('node:fs');
const path = require('node:path');
const { safeStorage } = require('electron');
const { atomicWrite } = require('./key-vault');
const {
  DEFAULT_DRIFT_WINDOWS,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  currentTotp,
  encodeQrMatrix,
  generateTotpSecret,
  totpUri,
  verifyTotp,
} = require('@material-tax-reporting/surface-kernel');

const MAX_ACCOUNT_LENGTH = 60;

class Authenticator {
  constructor(rootPath, issuer) {
    this.filePath = path.join(path.resolve(rootPath), 'authenticator.bin');
    this.issuer = issuer;
    this.record = undefined;
    this.pendingSecret = null;
  }

  read() {
    if (this.record !== undefined) return this.record;
    this.record = null;
    try {
      if (fs.existsSync(this.filePath) && safeStorage.isEncryptionAvailable()) {
        const parsed = JSON.parse(safeStorage.decryptString(fs.readFileSync(this.filePath)));
        if (parsed && parsed.schemaVersion === 1 && typeof parsed.secret === 'string') this.record = parsed;
      }
    } catch {
      this.record = null;
    }
    return this.record;
  }

  persist(record) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Operating-system protected storage is unavailable, so a shared secret cannot be stored.');
    atomicWrite(this.filePath, safeStorage.encryptString(JSON.stringify(record)));
    this.record = record;
  }

  status() {
    const record = this.read();
    return {
      registered: Boolean(record),
      confirmed: Boolean(record?.confirmed),
      issuer: this.issuer,
      account: record?.account ?? '',
      createdAt: record?.createdAt ?? null,
      confirmedAt: record?.confirmedAt ?? null,
      digits: TOTP_DIGITS,
      periodSeconds: TOTP_PERIOD_SECONDS,
      driftWindows: DEFAULT_DRIFT_WINDOWS,
      recovery:
        'There is no network, no email and no server-side recovery here. If the shared secret is lost, remove the pairing and register again.',
    };
  }

  /**
   * Starts a registration and returns the pairing three ways: a locally
   * painted QR matrix, the raw URI, and the manual base32 secret.
   */
  register(account) {
    const normalized = String(account ?? '').trim().slice(0, MAX_ACCOUNT_LENGTH) || 'local-account';
    const secret = generateTotpSecret();
    const uri = totpUri({ issuer: this.issuer, account: normalized, secret });
    this.pendingSecret = { secret, account: normalized, createdAt: new Date().toISOString() };
    return {
      account: normalized,
      issuer: this.issuer,
      secret,
      uri,
      matrix: encodeQrMatrix(uri),
      digits: TOTP_DIGITS,
      periodSeconds: TOTP_PERIOD_SECONDS,
      note: 'The pairing is generated on this computer and is not transmitted anywhere. Record it now: the secret is not shown again after this screen is dismissed.',
    };
  }

  async confirm(code) {
    const pending = this.pendingSecret;
    if (!pending) throw new Error('Start a registration before confirming a code.');
    const accepted = await verifyTotp(pending.secret, String(code ?? ''), Date.now(), DEFAULT_DRIFT_WINDOWS);
    if (!accepted) return { ok: false, message: 'That code was not accepted. Check that the authenticator clock is correct and enter the current code.' };
    this.persist({
      schemaVersion: 1,
      secret: pending.secret,
      account: pending.account,
      createdAt: pending.createdAt,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
    });
    this.pendingSecret = null;
    return { ok: true, status: this.status() };
  }

  /** The current code and the remaining seconds in this window. */
  async current() {
    const record = this.read();
    if (!record) throw new Error('No authenticator pairing is registered.');
    const now = Date.now();
    const code = await currentTotp(record.secret, now);
    const next = await currentTotp(record.secret, now + TOTP_PERIOD_SECONDS * 1000);
    const elapsed = Math.floor(now / 1000) % TOTP_PERIOD_SECONDS;
    return { code, next, secondsRemaining: TOTP_PERIOD_SECONDS - elapsed, periodSeconds: TOTP_PERIOD_SECONDS };
  }

  remove() {
    if (fs.existsSync(this.filePath)) fs.rmSync(this.filePath, { force: true });
    this.record = null;
    this.pendingSecret = null;
    return this.status();
  }

  /** Verifies a code without disclosing the stored secret. */
  async verify(code) {
    const record = this.read();
    if (!record) return false;
    return verifyTotp(record.secret, String(code ?? ''), Date.now(), DEFAULT_DRIFT_WINDOWS);
  }
}

module.exports = { Authenticator, MAX_ACCOUNT_LENGTH };
