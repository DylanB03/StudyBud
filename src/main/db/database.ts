import { createRequire } from 'node:module';

import { desc, eq } from 'drizzle-orm';
import type Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import {
  chatMessagesTable,
  documentChunksTable,
  documentPagesTable,
  divisionsTable,
  divisionSourcePagesTable,
  jobsTable,
  practiceQuestionsTable,
  practiceSetSourcePagesTable,
  practiceSetsTable,
  problemTypesTable,
  settingsTable,
  sourceDocumentsTable,
  subjectsTable,
  unassignedPagesTable,
} from './schema';

const schema = {
  settingsTable,
  subjectsTable,
  jobsTable,
  sourceDocumentsTable,
  documentPagesTable,
  documentChunksTable,
  divisionsTable,
  divisionSourcePagesTable,
  problemTypesTable,
  unassignedPagesTable,
  chatMessagesTable,
  practiceSetsTable,
  practiceQuestionsTable,
  practiceSetSourcePagesTable,
};

const runtimeRequire = createRequire(__filename);

const loadBetterSqlite3Module = (): typeof import('better-sqlite3') => {
  return runtimeRequire('better-sqlite3') as typeof import('better-sqlite3');
};

const loadDrizzleBetterSqlite3Module = (): typeof import('drizzle-orm/better-sqlite3') => {
  return runtimeRequire('drizzle-orm/better-sqlite3') as typeof import('drizzle-orm/better-sqlite3');
};

export type SubjectRow = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type SettingRow = {
  key: string;
  value: string;
  encrypted: boolean;
  updatedAt: number;
};

export type SourceDocumentRow = {
  id: string;
  subjectId: string;
  kind: string;
  originalFileName: string;
  storedFileName: string | null;
  relativePath: string | null;
  mimeType: string;
  pageCount: number;
  ocrState: 'not-needed' | 'used' | 'partial' | 'unavailable';
  ocrAttemptedPages: number;
  ocrSucceededPages: number;
  ocrImprovedPages: number;
  ocrWarning: string | null;
  importStatus: string;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
};

export type DocumentPageRow = {
  id: string;
  documentId: string;
  pageNumber: number;
  textContent: string;
  textLength: number;
  textSource: 'native' | 'ocr' | 'merged';
  ocrAttempted: boolean;
  ocrSucceeded: boolean;
  ocrConfidence: number | null;
  ocrWarning: string | null;
  createdAt: number;
};

export type DocumentChunkRow = {
  id: string;
  documentId: string;
  pageId: string;
  chunkIndex: number;
  textContent: string;
  textLength: number;
  createdAt: number;
};

export type JobRow = {
  id: string;
  subjectId: string | null;
  type: string;
  status: string;
  message: string;
  payload: string;
  createdAt: number;
  updatedAt: number;
};

export type DivisionRow = {
  id: string;
  subjectId: string;
  title: string;
  summary: string;
  keyConceptsJson: string;
  createdAt: number;
  updatedAt: number;
};

export type DivisionSourcePageRow = {
  id: string;
  divisionId: string;
  pageId: string;
  createdAt: number;
};

export type ProblemTypeRow = {
  id: string;
  subjectId: string;
  divisionId: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
};

export type UnassignedPageRow = {
  id: string;
  subjectId: string;
  pageId: string;
  reason: string | null;
  createdAt: number;
};

export type ChatMessageRow = {
  id: string;
  subjectId: string;
  divisionId: string;
  role: string;
  content: string;
  citationsJson: string;
  followupsJson: string;
  suggestedSearchQueriesJson: string;
  suggestedVideoQueriesJson: string;
  selectionContextJson: string | null;
  createdAt: number;
};

export type PracticeSetRow = {
  id: string;
  subjectId: string;
  divisionId: string;
  problemTypeId: string;
  problemTypeTitle: string;
  difficulty: string;
  questionCount: number;
  createdAt: number;
  updatedAt: number;
};

