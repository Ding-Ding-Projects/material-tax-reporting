'use strict';

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

const KEY_BYTES = 32;

const POWERSHELL_CREDENTIAL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class LocalHistoryCredentialManager
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL
    {
        public UInt32 Flags;
        public UInt32 Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);

    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);

    [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

    [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
    public static extern void CredFree(IntPtr credential);
}
'@

$requestText = [Console]::In.ReadToEnd()
$request = $requestText | ConvertFrom-Json
$credentialType = [UInt32]1

if ($request.operation -eq 'read') {
    $pointer = [IntPtr]::Zero
    if (-not [LocalHistoryCredentialManager]::CredRead($request.target, $credentialType, 0, [ref]$pointer)) {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($errorCode -eq 1168) {
            [Console]::Out.Write('{"found":false}')
            exit 0
        }
        throw "Credential Manager read failed with Windows error $errorCode."
    }

    try {
        $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
            $pointer,
            [type][LocalHistoryCredentialManager+CREDENTIAL]
        )
        $bytes = New-Object byte[] $credential.CredentialBlobSize
        if ($credential.CredentialBlobSize -gt 0) {
            [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $bytes.Length)
        }
        $response = @{ found = $true; secret = [Convert]::ToBase64String($bytes) } | ConvertTo-Json -Compress
        [Console]::Out.Write($response)
    }
    finally {
        [LocalHistoryCredentialManager]::CredFree($pointer)
    }
    exit 0
}

if ($request.operation -eq 'write') {
    $bytes = [Convert]::FromBase64String([string]$request.secret)
    $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    try {
        [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
        $credential = New-Object LocalHistoryCredentialManager+CREDENTIAL
        $credential.Type = $credentialType
        $credential.TargetName = [string]$request.target
        $credential.CredentialBlobSize = [UInt32]$bytes.Length
        $credential.CredentialBlob = $blob
        $credential.Persist = [UInt32]2
        $credential.UserName = [Environment]::UserName
        if (-not [LocalHistoryCredentialManager]::CredWrite([ref]$credential, 0)) {
            $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "Credential Manager write failed with Windows error $errorCode."
        }
        [Console]::Out.Write('{"stored":true}')
    }
    finally {
        [Runtime.InteropServices.Marshal]::FreeHGlobal($blob)
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
    exit 0
}

if ($request.operation -eq 'delete') {
    if (-not [LocalHistoryCredentialManager]::CredDelete($request.target, $credentialType, 0)) {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($errorCode -ne 1168) {
            throw "Credential Manager delete failed with Windows error $errorCode."
        }
    }
    [Console]::Out.Write('{"deleted":true}')
    exit 0
}

throw 'Unsupported credential operation.'
`;

function encodedPowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

class HistoryKeyVaultError extends Error {
  constructor(code, message, recovery) {
    super(message);
    this.name = 'HistoryKeyVaultError';
    this.code = code;
    this.recovery = recovery;
  }
}

class HistoryKeyVault {
  constructor({ credentialTarget }) {
    if (typeof credentialTarget !== 'string' || credentialTarget.trim().length === 0) {
      throw new TypeError('credentialTarget must be a stable, non-empty string.');
    }
    this.credentialTarget = credentialTarget;
  }

  readKey() {
    const response = this.#invoke({ operation: 'read', target: this.credentialTarget });
    if (!response.found) return null;

    const key = Buffer.from(response.secret, 'base64');
    if (key.length !== KEY_BYTES) {
      key.fill(0);
      throw new HistoryKeyVaultError(
        'INVALID_HISTORY_KEY',
        'The local history encryption key has an unexpected size.',
        'Restore the matching Windows credential and local history repository from backup.'
      );
    }
    return key;
  }

  getOrCreateKey({ allowCreate = true } = {}) {
    const existing = this.readKey();
    if (existing) return existing;
    if (!allowCreate) {
      throw new HistoryKeyVaultError(
        'HISTORY_KEY_MISSING',
        'The Windows credential for this local history repository is missing.',
        'Restore the credential from backup or reset the local history repository explicitly.'
      );
    }

    const created = crypto.randomBytes(KEY_BYTES);
    try {
      this.#invoke({
        operation: 'write',
        target: this.credentialTarget,
        secret: created.toString('base64')
      });
      return Buffer.from(created);
    } finally {
      created.fill(0);
    }
  }

  deleteKey() {
    this.#invoke({ operation: 'delete', target: this.credentialTarget });
  }

  #invoke(request) {
    if (process.platform !== 'win32') {
      throw new HistoryKeyVaultError(
        'WINDOWS_CREDENTIAL_VAULT_UNAVAILABLE',
        'Local history encryption requires Windows Credential Manager.',
        'Open this data with the Windows desktop application on the computer that owns the credential.'
      );
    }

    const executable = process.env.SystemRoot
      ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
      : 'powershell.exe';
    const result = spawnSync(
      executable,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodedPowerShell(POWERSHELL_CREDENTIAL_SCRIPT)],
      {
        input: JSON.stringify(request),
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        timeout: 20_000
      }
    );

    if (result.error || result.status !== 0) {
      throw new HistoryKeyVaultError(
        'WINDOWS_CREDENTIAL_VAULT_FAILURE',
        'Windows Credential Manager could not complete the local history key operation.',
        'Check Windows Credential Manager availability and retry without deleting the history repository.'
      );
    }

    try {
      return JSON.parse(result.stdout || '{}');
    } catch {
      throw new HistoryKeyVaultError(
        'WINDOWS_CREDENTIAL_VAULT_RESPONSE_INVALID',
        'Windows Credential Manager returned an unreadable response.',
        'Retry the operation; preserve the existing credential and history repository.'
      );
    }
  }
}

module.exports = {
  HistoryKeyVault,
  HistoryKeyVaultError,
  KEY_BYTES
};
