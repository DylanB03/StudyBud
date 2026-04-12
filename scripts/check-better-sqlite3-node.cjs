#!/usr/bin/env node

const path = require('node:path');

const formatError = (error) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

try {
  const BetterSqlite3 = require('better-sqlite3');
  const database = new BetterSqlite3(':memory:');
  const row = database.prepare('select 1 as ok').get();
  database.close();

  if (!row || row.ok !== 1) {
    throw new Error('better-sqlite3 loaded, but the smoke query did not return the expected result.');
  }

  process.stdout.write(
    `better-sqlite3 is ready for Node tests in ${path.resolve(process.cwd())}\n`,
  );
} catch (error) {
  process.stderr.write(
    [
      'better-sqlite3 is not ready for the current Node test runtime.',
      `Cause: ${formatError(error)}`,
      '',
      'Try one of these fixes:',
      '1. npm run rebuild:native:node',
      '2. npm install',
      '3. If you switched environments (for example Windows <-> WSL), reinstall dependencies in the current environment.',
    ].join('\n') + '\n',
  );
  process.exitCode = 1;
}
