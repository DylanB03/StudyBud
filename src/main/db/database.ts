import { randomUUID } from 'node:crypto';

import Database from 'better-sqlite3';
import { desc, eq } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { jobsTable, settingsTable, subjectsTable } from './schema';

const schema = { settingsTable, subjectsTable, jobsTable };

type SubjectRow = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

type SettingRow = {
  key: string;
  value: string;
  encrypted: boolean;
  updatedAt: number;
};

export class DatabaseService {
  private readonly sqlite: Database.Database;
  private readonly db: BetterSQLite3Database<typeof schema>;

  constructor(dbPath: string) {
    this.sqlite = new Database(dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.runBootstrapMigrations();
    this.db = drizzle(this.sqlite, { schema });
  }

  private runBootstrapMigrations(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        encrypted INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  getSetting(key: string): SettingRow | null {
    const row =
      this.db.select().from(settingsTable).where(eq(settingsTable.key, key)).get() ??
      null;
    return row;
  }

  upsertSetting(key: string, value: string, encrypted: boolean): SettingRow {
    const now = Date.now();
    this.db
      .insert(settingsTable)
      .values({
        key,
        value,
        encrypted,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: {
          value,
          encrypted,
          updatedAt: now,
        },
      })
      .run();

    return {
      key,
      value,
      encrypted,
      updatedAt: now,
    };
  }

  deleteSetting(key: string): void {
    this.db.delete(settingsTable).where(eq(settingsTable.key, key)).run();
  }

  listSubjects(): SubjectRow[] {
    return this.db
      .select()
      .from(subjectsTable)
      .orderBy(desc(subjectsTable.updatedAt))
      .all();
  }

  createSubject(name: string): SubjectRow {
    const now = Date.now();
    const subject: SubjectRow = {
      id: randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(subjectsTable).values(subject).run();
    return subject;
  }

  close(): void {
    this.sqlite.close();
  }
}
