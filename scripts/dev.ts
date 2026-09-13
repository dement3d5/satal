import {spawn, type ChildProcess} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const nextEntry = fileURLToPath(import.meta.resolve('next/dist/bin/next'));
const tsxEntry = fileURLToPath(import.meta.resolve('tsx/cli'));
const children: ChildProcess[] = [
  spawn(process.execPath, [nextEntry, 'dev', ...process.argv.slice(2)], {stdio: 'inherit'}),
  spawn(process.execPath, [tsxEntry, 'scripts/media-worker.ts'], {stdio: 'inherit'})
];
let stopping = false;

function stop(exitCode: number): void {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => stop(0));
}
for (const child of children) {
  child.once('error', () => stop(1));
  child.once('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
