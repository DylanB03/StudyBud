import { BrowserView, BrowserWindow, shell } from 'electron';

import type {
  ResearchBrowserBoundsInput,
  ResearchBrowserNavigationInput,
  ResearchBrowserState,
} from '../../shared/ipc';

const DEFAULT_BROWSER_STATE: ResearchBrowserState = {
  visible: false,
  url: '',
  title: '',
  canGoBack: false,
  canGoForward: false,
  loading: false,
};

const normalizeBrowserUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Enter a URL to load in the research browser.');
  }

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs can be opened in the research browser.');
  }

  return parsed.toString();
};

export class ResearchBrowserController {
  private browserView: BrowserView | null = null;
  private attachedWindow: BrowserWindow | null = null;
  private readonly windowProvider: () => BrowserWindow | null;
  private readonly emitState: (state: ResearchBrowserState) => void;
  private state: ResearchBrowserState = { ...DEFAULT_BROWSER_STATE };

  constructor(input: {
    windowProvider: () => BrowserWindow | null;
    emitState: (state: ResearchBrowserState) => void;
  }) {
    this.windowProvider = input.windowProvider;
    this.emitState = input.emitState;
  }

  getState(): ResearchBrowserState {
    return { ...this.state };
  }

  private updateState(partial: Partial<ResearchBrowserState>): ResearchBrowserState {
    this.state = {
      ...this.state,
      ...partial,
    };
    this.emitState(this.getState());
    return this.getState();
  }

  private ensureView(): BrowserView {
    if (this.browserView && !this.browserView.webContents.isDestroyed()) {
      return this.browserView;
    }

    this.browserView = new BrowserView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.browserView.setBackgroundColor('#0d1320');
    this.browserView.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: 'deny' };
    });

    this.browserView.webContents.on('page-title-updated', () => {
      this.syncStateFromWebContents();
    });
    this.browserView.webContents.on('did-start-loading', () => {
      this.syncStateFromWebContents({ loading: true });
    });
    this.browserView.webContents.on('did-stop-loading', () => {
      this.syncStateFromWebContents({ loading: false });
    });
    this.browserView.webContents.on('did-navigate', () => {
      this.syncStateFromWebContents();
    });
    this.browserView.webContents.on('did-navigate-in-page', () => {
      this.syncStateFromWebContents();
    });
    this.browserView.webContents.on('did-fail-load', () => {
      this.syncStateFromWebContents({ loading: false });
    });

    return this.browserView;
  }

  private syncStateFromWebContents(
    partial: Partial<ResearchBrowserState> = {},
  ): ResearchBrowserState {
    const view = this.browserView;
    const webContents = view?.webContents;

    if (!webContents || webContents.isDestroyed()) {
      return this.updateState({
        ...DEFAULT_BROWSER_STATE,
        ...partial,
      });
    }

    const navigationHistory = webContents.navigationHistory;

    return this.updateState({
      url: webContents.getURL(),
      title: webContents.getTitle(),
      canGoBack: navigationHistory.canGoBack(),
      canGoForward: navigationHistory.canGoForward(),
      ...partial,
    });
  }

  private attachView(bounds?: ResearchBrowserBoundsInput): BrowserView {
    const window = this.windowProvider();
    if (!window) {
      throw new Error('Main window is unavailable for the research browser.');
    }

    const view = this.ensureView();
    if (this.attachedWindow !== window) {
      if (this.attachedWindow && !this.attachedWindow.isDestroyed()) {
        this.attachedWindow.setBrowserView(null);
      }

      window.setBrowserView(view);
      this.attachedWindow = window;
    }

    if (bounds) {
      view.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.max(1, Math.round(bounds.width)),
        height: Math.max(1, Math.round(bounds.height)),
      });
      view.setAutoResize({
        width: false,
        height: false,
      });
    }

    return view;
  }

  hide(): ResearchBrowserState {
    if (this.attachedWindow && !this.attachedWindow.isDestroyed()) {
      this.attachedWindow.setBrowserView(null);
    }
    this.attachedWindow = null;

    return this.updateState({
      visible: false,
      loading: false,
    });
  }

  async navigate(
    input: ResearchBrowserNavigationInput,
  ): Promise<ResearchBrowserState> {
    const view = this.attachView();
    const nextUrl = normalizeBrowserUrl(input.url);
    this.updateState({
      visible: true,
      loading: true,
      url: nextUrl,
    });
    await view.webContents.loadURL(nextUrl);
    return this.syncStateFromWebContents({
      visible: true,
      loading: false,
    });
  }

  async setBounds(
    input: ResearchBrowserBoundsInput,
  ): Promise<ResearchBrowserState> {
    if (!input.visible) {
      return this.hide();
    }

    this.attachView(input);
    return this.updateState({
      visible: true,
    });
  }

  goBack(): ResearchBrowserState {
    const view = this.browserView;
    if (view?.webContents) {
      const navigationHistory = view.webContents.navigationHistory;
      if (!navigationHistory.canGoBack()) {
        return this.getState();
      }

      navigationHistory.goBack();
      return this.syncStateFromWebContents({
        visible: true,
        loading: true,
      });
    }

    return this.getState();
  }

  goForward(): ResearchBrowserState {
    const view = this.browserView;
    if (view?.webContents) {
      const navigationHistory = view.webContents.navigationHistory;
      if (!navigationHistory.canGoForward()) {
        return this.getState();
      }

      navigationHistory.goForward();
      return this.syncStateFromWebContents({
        visible: true,
        loading: true,
      });
    }

    return this.getState();
  }

  reload(): ResearchBrowserState {
    const view = this.browserView;
    if (view?.webContents) {
      view.webContents.reload();
      return this.syncStateFromWebContents({
        visible: true,
        loading: true,
      });
    }

    return this.getState();
  }
}
