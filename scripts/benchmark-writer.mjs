import { dataset, openWriter } from '../packages/db/dist/index.js';
const writer = openWriter(process.argv[2]);
if (dataset(writer.db).kind !== 'demo' || dataset(writer.db).generator_version !== 2) {
  writer.close();
  throw new Error('Benchmark writer requires the synthetic target database');
}
let commits = 0;
let closed = false;
const close = () => {
  if (!closed) {
    closed = true;
    writer.close();
  }
};
const tick = () => {
  writer.db.prepare('UPDATE source_health SET heartbeat=?').run(Date.now());
  commits++;
};
tick();
const timer = setInterval(tick, 1000);
process.send?.({ ready: true });
const stop = () => {
  clearInterval(timer);
  close();
  process.send?.({ commits }, () => process.disconnect());
};
process.once('SIGTERM', stop);
process.once('message', stop);
process.once('disconnect', () => {
  clearInterval(timer);
  close();
});
