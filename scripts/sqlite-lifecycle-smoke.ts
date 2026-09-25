import assert from 'node:assert/strict';
import { nativeDatabase } from '../packages/db/src/native.js';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
assert.equal(typeof global.gc, 'function', 'Run Node with --expose-gc');
const db = nativeDatabase(':memory:');
try {
  for (let batch = 0; batch < 10; batch++) {
    for (let i = 0; i < 1000; i++) assert.equal(db.prepare('SELECT 42').pluck().get(), 42);
    global.gc!();
  }
} finally {
  db.close();
}
global.gc!();
console.log('ratlas SQLite statement lifecycle and explicit garbage collection passed');
