// Executa um script Python das specs usando o venv local (.venv) quando existir.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const venv = process.platform === 'win32' ? path.join('.venv', 'Scripts', 'python.exe') : path.join('.venv', 'bin', 'python');
const python = fs.existsSync(venv) ? venv : 'python';
const result = spawnSync(python, process.argv.slice(2), { stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
process.exit(result.status ?? 1);
