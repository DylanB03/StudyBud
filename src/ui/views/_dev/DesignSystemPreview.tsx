import { useState } from 'react';

import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Chip,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FieldGroup,
  GlassPanel,
  Icon,
  Input,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipProvider,
  ToastStack,
  type ToastItem,
} from '../../components';
import { useTheme } from '../../theme/ThemeProvider';

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-4">
    <h2 className="font-display text-title-md text-on-surface">{title}</h2>
    <div className="flex flex-wrap items-start gap-4 rounded-card bg-surface-container-lowest p-6">
      {children}
    </div>
  </section>
);

export const DesignSystemPreview = () => {
  const { preference, resolved, setPreference, toggle } = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (tone: ToastItem['tone'], title: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [
      ...prev,
      { id, tone, title, description: `Tone: ${tone}`, durationMs: 4000 },
    ]);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-surface text-on-surface">
        <GlassPanel className="sticky top-0 z-40 flex items-center justify-between border-b border-outline-variant/30 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="font-display text-title-md">Design system preview</span>
            <Chip tone="primary">resolved: {resolved}</Chip>
            <Chip tone="default">preference: {preference}</Chip>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={toggle}>
              Toggle theme
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreference('light')}
            >
              Light
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreference('dark')}
            >
              Dark
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreference('system')}
            >
              System
            </Button>
          </div>
        </GlassPanel>

        <main className="mx-auto flex max-w-5xl flex-col gap-10 px-8 py-10">
          <Section title="Buttons">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button leadingIcon={<Icon name="add" size="sm" />}>With icon</Button>
            <Button variant="secondary" size="icon" aria-label="Settings">
              <Icon name="settings" />
            </Button>
          </Section>

          <Section title="Chips">
            <Chip>Default</Chip>
            <Chip tone="primary">Primary</Chip>
            <Chip tone="secondary">Secondary</Chip>
            <Chip tone="tertiary">Tertiary</Chip>
            <Chip tone="success">Success</Chip>
            <Chip tone="warning">Warning</Chip>
            <Chip tone="error">Error</Chip>
            <Chip tone="info">Info</Chip>
            <Chip
              tone="primary"
              interactive
              leading={<Icon name="bolt" size="xs" />}
            >
              Interactive
            </Chip>
          </Section>

          <Section title="Cards">
            <Card tone="lowest" elevated padded className="w-72">
              <CardTitle>Default card</CardTitle>
              <CardBody className="mt-2">
                Tonal surface, rounded-card radius, ambient shadow.
              </CardBody>
            </Card>
            <Card tone="raised" interactive className="w-72">
              <CardTitle>Interactive</CardTitle>
              <CardBody className="mt-2">Hover to lift.</CardBody>
            </Card>
            <Card tone="default" className="w-72">
              <CardTitle>Tonal</CardTitle>
              <CardBody className="mt-2">On surface-container-low.</CardBody>
            </Card>
          </Section>

          <Section title="Inputs">
            <div className="grid w-full gap-4 md:grid-cols-3">
              <FieldGroup label="Subject name" htmlFor="ex-text">
                <Input id="ex-text" placeholder="e.g. Organic Chemistry" />
              </FieldGroup>
              <FieldGroup label="Provider" htmlFor="ex-select">
                <Select id="ex-select" defaultValue="openai">
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama</option>
                </Select>
              </FieldGroup>
              <FieldGroup
                label="Prompt"
                htmlFor="ex-ta"
                description="Up to 2,000 characters."
              >
                <Textarea id="ex-ta" placeholder="Ask anything..." />
              </FieldGroup>
            </div>
          </Section>

          <Section title="Tabs">
            <Tabs defaultValue="chat" className="w-full">
              <TabsList>
                <TabsTrigger value="chat">
                  <Icon name="forum" size="sm" /> Chat
                </TabsTrigger>
                <TabsTrigger value="research">
                  <Icon name="travel_explore" size="sm" /> Research
                </TabsTrigger>
              </TabsList>
              <TabsContent value="chat" className="mt-4 text-on-surface-variant">
                Chat rail content lives here.
              </TabsContent>
              <TabsContent
                value="research"
                className="mt-4 text-on-surface-variant"
              >
                Research rail content lives here.
              </TabsContent>
            </Tabs>
          </Section>

          <Section title="Dialog / Dropdown / Tooltip / Toast">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader
                  title="Create a new subject"
                  description="Subjects keep your lecture and homework PDFs organized."
                />
                <FieldGroup label="Name" htmlFor="ds-dialog-name">
                  <Input id="ds-dialog-name" placeholder="e.g. Linear Algebra" />
                </FieldGroup>
                <DialogFooter>
                  <Button variant="ghost">Cancel</Button>
                  <Button>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  Menu <Icon name="expand_more" size="sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <Icon name="edit" size="sm" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Icon name="content_copy" size="sm" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive>
                  <Icon name="delete" size="sm" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip content="Helpful tooltip text">
              <Button variant="ghost" size="icon" aria-label="Help">
                <Icon name="help" />
              </Button>
            </Tooltip>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => pushToast('info', 'Info')}>
                Info toast
              </Button>
              <Button
                variant="secondary"
                onClick={() => pushToast('success', 'Saved')}
              >
                Success
              </Button>
              <Button
                variant="secondary"
                onClick={() => pushToast('warning', 'Heads up')}
              >
                Warning
              </Button>
              <Button
                variant="secondary"
                onClick={() => pushToast('error', 'Failed')}
              >
                Error
              </Button>
            </div>
          </Section>

          <Section title="Typography">
            <div className="flex flex-col gap-2">
              <p className="font-display text-display-lg text-on-surface">
                Display Large
              </p>
              <p className="font-display text-display-md text-on-surface">
                Display Medium
              </p>
              <p className="font-display text-title-lg text-on-surface">
                Title Large
              </p>
              <p className="font-body text-body-lg text-on-surface">
                Body Large - Inter is the workhorse.
              </p>
              <p className="font-body text-body-md text-on-surface-variant">
                Body Medium on surface variant.
              </p>
              <p className="font-editorial text-title-lg italic text-on-surface">
                Newsreader italic for the Midnight Scholar aesthetic.
              </p>
              <p className="font-body text-label-sm uppercase tracking-[0.2em] text-on-surface-variant">
                Label Small
              </p>
            </div>
          </Section>
        </main>

        <ToastStack
          items={toasts}
          onDismiss={(id) =>
            setToasts((prev) => prev.filter((toast) => toast.id !== id))
          }
        />
      </div>
    </TooltipProvider>
  );
};
