import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { useAppState } from '../../state/AppState';
import { useSettings } from '../../state/SettingsState';
import { useWorkspace } from '../../state/WorkspaceState';

type WorkspaceHeaderProps = {
  subjectName: string;
};

export const WorkspaceHeader = ({ subjectName }: WorkspaceHeaderProps) => {
  const { isOnline } = useAppState();
  const { settings } = useSettings();
  const {
    workspace,
    analyze,
    analysisState,
  } = useWorkspace();

  const documents = workspace?.documents ?? [];
  const anyReady = documents.some((d) => d.importStatus === 'ready');
  const analysisReady =
    settings.aiProvider === 'openai'
      ? settings.openAiApiKeyConfigured && isOnline
      : settings.ollamaModel.trim().length > 0;

  return (
    <header className="flex flex-col gap-4 px-8 py-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="font-display text-display-sm font-extrabold tracking-tight text-on-surface">
            {subjectName}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            {analysisState ? (
              <>
                <span className="relative inline-flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </span>
                <span className="font-body text-body-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  AI Curating Live
                </span>
              </>
            ) : workspace?.analysis ? (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-success"></span>
                <span className="font-body text-body-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  {workspace.analysis.divisions.length} units extracted
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-outline-variant"></span>
                <span className="font-body text-body-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  {documents.length === 0
                    ? 'No documents yet'
                    : 'Ready to analyze'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Icon name="bolt" size="sm" filled />}
          onClick={() => void analyze()}
          disabled={!anyReady || !analysisReady || Boolean(analysisState)}
          loading={Boolean(analysisState)}
        >
          Analyze subject
        </Button>
        {!analysisReady ? (
          <Chip tone="warning" className="px-2 py-0.5 text-body-xs">
            {settings.aiProvider === 'openai'
              ? 'Add OpenAI key in Settings'
              : 'Set Ollama model in Settings'}
          </Chip>
        ) : null}
      </div>
    </header>
  );
};
