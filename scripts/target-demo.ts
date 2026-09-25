import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  dataset,
  DEMO_REFERENCE,
  generateTargetDemo,
  migrate,
  openReader,
  openWriter,
  summary,
} from '../packages/db/src/index.js';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
process.umask(0o077);
const path = resolve('.ratlas/demo/target.sqlite');
if (existsSync(path)) {
  const db = openReader(path);
  try {
    if (dataset(db).kind !== 'demo' || dataset(db).generator_version !== 2)
      throw new Error('Existing target database is not the expected synthetic workload');
    console.log(JSON.stringify({ path, reused: true, summary: summary(db) }, null, 2));
  } finally {
    db.close();
  }
} else {
  const writer = openWriter(path);
  try {
    migrate(writer.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
    const start = performance.now();
    generateTargetDemo(writer.db, (completed) => {
      global.gc?.();
      if (completed % 2000 === 0) console.log(`Generated ${completed} of 20000 repositories`);
    });
    console.log(
      JSON.stringify(
        {
          path,
          reused: false,
          generatedMs: Math.round(performance.now() - start),
          summary: summary(writer.db),
        },
        null,
        2,
      ),
    );
  } finally {
    writer.close();
  }
}
