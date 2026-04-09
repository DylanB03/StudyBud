import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type {
  JobRow,
  ProblemTypeRow,
  SubjectAnalysisRecord,
  SubjectChunkContextRow,
  SubjectPageContextRow,
  DatabaseService,
} from '../db/database';
import {
  createStructuredResponse,
  getResolvedProviderLabel,
  getResolvedProviderModel,
  type StructuredAiProviderConfig,
} from '../ai/provider';

const MAX_PAGES_IN_PROMPT = 80;
const MAX_PAGE_TEXT_LENGTH = 1500;

const analysisResponseSchema = z.object({
  divisions: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        summary: z.string().min(1).max(2000),
        keyConcepts: z.array(z.string().min(1).max(200)).min(1).max(12),
        sourceRefs: z.array(z.string().min(1)).min(1).max(24),
        problemTypes: z
          .array(
            z.object({
              title: z.string().min(1).max(160),
              description: z.string().min(1).max(600),
            }),
          )
          .max(12),
      }),
    )
    .min(1)
    .max(20),
  unassignedRefs: z
    .array(
      z.object({
        sourceRef: z.string().min(1),
        reason: z.string().min(1).max(240).nullable(),
      }),
    )
    .max(40),
});

type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

type PersistedDivisionInput = {
  division: {
    id: string;
    title: string;
    summary: string;
    keyConceptsJson: string;
  };
  sourcePageIds: string[];
  problemTypes: Array<Omit<ProblemTypeRow, 'subjectId' | 'createdAt' | 'updatedAt'>>;
};

type PersistedUnassignedPageInput = {
  id: string;
  pageId: string;
  reason: string | null;
};

type PreparedAnalysisInput = {
  prompt: string;
  refToPage: Map<string, SubjectPageContextRow>;
};

const buildAnalysisPrompt = (
  pages: SubjectPageContextRow[],
  chunks: SubjectChunkContextRow[],
): PreparedAnalysisInput => {
  const refToPage = new Map<string, SubjectPageContextRow>();

  const chosenPages = pages
    .filter((page) => page.textContent.trim().length > 0)
    .slice(0, MAX_PAGES_IN_PROMPT);

  const chunkMap = new Map<string, SubjectChunkContextRow[]>();
  for (const chunk of chunks) {
    const list = chunkMap.get(chunk.pageId) ?? [];
    list.push(chunk);
    chunkMap.set(chunk.pageId, list);
  }

  const pageBlocks = chosenPages.map((page, index) => {
    const ref = `PAGE_${String(index + 1).padStart(3, '0')}`;
    refToPage.set(ref, page);

    const chunkText = (chunkMap.get(page.pageId) ?? [])
      .slice(0, 3)
      .map((chunk) => chunk.textContent.trim())
      .filter(Boolean)
      .join('\n\n');

    const pageText =
      chunkText.length > 0
        ? chunkText
        : page.textContent.slice(0, MAX_PAGE_TEXT_LENGTH).trim();

    return [
      `[${ref}]`,
      `document: ${page.documentName}`,
      `document_kind: ${page.documentKind}`,
      `document_id: ${page.documentId}`,
      `page_number: ${page.pageNumber}`,
      'text:',
      pageText.slice(0, MAX_PAGE_TEXT_LENGTH),
    ].join('\n');
  });

  return {
    prompt: [
      'Course material pages:',
      pageBlocks.join('\n\n---\n\n'),
      '',
      'Return divisions that group the material into coherent study units.',
      'Use only the provided PAGE refs in sourceRefs and unassignedRefs.',
      'Prefer broad, student-usable units rather than tiny fragments.',
      'Problem types should reflect the kinds of exercises the student should practice.',
    ].join('\n'),
    refToPage,
  };
};

const analysisSchemaDefinition: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['divisions', 'unassignedRefs'],
  properties: {
    divisions: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'summary', 'keyConcepts', 'sourceRefs', 'problemTypes'],
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          keyConcepts: {
            type: 'array',
            minItems: 1,
            maxItems: 12,
            items: { type: 'string' },
          },
          sourceRefs: {
            type: 'array',
            minItems: 1,
            maxItems: 24,
            items: { type: 'string' },
          },
          problemTypes: {
            type: 'array',
            maxItems: 12,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'description'],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
        },
      },
    },
    unassignedRefs: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceRef', 'reason'],
        properties: {
          sourceRef: { type: 'string' },
          reason: {
            type: ['string', 'null'],
          },
        },
      },
    },
  },
};

const systemPrompt = [
  'You are analyzing lecture slides and homework material for a study application.',
  'Your task is to organize the subject into coherent divisions (study units).',
  'Each division must include a concise summary, key concepts, source page refs, and problem types.',
  'Use only the PAGE refs provided by the user. Do not invent refs.',
  'A page may appear in more than one division when justified, but avoid excessive duplication.',
  'Unassigned refs should be rare and only used when a page does not fit any useful division.',
  'Problem types should describe the style of practice problems the student should drill.',
].join(' ');

