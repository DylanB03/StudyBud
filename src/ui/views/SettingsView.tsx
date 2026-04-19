import { useEffect, useMemo, useState, type FormEvent } from 'react';

import type { AiProvider } from '../../shared/ipc';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { DismissibleBanner } from '../components/DismissibleBanner';
import { Icon } from '../components/Icon';
import {
  FieldGroup,
  FieldLabel,
  Input,
  Select,
} from '../components/Input';
import { useAppState } from '../state/AppState';
import { useSettings } from '../state/SettingsState';
import { cn } from '../theme/cn';

type SectionId = 'ai' | 'research' | 'diagnostics' | 'data';

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    id: 'ai',
    label: 'AI settings',
    icon: 'smart_toy',
    description: 'Choose your AI provider and credentials.',
  },
  {
    id: 'research',
    label: 'Research',
    icon: 'travel_explore',
    description: 'Web search and video provider keys.',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    icon: 'monitor_heart',
    description: 'Runtime, OCR, and platform health.',
  },
  {
    id: 'data',
    label: 'Data path',
    icon: 'folder_open',
    description: 'Where StudyBud stores its data.',
  },
];

export const SettingsView = () => {
  const { isOnline, appInfo, appInfoError, refreshAppInfo } = useAppState();
  const { settings, busy, error, load, save } = useSettings();
  const [section, setSection] = useState<SectionId>('ai');
  const [flash, setFlash] = useState<string | null>(null);

  const flashOnSuccess = (message: string) => {
    setFlash(message);
    window.setTimeout(() => {
      setFlash((prev) => (prev === message ? null : prev));
    }, 4000);
  };

  return (
    <main className="flex-1 overflow-y-auto bg-surface-container-low">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-0 px-0 py-0 md:grid-cols-[260px_1fr]">
        <aside className="md:sticky md:top-0 md:h-[calc(100vh-72px)] md:self-start md:border-r md:border-outline-variant/15 md:bg-surface-container md:px-6 md:py-10">
          <div className="mb-6 px-2 pt-10 md:pt-0">
            <h2 className="font-display text-title-sm font-extrabold text-primary">
              Preferences
            </h2>
            <p className="font-body text-body-xs text-on-surface-variant">
              Configure StudyBud to match your workflow.
            </p>
          </div>
          <nav className="flex flex-col gap-1">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-4 py-3 font-display text-body-sm font-semibold transition',
                  section === item.id
                    ? 'bg-surface-container-lowest text-primary shadow-soft'
                    : 'text-on-surface-variant hover:bg-surface-container-high',
                )}
              >
                <Icon name={item.icon} size="sm" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="px-6 py-10 md:px-12">
          <div className="mx-auto max-w-4xl space-y-8">
            <header className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-title-md font-bold tracking-tight text-on-surface">
                  {SECTIONS.find((s) => s.id === section)?.label}
                </h1>
                <p className="font-body text-body-sm text-on-surface-variant">
                  {SECTIONS.find((s) => s.id === section)?.description}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<Icon name="refresh" size="sm" />}
                onClick={() => {
                  void load();
                  void refreshAppInfo();
                }}
                disabled={busy}
              >
                Reload
              </Button>
            </header>

            {!isOnline ? (
              <DismissibleBanner
                dismissKey="settings-offline"
                variant="warning"
              >
                This device currently appears offline. Cloud AI and web research
                providers will stay unavailable until connectivity returns.
              </DismissibleBanner>
            ) : null}

            {error ? (
              <DismissibleBanner
                dismissKey={`settings-error:${error}`}
                variant="error"
              >
                {error}
              </DismissibleBanner>
            ) : null}

            {flash ? (
              <DismissibleBanner
                dismissKey={`settings-flash:${flash}`}
                variant="success"
              >
                {flash}
              </DismissibleBanner>
            ) : null}

            {section === 'ai' ? (
              <AiSettingsSection
                busy={busy}
                onSave={async (input) => {
                  await save(input);
                  flashOnSuccess('AI settings saved.');
                }}
              />
            ) : null}
            {section === 'research' ? (
              <ResearchSettingsSection
                busy={busy}
                onSave={async (input) => {
                  await save(input);
                  flashOnSuccess('Research settings saved.');
                }}
              />
            ) : null}
            {section === 'diagnostics' ? (
              <DiagnosticsSection
                appInfoError={appInfoError}
                isOnline={isOnline}
              />
            ) : null}
            {section === 'data' ? (
              <DataPathSection
                onFlash={(message) => flashOnSuccess(message)}
              />
            ) : null}

            <div className="flex items-center justify-between border-t border-outline-variant/10 pt-6">
              <span className="font-body text-body-xs text-on-surface-variant">
                StudyBud version {appInfo?.version ?? '…'}
              </span>
              <span className="font-body text-body-xs text-on-surface-variant/70">
                {settings.encryptionAvailable
                  ? 'OS key storage available'
                  : 'Session-only credential storage'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

type AiSaveHandler = (input: {
  aiProvider?: AiProvider;
  openAiApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}) => Promise<void>;

const AiSettingsSection = ({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: AiSaveHandler;
}) => {
  const { settings } = useSettings();
  const [provider, setProvider] = useState<AiProvider>(settings.aiProvider);
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>(settings.ollamaBaseUrl);
  const [model, setModel] = useState<string>(settings.ollamaModel);

  useEffect(() => setProvider(settings.aiProvider), [settings.aiProvider]);
  useEffect(() => setBaseUrl(settings.ollamaBaseUrl), [settings.ollamaBaseUrl]);
  useEffect(() => setModel(settings.ollamaModel), [settings.ollamaModel]);

  const badge = useMemo(() => {
    if (settings.aiProvider === 'openai') {
      return settings.openAiApiKeyConfigured
        ? { label: 'OpenAI ready', tone: 'success' as const }
        : { label: 'API key needed', tone: 'warning' as const };
    }
    return settings.ollamaModel.trim().length > 0
      ? { label: 'Ollama ready', tone: 'success' as const }
      : { label: 'Model missing', tone: 'warning' as const };
  }, [settings]);

  const canSave =
    !busy &&
    (provider === 'openai'
      ? apiKey.trim().length > 0 || settings.openAiApiKeyConfigured
      : baseUrl.trim().length > 0 && model.trim().length > 0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    const input: Parameters<AiSaveHandler>[0] = { aiProvider: provider };
    if (provider === 'openai' && apiKey.trim().length > 0) {
      input.openAiApiKey = apiKey.trim();
    }
    if (provider === 'ollama') {
      input.ollamaBaseUrl = baseUrl.trim();
      input.ollamaModel = model.trim();
    }
    await onSave(input);
    setApiKey('');
  };

  const handleClearKey = async () => {
    await onSave({ openAiApiKey: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Chip tone={badge.tone} className="px-3 py-1 text-label-sm">
          {badge.label}
        </Chip>
        <Chip tone="default" className="px-3 py-1 text-label-sm">
          OS encryption:{' '}
          {settings.encryptionAvailable ? 'Available' : 'Unavailable'}
        </Chip>
      </div>

      {provider === 'openai' && !settings.encryptionAvailable ? (
        <DismissibleBanner
          dismissKey="settings-openai-session"
          variant="info"
        >
          OS key storage is unavailable, so the OpenAI API key will stay in
          memory for this app session only.
        </DismissibleBanner>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-card border border-outline-variant/15 bg-surface-container-lowest p-8"
      >
        <FieldGroup
          label="AI provider"
          description={
            provider === 'ollama'
              ? 'Local Ollama is used over HTTP and does not require an OpenAI key.'
              : 'OpenAI uses your stored API key and the default cloud model for analysis.'
          }
        >
          <Select
            value={provider}
            onChange={(event) => setProvider(event.target.value as AiProvider)}
            disabled={busy}
          >
            <option value="openai">OpenAI (Cloud)</option>
            <option value="ollama">Ollama (Local)</option>
          </Select>
        </FieldGroup>

        {provider === 'openai' ? (
          <FieldGroup label="OpenAI API key">
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                settings.openAiApiKeyConfigured
                  ? '•••••••••••• (stored — leave blank to keep)'
                  : 'sk-...'
              }
              autoComplete="off"
              disabled={busy}
            />
          </FieldGroup>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldGroup label="Ollama base URL">
              <Input
                type="text"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="http://localhost:11434"
                disabled={busy}
              />
            </FieldGroup>
            <FieldGroup label="Ollama model">
              <Input
                type="text"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="qwen3:8b"
                disabled={busy}
              />
            </FieldGroup>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant/10 pt-4">
          {settings.openAiApiKeyConfigured ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void handleClearKey()}
            >
              Clear stored OpenAI key
            </Button>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            disabled={!canSave}
            loading={busy}
            leadingIcon={<Icon name="save" size="sm" />}
          >
            Save AI settings
          </Button>
        </div>
      </form>
    </div>
  );
};

type ResearchSaveHandler = (input: {
  researchSafetyMode?: 'balanced' | 'education';
  braveSearchApiKey?: string;
  youTubeApiKey?: string;
}) => Promise<void>;

const ResearchSettingsSection = ({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: ResearchSaveHandler;
}) => {
  const { settings } = useSettings();
  const [safety, setSafety] = useState<'balanced' | 'education'>(
    settings.researchSafetyMode,
  );
  const [brave, setBrave] = useState<string>('');
  const [youtube, setYoutube] = useState<string>('');

  useEffect(() => setSafety(settings.researchSafetyMode), [
    settings.researchSafetyMode,
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: Parameters<ResearchSaveHandler>[0] = {
      researchSafetyMode: safety,
    };
    if (brave.trim().length > 0) input.braveSearchApiKey = brave.trim();
    if (youtube.trim().length > 0) input.youTubeApiKey = youtube.trim();
    await onSave(input);
    setBrave('');
    setYoutube('');
  };

  const handleClear = async () => {
    await onSave({ braveSearchApiKey: '', youTubeApiKey: '' });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoTile
          icon="public"
          label="Web provider"
          value={
            settings.braveSearchApiKeyConfigured
              ? 'Brave Search API'
              : 'Fallback scraping'
          }
        />
        <InfoTile
          icon="play_circle"
          label="Video provider"
          value={
            settings.youTubeApiKeyConfigured
              ? 'YouTube Data API'
              : 'Fallback scraping'
          }
        />
        <InfoTile
          icon="shield"
          label="Safety mode"
          value={
            settings.researchSafetyMode === 'education'
              ? 'Education focused'
              : 'Balanced'
          }
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-card border border-outline-variant/15 bg-surface-container-lowest p-8"
      >
        <FieldGroup
          label="Research safety mode"
          description="Education mode prioritizes educational domains and learning-oriented results when StudyBud ranks research sources."
        >
          <Select
            value={safety}
            onChange={(event) =>
              setSafety(event.target.value as 'balanced' | 'education')
            }
            disabled={busy}
          >
            <option value="balanced">Balanced</option>
            <option value="education">Education focused</option>
          </Select>
        </FieldGroup>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldGroup
            label="Brave Search API key"
            description={
              settings.braveSearchApiKeyConfigured
                ? 'Stored — leave blank to keep.'
                : 'Optional. Falls back to web scraping when missing.'
            }
          >
            <Input
              type="password"
              value={brave}
              onChange={(event) => setBrave(event.target.value)}
              placeholder="BSA..."
              autoComplete="off"
              disabled={busy}
            />
          </FieldGroup>
          <FieldGroup
            label="YouTube Data API key"
            description={
              settings.youTubeApiKeyConfigured
                ? 'Stored — leave blank to keep.'
                : 'Optional. Falls back to scraping when missing.'
            }
          >
            <Input
              type="password"
              value={youtube}
              onChange={(event) => setYoutube(event.target.value)}
              placeholder="AIza..."
              autoComplete="off"
              disabled={busy}
            />
          </FieldGroup>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant/10 pt-4">
          {settings.braveSearchApiKeyConfigured ||
          settings.youTubeApiKeyConfigured ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void handleClear()}
            >
              Clear stored research keys
            </Button>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            disabled={busy}
            loading={busy}
            leadingIcon={<Icon name="save" size="sm" />}
          >
            Save research settings
          </Button>
        </div>
      </form>
    </div>
  );
};

const DiagnosticsSection = ({
  appInfoError,
  isOnline,
}: {
  appInfoError: string | null;
  isOnline: boolean;
}) => {
  const { appInfo } = useAppState();
  const { settings } = useSettings();

  return (
    <div className="space-y-6">
      {appInfoError ? (
        <DismissibleBanner
          dismissKey={`settings-appinfo:${appInfoError}`}
          variant="warning"
        >
          {appInfoError}
        </DismissibleBanner>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          className={cn(
            'col-span-1 flex items-center gap-4 rounded-card bg-surface-container-lowest p-6 md:col-span-2',
          )}
        >
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full',
              isOnline
                ? 'bg-success/15 text-success'
                : 'bg-warning/20 text-on-surface',
            )}
          >
            <Icon name="sensors" size="md" />
          </div>
          <div className="flex-1">
            <p className="font-display text-body-md font-bold text-on-surface">
              Connectivity
            </p>
            <p className="font-body text-body-xs text-on-surface-variant">
              {isOnline
                ? 'All systems operational.'
                : 'Offline — cloud AI and research are disabled.'}
            </p>
          </div>
          <span
            className={cn(
              'font-display text-body-sm font-bold',
              isOnline ? 'text-success' : 'text-warning',
            )}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <InfoTile
          icon="window"
          label="Platform"
          value={
            appInfo
              ? `${appInfo.platform}${appInfo.runningInWsl ? ' (WSL)' : ''}`
              : 'Loading…'
          }
        />
      </div>

      <div className="overflow-hidden rounded-card border border-outline-variant/15 bg-surface-container-lowest">
        <div className="grid grid-cols-2 md:grid-cols-4">
          <DiagTile label="Electron" value={appInfo?.electronVersion ?? '…'} />
          <DiagTile label="Node.js" value={appInfo?.nodeVersion ?? '…'} />
          <DiagTile
            label="Native DB"
            value={appInfo?.nativeDatabaseReady ? 'Ready' : 'Not ready'}
            tone={appInfo?.nativeDatabaseReady ? 'success' : 'warning'}
          />
          <DiagTile
            label="AI status"
            value={
              settings.aiProvider === 'openai'
                ? settings.openAiApiKeyConfigured
                  ? 'OpenAI ready'
                  : 'OpenAI key missing'
                : settings.ollamaModel.trim().length > 0
                  ? `Ollama (${settings.ollamaModel})`
                  : 'Ollama model missing'
            }
          />
        </div>
        <div className="grid grid-cols-2 border-t border-outline-variant/10 bg-surface-container-low/30 md:grid-cols-3">
          <DiagTile
            label="OCR runtime"
            value={
              appInfo?.ocrEngine
                ? appInfo.ocrEngine
                : appInfo?.ocrRuntimeAvailable
                  ? 'Available'
                  : 'Unavailable'
            }
          />
          <DiagTile
            label="OCR mode"
            value={appInfo?.ocrRuntimeMode ?? '…'}
          />
          <DiagTile
            label="Research"
            value={
              settings.braveSearchApiKeyConfigured
                ? 'Brave + optional YouTube'
                : 'Fallback providers'
            }
          />
        </div>
      </div>

      <div className="space-y-2 rounded-card border border-outline-variant/15 bg-surface-container-lowest p-6">
        <PathRow label="Data path" value={settings.dataPath || '…'} />
        <PathRow
          label="User data path"
          value={appInfo?.userDataPath ?? '…'}
        />
        <PathRow
          label="OCR runtime path"
          value={appInfo?.ocrRuntimePath ?? 'Not resolved'}
        />
      </div>
    </div>
  );
};

const DataPathSection = ({ onFlash }: { onFlash: (msg: string) => void }) => {
  const { settings, busy, choosePath, resetPath } = useSettings();

  return (
    <div className="space-y-6 rounded-card border border-outline-variant/15 bg-surface-container-lowest p-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FieldGroup label="Current path">
          <code className="block truncate rounded-md bg-surface-container-high px-3 py-2 font-mono text-body-xs text-on-surface">
            {settings.dataPath || '…'}
          </code>
        </FieldGroup>
        <FieldGroup label="Default path">
          <code className="block truncate rounded-md bg-surface-container-high px-3 py-2 font-mono text-body-xs text-on-surface-variant">
            {settings.defaultDataPath || '…'}
          </code>
        </FieldGroup>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoTile
          icon="tune"
          label="Mode"
          value={
            settings.usingCustomDataPath
              ? 'Custom directory'
              : 'Default directory'
          }
        />
        <InfoTile
          icon="sync"
          label="Effect"
          value="Used for new and reopened StudyBud data"
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant/10 pt-4">
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !settings.usingCustomDataPath}
          onClick={async () => {
            await resetPath();
            onFlash('Data path reset to default.');
          }}
        >
          Reset to default
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={busy}
          onClick={async () => {
            await choosePath();
            onFlash('Data path updated.');
          }}
          leadingIcon={<Icon name="folder_open" size="sm" />}
        >
          Choose folder
        </Button>
      </div>
    </div>
  );
};

const InfoTile = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-3 rounded-card bg-surface-container-lowest p-4">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Icon name={icon} size="sm" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="font-display text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p className="truncate font-body text-body-sm text-on-surface">
        {value}
      </p>
    </div>
  </div>
);

const DiagTile = ({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) => (
  <div className="border-r border-outline-variant/10 p-4 last:border-r-0">
    <p className="font-display text-label-sm font-bold uppercase tracking-widest text-outline">
      {label}
    </p>
    <p
      className={cn(
        'font-body text-body-sm',
        tone === 'success' && 'text-success',
        tone === 'warning' && 'text-warning',
        tone === 'default' && 'text-on-surface',
      )}
    >
      {value}
    </p>
  </div>
);

const PathRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1 border-b border-outline-variant/10 pb-2 last:border-b-0">
    <FieldLabel className="text-label-sm uppercase tracking-widest">
      {label}
    </FieldLabel>
    <code className="truncate rounded-md bg-surface-container-high px-3 py-2 font-mono text-body-xs text-on-surface-variant">
      {value}
    </code>
  </div>
);
