'use strict';

/**
 * The application's single executable-discovery and external-editor path.
 *
 * Discovery is delegated to the shared local coding assistants package, so no
 * second discovery routine exists here. A handoff only ever opens the file
 * that was just written or the folder that contains it; the app-private
 * instances root is never revealed and never opened.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { shell } = require('electron');
const { discoverCodingAssistantExecutables } = require('@material-tax-reporting/local-coding-assistants');

const PROBE_TIMEOUT_MS = 5000;

function discoveryHost() {
  return {
    platform: process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux',
    environment: process.env,
    async isFile(candidate) {
      try { return fs.statSync(candidate).isFile(); } catch { return false; }
    },
    async resolveOnPath() {
      // Resolution on the search path is delegated to the shared package's own
      // known-location list; this host never guesses a program location.
      return null;
    },
    async probeDirect(executablePath, args, options) {
      return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let settled = false;
        const child = spawn(executablePath, [...args], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          child.kill();
          resolve({ exitCode: -1, stdout, stderr, timedOut: true });
        }, options.timeoutMs ?? PROBE_TIMEOUT_MS);
        child.stdout?.on('data', (chunk) => { stdout += String(chunk).slice(0, 4096); });
        child.stderr?.on('data', (chunk) => { stderr += String(chunk).slice(0, 4096); });
        child.on('error', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ exitCode: -1, stdout, stderr, timedOut: false });
        });
        child.on('close', (code) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ exitCode: code ?? -1, stdout, stderr, timedOut: false });
        });
      });
    },
  };
}

let cached = null;

/** Discovered local executables, or an empty list when none were detected. */
async function discoverExecutables({ refresh = false } = {}) {
  if (cached && !refresh) return cached;
  try {
    cached = [...(await discoverCodingAssistantExecutables(discoveryHost()))];
  } catch {
    cached = [];
  }
  return cached;
}

/** A plain-language status for a surface, including the honest empty case. */
async function editorStatus(options) {
  const discovered = await discoverExecutables(options);
  const launchable = discovered.filter((entry) => entry.launchable);
  return {
    detected: launchable.length > 0,
    executables: launchable.map((entry) => ({ id: entry.assistantId, path: entry.path, version: entry.version })),
    blockers: discovered.filter((entry) => !entry.launchable).map((entry) => ({ id: entry.assistantId, blocker: entry.blocker ?? 'This installation could not be started directly.' })),
    message: launchable.length > 0
      ? 'A supported local editor was detected. Opening a file starts it directly, without a shell.'
      : 'No supported editor was detected on this computer. Use Reveal in folder instead.',
  };
}

/** Opens the containing folder of a file that was just written. */
async function revealInFolder(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error('That file no longer exists.');
  shell.showItemInFolder(resolved);
  return { revealed: true, folder: path.dirname(resolved) };
}

/** Opens one file in a detected editor, or reports the honest fallback. */
async function openInEditor(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error('That file no longer exists.');
  const status = await editorStatus();
  if (!status.detected) return { opened: false, message: status.message };
  const chosen = status.executables[0];
  const child = spawn(chosen.path, [resolved], { shell: false, windowsHide: true, stdio: 'ignore', detached: false });
  if (!child.pid) return { opened: false, message: 'The detected editor did not start.' };
  return { opened: true, message: `Opened the exported file with the detected ${chosen.id} installation.` };
}

module.exports = { discoverExecutables, editorStatus, openInEditor, revealInFolder };