const buildAnalysisSummaryFromRecord = (record: SubjectAnalysisRecord) => {
  return {
    divisions: record.divisions.map((divisionRecord) => ({
      id: divisionRecord.division.id,
      title: divisionRecord.division.title,
      summary: divisionRecord.division.summary,
      keyConcepts: divisionRecord.keyConcepts,
      sourcePages: divisionRecord.sourcePages.map((page) => ({
        pageId: page.pageId,
        documentId: page.documentId,
        documentName: page.documentName,
        documentKind: page.documentKind as 'lecture' | 'homework',
        pageNumber: page.pageNumber,
      })),
      problemTypes: divisionRecord.problemTypes.map((problemType) => ({
        id: problemType.id,
        title: problemType.title,
        description: problemType.description,
      })),
    })),
    unassignedPages: record.unassignedPages.map(({ row, page }) => ({
      id: row.id,
      reason: row.reason,
      pageId: page.pageId,
      documentId: page.documentId,
      documentName: page.documentName,
      documentKind: page.documentKind as 'lecture' | 'homework',
      pageNumber: page.pageNumber,
    })),
  };
};

export const analyzeSubjectMaterials = async (
  input: {
    providerConfig: StructuredAiProviderConfig;
    subjectId: string;
    database: DatabaseService;
  },
): Promise<{
  job: JobRow;
  analysis: ReturnType<typeof buildAnalysisSummaryFromRecord>;
}> => {
  const pages = input.database.getReadySubjectPages(input.subjectId);
  const chunks = input.database.getReadySubjectChunks(input.subjectId);

  if (pages.length === 0 || chunks.length === 0) {
    throw new Error(
      'Import at least one text-based PDF successfully before analyzing the subject.',
    );
  }

  const prepared = buildAnalysisPrompt(pages, chunks);
  const resolvedModel = getResolvedProviderModel(input.providerConfig);
  const providerLabel = getResolvedProviderLabel(input.providerConfig);
  const analysisJob = input.database.createSubjectIngestionJob({
    id: randomUUID(),
    subjectId: input.subjectId,
    message: 'Analyzing subject structure and problem types...',
    payload: JSON.stringify({
      model: resolvedModel,
      provider: providerLabel,
      divisionCount: 0,
      problemTypeCount: 0,
      unassignedPageCount: 0,
    }),
  });

  try {
    const rawResponse = await createStructuredResponse<AnalysisResponse>({
      providerConfig: input.providerConfig,
      systemPrompt,
      userPrompt: prepared.prompt,
      schemaName: 'subject_division_extraction',
      schema: analysisSchemaDefinition,
    });

    const parsed = analysisResponseSchema.parse(rawResponse);
    const divisions: PersistedDivisionInput[] = [];
    for (const division of parsed.divisions) {
        const uniqueSourcePageIds = [...new Set(division.sourceRefs)]
          .map((sourceRef) => prepared.refToPage.get(sourceRef)?.pageId ?? null)
          .filter((pageId): pageId is string => typeof pageId === 'string');

        if (uniqueSourcePageIds.length === 0) {
          continue;
        }

        const divisionId = randomUUID();
        divisions.push({
          division: {
            id: divisionId,
            title: division.title.trim(),
            summary: division.summary.trim(),
            keyConceptsJson: JSON.stringify(
              [...new Set(division.keyConcepts.map((value) => value.trim()).filter(Boolean))],
            ),
          },
          sourcePageIds: uniqueSourcePageIds,
          problemTypes: division.problemTypes.map((problemType) => ({
            id: randomUUID(),
            divisionId,
            title: problemType.title.trim(),
            description: problemType.description.trim(),
          })),
        });
      }

    const unassignedPages: PersistedUnassignedPageInput[] = [];
    for (const item of parsed.unassignedRefs) {
        const page = prepared.refToPage.get(item.sourceRef);
        if (!page) {
          continue;
        }

        unassignedPages.push({
          id: randomUUID(),
          pageId: page.pageId,
          reason: item.reason?.trim() || null,
        });
      }

    input.database.replaceSubjectAnalysis(input.subjectId, {
      divisions,
      unassignedPages,
    });

    const record = input.database.getSubjectAnalysis(input.subjectId);
    const summary = buildAnalysisSummaryFromRecord(record);

    const completedJob = input.database.updateJob(analysisJob.id, {
      status: 'completed',
      message: `Generated ${summary.divisions.length} division${
        summary.divisions.length === 1 ? '' : 's'
      } and ${summary.divisions.reduce(
        (count, division) => count + division.problemTypes.length,
        0,
      )} problem type${
        summary.divisions.reduce(
          (count, division) => count + division.problemTypes.length,
          0,
        ) === 1
          ? ''
          : 's'
      }.`,
      payload: JSON.stringify({
        model: resolvedModel,
        provider: providerLabel,
        divisionCount: summary.divisions.length,
        problemTypeCount: summary.divisions.reduce(
          (count, division) => count + division.problemTypes.length,
          0,
        ),
        unassignedPageCount: summary.unassignedPages.length,
      }),
    });

    return {
      job: completedJob,
      analysis: summary,
    };
  } catch (error) {
    input.database.updateJob(analysisJob.id, {
      status: 'failed',
      message:
        error instanceof Error ? error.message : 'Subject analysis failed unexpectedly.',
      payload: JSON.stringify({
        model: resolvedModel,
        provider: providerLabel,
        divisionCount: 0,
        problemTypeCount: 0,
        unassignedPageCount: 0,
      }),
    });

    throw error;
  }
};

export const getPersistedSubjectAnalysisSummary = (
  database: DatabaseService,
  subjectId: string,
) => {
  return buildAnalysisSummaryFromRecord(database.getSubjectAnalysis(subjectId));
};