export type PracticeQuestionRow = {
  id: string;
  practiceSetId: string;
  questionIndex: number;
  prompt: string;
  answer: string;
  revealed: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PracticeSetRecord = {
  practiceSet: PracticeSetRow;
  questions: PracticeQuestionRow[];
  sourcePages: SubjectPageContextRow[];
};

export type SubjectPageContextRow = {
  pageId: string;
  documentId: string;
  documentKind: string;
  documentName: string;
  pageNumber: number;
  textContent: string;
  textLength: number;
  textSource: 'native' | 'ocr' | 'merged';
};

export type SubjectChunkContextRow = {
  chunkId: string;
  documentId: string;
  pageId: string;
  pageNumber: number;
  documentName: string;
  documentKind: string;
  chunkIndex: number;
  textContent: string;
  textLength: number;
};

export type SubjectAnalysisRecord = {
  divisions: Array<{
    division: DivisionRow;
    keyConcepts: string[];
    sourcePages: SubjectPageContextRow[];
    problemTypes: ProblemTypeRow[];
  }>;
  unassignedPages: Array<{
    row: UnassignedPageRow;
    page: SubjectPageContextRow;
  }>;
};

export type InsertChatMessageInput = Omit<ChatMessageRow, 'createdAt'>;

export type InsertPracticeSetInput = {
  practiceSet: Omit<PracticeSetRow, 'createdAt' | 'updatedAt'>;
  sourcePageIds: string[];
  questions: Array<Omit<PracticeQuestionRow, 'practiceSetId' | 'createdAt' | 'updatedAt'>>;
};

export type InsertImportedDocumentInput = {
  document: Omit<
    SourceDocumentRow,
    | 'createdAt'
    | 'updatedAt'
    | 'ocrState'
    | 'ocrAttemptedPages'
    | 'ocrSucceededPages'
    | 'ocrImprovedPages'
    | 'ocrWarning'
  > & {
    ocrState?: SourceDocumentRow['ocrState'];
    ocrAttemptedPages?: number;
    ocrSucceededPages?: number;
    ocrImprovedPages?: number;
    ocrWarning?: string | null;
  };
  pages: Array<{
    id: string;
    pageNumber: number;
    textContent: string;
    textSource?: DocumentPageRow['textSource'];
    ocrAttempted?: boolean;
    ocrSucceeded?: boolean;
    ocrConfidence?: number | null;
    ocrWarning?: string | null;
  }>;
  chunks: Array<{
    id: string;
    pageId: string;
    chunkIndex: number;
    textContent: string;
  }>;
};

const createNow = (): number => Date.now();
type BetterSqlite3Constructor = new (path: string) => Database.Database;

const DEFAULT_DOCUMENT_OCR_STATE: SourceDocumentRow['ocrState'] = 'not-needed';
const DEFAULT_PAGE_TEXT_SOURCE: DocumentPageRow['textSource'] = 'native';

const normalizeDocumentRow = (
  row: Omit<SourceDocumentRow, 'ocrState'> & { ocrState: string },
): SourceDocumentRow => {
  return {
    ...row,
    ocrState:
      row.ocrState === 'used' ||
      row.ocrState === 'partial' ||
      row.ocrState === 'unavailable'
        ? row.ocrState
        : DEFAULT_DOCUMENT_OCR_STATE,
  };
};

const normalizeDocumentPageRow = (
  row: Omit<DocumentPageRow, 'textSource'> & { textSource: string },
): DocumentPageRow => {
  return {
    ...row,
    textSource:
      row.textSource === 'ocr' || row.textSource === 'merged'
        ? row.textSource
        : DEFAULT_PAGE_TEXT_SOURCE,
  };
};

export class DatabaseService {
  private readonly sqlite: Database.Database;
  private readonly db: BetterSQLite3Database<typeof schema>;

  constructor(dbPath: string) {
    const betterSqlite3Module = loadBetterSqlite3Module();
    const BetterSqlite3 =
      'default' in betterSqlite3Module
        ? betterSqlite3Module.default
        : betterSqlite3Module;
    const { drizzle } = loadDrizzleBetterSqlite3Module();

    this.sqlite = new (BetterSqlite3 as BetterSqlite3Constructor)(dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.runBootstrapMigrations();
    this.db = drizzle(this.sqlite, { schema });
  }

  private hasColumn(tableName: string, columnName: string): boolean {
    const rows = this.sqlite
      .prepare(`PRAGMA table_info(${tableName});`)
      .all() as Array<{ name: string }>;

    return rows.some((row) => row.name === columnName);
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

    if (!this.hasColumn('jobs', 'subject_id')) {
      this.sqlite.exec(`ALTER TABLE jobs ADD COLUMN subject_id TEXT;`);
    }

    if (!this.hasColumn('jobs', 'message')) {
      this.sqlite.exec(`ALTER TABLE jobs ADD COLUMN message TEXT NOT NULL DEFAULT '';`);
    }

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS source_documents (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        stored_file_name TEXT,
        relative_path TEXT,
        mime_type TEXT NOT NULL,
        page_count INTEGER NOT NULL DEFAULT 0,
        ocr_state TEXT NOT NULL DEFAULT 'not-needed',
        ocr_attempted_pages INTEGER NOT NULL DEFAULT 0,
        ocr_succeeded_pages INTEGER NOT NULL DEFAULT 0,
        ocr_improved_pages INTEGER NOT NULL DEFAULT 0,
        ocr_warning TEXT,
        import_status TEXT NOT NULL,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    if (!this.hasColumn('source_documents', 'ocr_state')) {
      this.sqlite.exec(
        `ALTER TABLE source_documents ADD COLUMN ocr_state TEXT NOT NULL DEFAULT 'not-needed';`,
      );
    }

    if (!this.hasColumn('source_documents', 'ocr_attempted_pages')) {
      this.sqlite.exec(
        `ALTER TABLE source_documents ADD COLUMN ocr_attempted_pages INTEGER NOT NULL DEFAULT 0;`,
      );
    }

    if (!this.hasColumn('source_documents', 'ocr_succeeded_pages')) {
      this.sqlite.exec(
        `ALTER TABLE source_documents ADD COLUMN ocr_succeeded_pages INTEGER NOT NULL DEFAULT 0;`,
      );
    }

    if (!this.hasColumn('source_documents', 'ocr_improved_pages')) {
      this.sqlite.exec(
        `ALTER TABLE source_documents ADD COLUMN ocr_improved_pages INTEGER NOT NULL DEFAULT 0;`,
      );
    }

    if (!this.hasColumn('source_documents', 'ocr_warning')) {
      this.sqlite.exec(`ALTER TABLE source_documents ADD COLUMN ocr_warning TEXT;`);
    }

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS document_pages (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        text_content TEXT NOT NULL,
        text_length INTEGER NOT NULL,
        text_source TEXT NOT NULL DEFAULT 'native',
        ocr_attempted INTEGER NOT NULL DEFAULT 0,
        ocr_succeeded INTEGER NOT NULL DEFAULT 0,
        ocr_confidence REAL,
        ocr_warning TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    if (!this.hasColumn('document_pages', 'text_source')) {
      this.sqlite.exec(
        `ALTER TABLE document_pages ADD COLUMN text_source TEXT NOT NULL DEFAULT 'native';`,
      );
    }

    if (!this.hasColumn('document_pages', 'ocr_attempted')) {
      this.sqlite.exec(
        `ALTER TABLE document_pages ADD COLUMN ocr_attempted INTEGER NOT NULL DEFAULT 0;`,
      );
    }

    if (!this.hasColumn('document_pages', 'ocr_succeeded')) {
      this.sqlite.exec(
        `ALTER TABLE document_pages ADD COLUMN ocr_succeeded INTEGER NOT NULL DEFAULT 0;`,
      );
    }

    if (!this.hasColumn('document_pages', 'ocr_confidence')) {
      this.sqlite.exec(`ALTER TABLE document_pages ADD COLUMN ocr_confidence REAL;`);
    }

    if (!this.hasColumn('document_pages', 'ocr_warning')) {
      this.sqlite.exec(`ALTER TABLE document_pages ADD COLUMN ocr_warning TEXT;`);
    }

    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS document_pages_document_idx
      ON document_pages(document_id, page_number);
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        page_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        text_content TEXT NOT NULL,
        text_length INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS document_chunks_document_idx
      ON document_chunks(document_id, page_id, chunk_index);
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS divisions (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        key_concepts_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS divisions_subject_idx
      ON divisions(subject_id, created_at);
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS division_source_pages (
        id TEXT PRIMARY KEY,
        division_id TEXT NOT NULL,
        page_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS division_source_pages_division_idx
      ON division_source_pages(division_id, page_id);
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS problem_types (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        division_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS problem_types_division_idx
      ON problem_types(subject_id, division_id, created_at);
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS unassigned_pages (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        page_id TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS unassigned_pages_subject_idx
      ON unassigned_pages(subject_id, page_id);
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        division_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        citations_json TEXT NOT NULL,
        followups_json TEXT NOT NULL,
        suggested_search_queries_json TEXT NOT NULL DEFAULT '[]',
        suggested_video_queries_json TEXT NOT NULL DEFAULT '[]',
        selection_context_json TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    if (!this.hasColumn('chat_messages', 'suggested_search_queries_json')) {
      this.sqlite.exec(`
        ALTER TABLE chat_messages
        ADD COLUMN suggested_search_queries_json TEXT NOT NULL DEFAULT '[]';
      `);
    }

    if (!this.hasColumn('chat_messages', 'suggested_video_queries_json')) {
      this.sqlite.exec(`
        ALTER TABLE chat_messages
        ADD COLUMN suggested_video_queries_json TEXT NOT NULL DEFAULT '[]';
      `);
    }

    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS chat_messages_division_idx
      ON chat_messages(subject_id, division_id, created_at);
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS practice_sets (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        division_id TEXT NOT NULL,
        problem_type_id TEXT NOT NULL,
        problem_type_title TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        question_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS practice_sets_division_idx
      ON practice_sets(subject_id, division_id, created_at);
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS practice_questions (
        id TEXT PRIMARY KEY,
        practice_set_id TEXT NOT NULL,
        question_index INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        answer TEXT NOT NULL,
        revealed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS practice_questions_set_idx
      ON practice_questions(practice_set_id, question_index);
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS practice_set_source_pages (
        id TEXT PRIMARY KEY,
        practice_set_id TEXT NOT NULL,
        page_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS practice_set_source_pages_set_idx
      ON practice_set_source_pages(practice_set_id, page_id);
    `);
  }

  getSetting(key: string): SettingRow | null {
    return (
      this.db.select().from(settingsTable).where(eq(settingsTable.key, key)).get() ??
      null
    );
  }

  upsertSetting(key: string, value: string, encrypted: boolean): SettingRow {
    const now = createNow();
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

  getSubjectById(subjectId: string): SubjectRow | null {
    return (
      this.db
        .select()
        .from(subjectsTable)
        .where(eq(subjectsTable.id, subjectId))
        .get() ?? null
    );
  }

  createSubjectWithId(name: string, id: string): SubjectRow {
    const now = createNow();
    const subject: SubjectRow = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(subjectsTable).values(subject).run();
    return subject;
  }

  deleteSubject(subjectId: string): SubjectRow | null {
    const subject = this.getSubjectById(subjectId);

    if (!subject) {
      return null;
    }

    const divisionIds = this.db
      .select({ id: divisionsTable.id })
      .from(divisionsTable)
      .where(eq(divisionsTable.subjectId, subjectId))
      .all()
      .map((row) => row.id);

    const documentIds = this.db
      .select({ id: sourceDocumentsTable.id })
      .from(sourceDocumentsTable)
      .where(eq(sourceDocumentsTable.subjectId, subjectId))
      .all()
      .map((row) => row.id);

    const transaction = this.sqlite.transaction(() => {
      for (const divisionId of divisionIds) {
        this.db
          .delete(divisionSourcePagesTable)
          .where(eq(divisionSourcePagesTable.divisionId, divisionId))
          .run();
      }

      for (const documentId of documentIds) {
        this.db
          .delete(documentChunksTable)
          .where(eq(documentChunksTable.documentId, documentId))
          .run();
        this.db
          .delete(documentPagesTable)
          .where(eq(documentPagesTable.documentId, documentId))
          .run();
      }

      this.db
        .delete(problemTypesTable)
        .where(eq(problemTypesTable.subjectId, subjectId))
        .run();
      this.db
        .delete(divisionsTable)
        .where(eq(divisionsTable.subjectId, subjectId))
        .run();
      this.db
        .delete(unassignedPagesTable)
        .where(eq(unassignedPagesTable.subjectId, subjectId))
        .run();
      this.db
        .delete(chatMessagesTable)
        .where(eq(chatMessagesTable.subjectId, subjectId))
        .run();
      const practiceSetIds = this.db
        .select({ id: practiceSetsTable.id })
        .from(practiceSetsTable)
        .where(eq(practiceSetsTable.subjectId, subjectId))
        .all()
        .map((row) => row.id);
      for (const practiceSetId of practiceSetIds) {
        this.db
          .delete(practiceSetSourcePagesTable)
          .where(eq(practiceSetSourcePagesTable.practiceSetId, practiceSetId))
          .run();
        this.db
          .delete(practiceQuestionsTable)
          .where(eq(practiceQuestionsTable.practiceSetId, practiceSetId))
          .run();
      }
      this.db
        .delete(practiceSetsTable)
        .where(eq(practiceSetsTable.subjectId, subjectId))
        .run();
      this.db
        .delete(jobsTable)
        .where(eq(jobsTable.subjectId, subjectId))
        .run();
      this.db
        .delete(sourceDocumentsTable)
        .where(eq(sourceDocumentsTable.subjectId, subjectId))
        .run();
      this.db
        .delete(subjectsTable)
        .where(eq(subjectsTable.id, subjectId))
        .run();
    });

    transaction();
    return subject;
  }

  touchSubject(subjectId: string): void {
    this.db
      .update(subjectsTable)
      .set({ updatedAt: createNow() })
      .where(eq(subjectsTable.id, subjectId))
      .run();
  }

  listDocumentsBySubject(subjectId: string): SourceDocumentRow[] {
    return this.db
      .select()
      .from(sourceDocumentsTable)
      .where(eq(sourceDocumentsTable.subjectId, subjectId))
      .orderBy(desc(sourceDocumentsTable.createdAt))
      .all()
      .map((row) =>
        normalizeDocumentRow(
          row as Omit<SourceDocumentRow, 'ocrState'> & { ocrState: string },
        ),
      );
  }

  getDocumentById(documentId: string): SourceDocumentRow | null {
    const row =
      this.db
        .select()
        .from(sourceDocumentsTable)
        .where(eq(sourceDocumentsTable.id, documentId))
        .get() ?? null;

    return row
      ? normalizeDocumentRow(
          row as Omit<SourceDocumentRow, 'ocrState'> & { ocrState: string },
        )
      : null;
  }

  deleteDocument(documentId: string): SourceDocumentRow | null {
    const document = this.getDocumentById(documentId);

    if (!document) {
      return null;
    }

    const transaction = this.sqlite.transaction(() => {
      this.db
        .delete(documentChunksTable)
        .where(eq(documentChunksTable.documentId, documentId))
        .run();
      this.db
        .delete(documentPagesTable)
        .where(eq(documentPagesTable.documentId, documentId))
        .run();
      this.db
        .delete(sourceDocumentsTable)
        .where(eq(sourceDocumentsTable.id, documentId))
        .run();
      this.touchSubject(document.subjectId);
    });

    transaction();
    return document;
  }

  getPagesByDocument(documentId: string): DocumentPageRow[] {
    return this.db
      .select()
      .from(documentPagesTable)
      .where(eq(documentPagesTable.documentId, documentId))
      .orderBy(documentPagesTable.pageNumber)
      .all()
      .map((row) =>
        normalizeDocumentPageRow(
          row as Omit<DocumentPageRow, 'textSource'> & { textSource: string },
        ),
      );
  }

  listChatMessagesBySubject(subjectId: string, divisionId?: string): ChatMessageRow[] {
    const base = this.db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.subjectId, subjectId))
      .orderBy(chatMessagesTable.createdAt)
      .all();

    if (!divisionId) {
      return base;
    }

    return base.filter((message) => message.divisionId === divisionId);
  }

  insertChatMessages(messages: InsertChatMessageInput[]): ChatMessageRow[] {
    const now = createNow();
    const rows = messages.map((message) => ({
      ...message,
      createdAt: now,
    }));

    if (rows.length === 0) {
      return [];
    }

    this.db.insert(chatMessagesTable).values(rows).run();
    this.touchSubject(rows[0].subjectId);
    return rows;
  }

  listPracticeSetsBySubject(subjectId: string, divisionId?: string): PracticeSetRecord[] {
    const pageMap = new Map(
      this.getReadySubjectPages(subjectId).map((page) => [page.pageId, page]),
    );
    const practiceSets = this.db
      .select()
      .from(practiceSetsTable)
      .where(eq(practiceSetsTable.subjectId, subjectId))
      .orderBy(desc(practiceSetsTable.createdAt))
      .all();

    const filteredSets = divisionId
      ? practiceSets.filter((practiceSet) => practiceSet.divisionId === divisionId)
      : practiceSets;

    return filteredSets.map((practiceSet) => ({
      practiceSet,
      questions: this.db
        .select()
        .from(practiceQuestionsTable)
        .where(eq(practiceQuestionsTable.practiceSetId, practiceSet.id))
        .orderBy(practiceQuestionsTable.questionIndex)
        .all(),
      sourcePages: this.db
        .select()
        .from(practiceSetSourcePagesTable)
        .where(eq(practiceSetSourcePagesTable.practiceSetId, practiceSet.id))
        .all()
        .map((row) => pageMap.get(row.pageId))
        .filter((page): page is SubjectPageContextRow => Boolean(page)),
    }));
  }

  insertPracticeSet(input: InsertPracticeSetInput): PracticeSetRecord {
    const now = createNow();
    const practiceSetRow: PracticeSetRow = {
      ...input.practiceSet,
      createdAt: now,
      updatedAt: now,
    };
    const questionRows: PracticeQuestionRow[] = input.questions.map((question) => ({
      ...question,
      practiceSetId: practiceSetRow.id,
      createdAt: now,
      updatedAt: now,
    }));

    const transaction = this.sqlite.transaction(() => {
      this.db.insert(practiceSetsTable).values(practiceSetRow).run();

      if (input.sourcePageIds.length > 0) {
        this.db
          .insert(practiceSetSourcePagesTable)
          .values(
            input.sourcePageIds.map((pageId, index) => ({
              id: `${practiceSetRow.id}:source:${index}:${pageId}`,
              practiceSetId: practiceSetRow.id,
              pageId,
              createdAt: now,
            })),
          )
          .run();
      }

      if (questionRows.length > 0) {
        this.db.insert(practiceQuestionsTable).values(questionRows).run();
      }

      this.touchSubject(practiceSetRow.subjectId);
    });

    transaction();

    return {
      practiceSet: practiceSetRow,
      questions: questionRows,
      sourcePages: this.getReadySubjectPages(practiceSetRow.subjectId).filter((page) =>
        input.sourcePageIds.includes(page.pageId),
      ),
    };
  }

  togglePracticeQuestionReveal(questionId: string): PracticeQuestionRow | null {
    const existing =
      this.db
        .select()
        .from(practiceQuestionsTable)
        .where(eq(practiceQuestionsTable.id, questionId))
        .get() ?? null;

    if (!existing) {
      return null;
    }

    const updatedAt = createNow();
    const nextRevealed = !existing.revealed;
    this.db
      .update(practiceQuestionsTable)
      .set({
        revealed: nextRevealed,
        updatedAt,
      })
      .where(eq(practiceQuestionsTable.id, questionId))
      .run();

    const practiceSet =
      this.db
        .select()
        .from(practiceSetsTable)
        .where(eq(practiceSetsTable.id, existing.practiceSetId))
        .get() ?? null;

    if (practiceSet) {
      this.db
        .update(practiceSetsTable)
        .set({ updatedAt })
        .where(eq(practiceSetsTable.id, practiceSet.id))
        .run();
      this.touchSubject(practiceSet.subjectId);
    }

    return {
      ...existing,
      revealed: nextRevealed,
      updatedAt,
    };
  }

  getPracticeSetByQuestionId(questionId: string): PracticeSetRecord | null {
    const question =
      this.db
        .select()
        .from(practiceQuestionsTable)
        .where(eq(practiceQuestionsTable.id, questionId))
        .get() ?? null;

    if (!question) {
      return null;
    }

    const practiceSet =
      this.db
        .select()
        .from(practiceSetsTable)
        .where(eq(practiceSetsTable.id, question.practiceSetId))
        .get() ?? null;

    if (!practiceSet) {
      return null;
    }

    const questions = this.db
      .select()
      .from(practiceQuestionsTable)
      .where(eq(practiceQuestionsTable.practiceSetId, practiceSet.id))
      .orderBy(practiceQuestionsTable.questionIndex)
      .all();
    const pageMap = new Map(
      this.getReadySubjectPages(practiceSet.subjectId).map((page) => [page.pageId, page]),
    );
    const sourcePages = this.db
      .select()
      .from(practiceSetSourcePagesTable)
      .where(eq(practiceSetSourcePagesTable.practiceSetId, practiceSet.id))
      .all()
      .map((row) => pageMap.get(row.pageId))
      .filter((page): page is SubjectPageContextRow => Boolean(page));

    return {
      practiceSet,
      questions,
      sourcePages,
    };
  }

  deletePracticeSet(practiceSetId: string): PracticeSetRow | null {
    const practiceSet =
      this.db
        .select()
        .from(practiceSetsTable)
        .where(eq(practiceSetsTable.id, practiceSetId))
        .get() ?? null;

    if (!practiceSet) {
      return null;
    }

    const transaction = this.sqlite.transaction(() => {
      this.db
        .delete(practiceSetSourcePagesTable)
        .where(eq(practiceSetSourcePagesTable.practiceSetId, practiceSetId))
        .run();
      this.db
        .delete(practiceQuestionsTable)
        .where(eq(practiceQuestionsTable.practiceSetId, practiceSetId))
        .run();
      this.db
        .delete(practiceSetsTable)
        .where(eq(practiceSetsTable.id, practiceSetId))
        .run();
      this.touchSubject(practiceSet.subjectId);
    });

    transaction();
    return practiceSet;
  }

  listJobsBySubject(subjectId: string, type?: string): JobRow[] {
    const base = this.db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.subjectId, subjectId))
      .orderBy(desc(jobsTable.createdAt))
      .all();

    if (!type) {
      return base;
    }

    return base.filter((job) => job.type === type);
  }

  reconcileInterruptedImportJobs(): number {
    const interruptedJobs = this.db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.status, 'running'))
      .all();

    for (const job of interruptedJobs) {
      const message =
        job.type === 'subject-ingestion'
          ? 'Subject analysis was interrupted before it finished. You can analyze the subject again.'
          : 'Import was interrupted before it finished. You can retry the document import.';

      this.updateJob(job.id, {
        status: 'failed',
        message,
        payload: job.payload,
      });
    }

    return interruptedJobs.length;
  }

  createImportJob(input: {
    id: string;
    subjectId: string;
    payload: string;
    message: string;
  }): JobRow {
    const now = createNow();
    const row: JobRow = {
      id: input.id,
      subjectId: input.subjectId,
      type: 'document-import',
      status: 'running',
      message: input.message,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(jobsTable).values(row).run();
    return row;
  }

  createSubjectIngestionJob(input: {
    id: string;
    subjectId: string;
    payload: string;
    message: string;
  }): JobRow {
    const now = createNow();
    const row: JobRow = {
      id: input.id,
      subjectId: input.subjectId,
      type: 'subject-ingestion',
      status: 'running',
      message: input.message,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(jobsTable).values(row).run();
    return row;
  }

  updateJob(
    jobId: string,
    input: Pick<JobRow, 'status' | 'message' | 'payload'>,
  ): JobRow {
    const existing = this.db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .get();

    if (!existing) {
      throw new Error(`Job ${jobId} not found`);
    }

    const updatedAt = createNow();
    this.db
      .update(jobsTable)
      .set({
        status: input.status,
        message: input.message,
        payload: input.payload,
        updatedAt,
      })
      .where(eq(jobsTable.id, jobId))
      .run();

    return {
      ...existing,
      status: input.status,
      message: input.message,
      payload: input.payload,
      updatedAt,
    };
  }

  insertImportedDocument(input: InsertImportedDocumentInput): SourceDocumentRow {
    const now = createNow();
    const documentRow: SourceDocumentRow = {
      ...input.document,
      ocrState: input.document.ocrState ?? DEFAULT_DOCUMENT_OCR_STATE,
      ocrAttemptedPages: input.document.ocrAttemptedPages ?? 0,
      ocrSucceededPages: input.document.ocrSucceededPages ?? 0,
      ocrImprovedPages: input.document.ocrImprovedPages ?? 0,
      ocrWarning: input.document.ocrWarning ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const transaction = this.sqlite.transaction(() => {
      this.db.insert(sourceDocumentsTable).values(documentRow).run();

      if (input.pages.length > 0) {
        this.db
          .insert(documentPagesTable)
          .values(
            input.pages.map((page) => ({
              id: page.id,
              documentId: documentRow.id,
              pageNumber: page.pageNumber,
              textContent: page.textContent,
              textLength: page.textContent.length,
              textSource: page.textSource ?? DEFAULT_PAGE_TEXT_SOURCE,
              ocrAttempted: page.ocrAttempted ?? false,
              ocrSucceeded: page.ocrSucceeded ?? false,
              ocrConfidence: page.ocrConfidence ?? null,
              ocrWarning: page.ocrWarning ?? null,
              createdAt: now,
            })),
          )
          .run();
      }

      if (input.chunks.length > 0) {
        this.db
          .insert(documentChunksTable)
          .values(
            input.chunks.map((chunk) => ({
              id: chunk.id,
              documentId: documentRow.id,
              pageId: chunk.pageId,
              chunkIndex: chunk.chunkIndex,
              textContent: chunk.textContent,
              textLength: chunk.textContent.length,
              createdAt: now,
            })),
          )
          .run();
      }

      this.touchSubject(documentRow.subjectId);
    });

    transaction();
    return documentRow;
  }

  insertFailedDocument(
    document: Omit<
      SourceDocumentRow,
      | 'createdAt'
      | 'updatedAt'
      | 'ocrState'
      | 'ocrAttemptedPages'
      | 'ocrSucceededPages'
      | 'ocrImprovedPages'
      | 'ocrWarning'
    > & {
      ocrState?: SourceDocumentRow['ocrState'];
      ocrAttemptedPages?: number;
      ocrSucceededPages?: number;
      ocrImprovedPages?: number;
      ocrWarning?: string | null;
    },
  ): SourceDocumentRow {
    const now = createNow();
    const row: SourceDocumentRow = {
      ...document,
      ocrState: document.ocrState ?? DEFAULT_DOCUMENT_OCR_STATE,
      ocrAttemptedPages: document.ocrAttemptedPages ?? 0,
      ocrSucceededPages: document.ocrSucceededPages ?? 0,
      ocrImprovedPages: document.ocrImprovedPages ?? 0,
      ocrWarning: document.ocrWarning ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(sourceDocumentsTable).values(row).run();
    this.touchSubject(row.subjectId);
    return row;
  }

  getReadySubjectPages(subjectId: string): SubjectPageContextRow[] {
    return this.sqlite
      .prepare(
        `
          SELECT
            p.id AS pageId,
            p.document_id AS documentId,
            d.kind AS documentKind,
            d.original_file_name AS documentName,
            p.page_number AS pageNumber,
            p.text_content AS textContent,
            p.text_length AS textLength,
            p.text_source AS textSource
          FROM document_pages p
          INNER JOIN source_documents d ON d.id = p.document_id
          WHERE d.subject_id = ? AND d.import_status = 'ready'
          ORDER BY d.created_at ASC, p.page_number ASC
        `,
      )
      .all(subjectId) as SubjectPageContextRow[];
  }

  getReadySubjectChunks(subjectId: string): SubjectChunkContextRow[] {
    return this.sqlite
      .prepare(
        `
          SELECT
            c.id AS chunkId,
            c.document_id AS documentId,
            c.page_id AS pageId,
            p.page_number AS pageNumber,
            d.original_file_name AS documentName,
            d.kind AS documentKind,
            c.chunk_index AS chunkIndex,
            c.text_content AS textContent,
            c.text_length AS textLength
          FROM document_chunks c
          INNER JOIN document_pages p ON p.id = c.page_id
          INNER JOIN source_documents d ON d.id = c.document_id
          WHERE d.subject_id = ? AND d.import_status = 'ready'
          ORDER BY d.created_at ASC, p.page_number ASC, c.chunk_index ASC
        `,
      )
      .all(subjectId) as SubjectChunkContextRow[];
  }

  replaceSubjectAnalysis(
    subjectId: string,
    input: {
      divisions: Array<{
        division: Omit<DivisionRow, 'subjectId' | 'createdAt' | 'updatedAt'> & {
          keyConceptsJson: string;
        };
        sourcePageIds: string[];
        problemTypes: Array<Omit<ProblemTypeRow, 'subjectId' | 'createdAt' | 'updatedAt'>>;
      }>;
      unassignedPages: Array<Omit<UnassignedPageRow, 'subjectId' | 'createdAt'>>;
    },
  ): void {
    const now = createNow();
    const existingDivisions = this.db
      .select()
      .from(divisionsTable)
      .where(eq(divisionsTable.subjectId, subjectId))
      .all();
    const existingDivisionIds = existingDivisions.map((division) => division.id);

    const transaction = this.sqlite.transaction(() => {
      for (const divisionId of existingDivisionIds) {
        this.db
          .delete(divisionSourcePagesTable)
          .where(eq(divisionSourcePagesTable.divisionId, divisionId))
          .run();
      }

      this.db
        .delete(problemTypesTable)
        .where(eq(problemTypesTable.subjectId, subjectId))
        .run();
      this.db
        .delete(divisionsTable)
        .where(eq(divisionsTable.subjectId, subjectId))
        .run();
      this.db
        .delete(unassignedPagesTable)
        .where(eq(unassignedPagesTable.subjectId, subjectId))
        .run();

      for (const item of input.divisions) {
        const divisionRow: DivisionRow = {
          id: item.division.id,
          subjectId,
          title: item.division.title,
          summary: item.division.summary,
          keyConceptsJson: item.division.keyConceptsJson,
          createdAt: now,
          updatedAt: now,
        };

        this.db.insert(divisionsTable).values(divisionRow).run();

        if (item.sourcePageIds.length > 0) {
          this.db
            .insert(divisionSourcePagesTable)
            .values(
              item.sourcePageIds.map((pageId, index) => ({
                id: `${divisionRow.id}:page:${index}:${pageId}`,
                divisionId: divisionRow.id,
                pageId,
                createdAt: now,
              })),
            )
            .run();
        }

        if (item.problemTypes.length > 0) {
          this.db
            .insert(problemTypesTable)
            .values(
              item.problemTypes.map((problemType) => ({
                id: problemType.id,
                subjectId,
                divisionId: divisionRow.id,
                title: problemType.title,
                description: problemType.description,
                createdAt: now,
                updatedAt: now,
              })),
            )
            .run();
        }
      }

      if (input.unassignedPages.length > 0) {
        this.db
          .insert(unassignedPagesTable)
          .values(
            input.unassignedPages.map((page) => ({
              id: page.id,
              subjectId,
              pageId: page.pageId,
              reason: page.reason,
              createdAt: now,
            })),
          )
          .run();
      }

      this.touchSubject(subjectId);
    });

    transaction();
  }

  getSubjectAnalysis(subjectId: string): SubjectAnalysisRecord {
    const divisions = this.db
      .select()
      .from(divisionsTable)
      .where(eq(divisionsTable.subjectId, subjectId))
      .orderBy(divisionsTable.createdAt)
      .all();

    const pageMap = new Map(
      this.getReadySubjectPages(subjectId).map((page) => [page.pageId, page]),
    );

    const resultDivisions = divisions.map((division) => {
      const sourceLinks = this.db
        .select()
        .from(divisionSourcePagesTable)
        .where(eq(divisionSourcePagesTable.divisionId, division.id))
        .all();
      const problemTypes = this.db
        .select()
        .from(problemTypesTable)
        .where(eq(problemTypesTable.divisionId, division.id))
        .orderBy(problemTypesTable.createdAt)
        .all();

      return {
        division,
        keyConcepts: JSON.parse(division.keyConceptsJson) as string[],
        sourcePages: sourceLinks
          .map((link) => pageMap.get(link.pageId))
          .filter((page): page is SubjectPageContextRow => Boolean(page)),
        problemTypes,
      };
    });

    const unassignedRows = this.db
      .select()
      .from(unassignedPagesTable)
      .where(eq(unassignedPagesTable.subjectId, subjectId))
      .all();

    return {
      divisions: resultDivisions,
      unassignedPages: unassignedRows
        .map((row) => {
          const page = pageMap.get(row.pageId);
          return page ? { row, page } : null;
        })
        .filter(
          (
            value,
          ): value is {
            row: UnassignedPageRow;
            page: SubjectPageContextRow;
          } => Boolean(value),
        ),
    };
  }

  close(): void {
    this.sqlite.close();
  }
}
