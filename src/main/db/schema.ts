import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settingsTable = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  encrypted: integer('encrypted', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at').notNull(),
});

export const subjectsTable = sqliteTable('subjects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const jobsTable = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id'),
  type: text('type').notNull(),
  status: text('status').notNull(),
  message: text('message').notNull().default(''),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const sourceDocumentsTable = sqliteTable('source_documents', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull(),
  kind: text('kind').notNull(),
  originalFileName: text('original_file_name').notNull(),
  storedFileName: text('stored_file_name'),
  relativePath: text('relative_path'),
  mimeType: text('mime_type').notNull(),
  pageCount: integer('page_count').notNull().default(0),
  importStatus: text('import_status').notNull(),
  errorMessage: text('error_message'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const documentPagesTable = sqliteTable('document_pages', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  pageNumber: integer('page_number').notNull(),
  textContent: text('text_content').notNull(),
  textLength: integer('text_length').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const documentChunksTable = sqliteTable('document_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  pageId: text('page_id').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  textContent: text('text_content').notNull(),
  textLength: integer('text_length').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const divisionsTable = sqliteTable('divisions', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  keyConceptsJson: text('key_concepts_json').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const divisionSourcePagesTable = sqliteTable('division_source_pages', {
  id: text('id').primaryKey(),
  divisionId: text('division_id').notNull(),
  pageId: text('page_id').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const problemTypesTable = sqliteTable('problem_types', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull(),
  divisionId: text('division_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const unassignedPagesTable = sqliteTable('unassigned_pages', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull(),
  pageId: text('page_id').notNull(),
  reason: text('reason'),
  createdAt: integer('created_at').notNull(),
});

export const chatMessagesTable = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull(),
  divisionId: text('division_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  citationsJson: text('citations_json').notNull(),
  followupsJson: text('followups_json').notNull(),
  selectionContextJson: text('selection_context_json'),
  createdAt: integer('created_at').notNull(),
});

export const practiceSetsTable = sqliteTable('practice_sets', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull(),
  divisionId: text('division_id').notNull(),
  problemTypeId: text('problem_type_id').notNull(),
  problemTypeTitle: text('problem_type_title').notNull(),
  difficulty: text('difficulty').notNull(),
  questionCount: integer('question_count').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const practiceQuestionsTable = sqliteTable('practice_questions', {
  id: text('id').primaryKey(),
  practiceSetId: text('practice_set_id').notNull(),
  questionIndex: integer('question_index').notNull(),
  prompt: text('prompt').notNull(),
  answer: text('answer').notNull(),
  revealed: integer('revealed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
