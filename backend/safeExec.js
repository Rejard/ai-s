const { exec, execSync, spawn } = require('child_process');
const util = require('util');

const DEFAULT_OPTS = { windowsHide: true };

function safeExecSync(command, options = {}) {
  return execSync(command, { ...DEFAULT_OPTS, ...options });
}

function safeExec(command, options = {}) {
  return util.promisify(exec)(command, { ...DEFAULT_OPTS, ...options });
}

function safeSpawn(command, args = [], options = {}) {
  return spawn(command, args, { ...DEFAULT_OPTS, ...options });
}

module.exports = { safeExec, safeExecSync, safeSpawn };
