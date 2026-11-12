import { readFileSync } from 'node:fs';
const log = readFileSync(process.argv[2], 'utf8');
const TIMESTAMP = /^\d{4}-\d\d-\d\dT[\d:.]+Z ?/;
const ANSI = /\u001b\[[\d;]*m/g;
const lines = log.split(/\r?\n/).map(l => l.replace(TIMESTAMP, '').replaceAll(ANSI, ''));
const error = lines.findIndex(l => l.startsWith('##[error]'));
const start = lines.slice(0, error).findLastIndex(l => l.startsWith('##[group]Run '));
const step = lines.slice(Math.max(0, start), error + 1).join('\n').trim();
console.log(step); console.error('bytes:', Buffer.byteLength(step));
