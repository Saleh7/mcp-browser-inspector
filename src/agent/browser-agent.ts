import { chromium, Browser, Page, ConsoleMessage, Request } from 'playwright';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginSelectors {
  usernameField: string;
  passwordField: string;
  submitButton: string;
}

export interface ConsoleLogEntry {
  type: string;
  text: string;
  location?: string;
}

export interface NetworkLogEntry {
  url: string;
  method: string;
  status: number | null;
}

export class BrowserAutomationAgent {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private consoleLogs: ConsoleLogEntry[] = [];
  private networkLogs: NetworkLogEntry[] = [];
  private networkErrors: string[] = [];

  async initialize(headless: boolean = true): Promise<void> {
    this.browser = await chromium.launch({ headless });
    this.page = await this.browser.newPage();
    this.consoleLogs = [];
    this.networkLogs = [];
    this.networkErrors = [];

    this.page.on('console', (msg: ConsoleMessage) => {
      this.consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()?.url + `:${msg.location()?.lineNumber}:${msg.location()?.columnNumber}`,
      });
    });

    this.page.on('requestfinished', async (req: Request) => {
      const response = await req.response();
      this.networkLogs.push({
        url: req.url(),
        method: req.method(),
        status: response?.status() || null,
      });
    });

    this.page.on('requestfailed', (req: Request) => {
      this.networkErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`);
    });
  }

  getPage(): Page | null {
    return this.page;
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async login(credentials: LoginCredentials, selectors: LoginSelectors): Promise<void> {
    if (!this.page) throw new Error('Agent not initialized.');
  
    await this.page.waitForSelector(selectors.usernameField);
    await this.page.fill(selectors.usernameField, credentials.username);
  
    await this.page.waitForSelector(selectors.passwordField);
    await this.page.fill(selectors.passwordField, credentials.password);
  
    await this.page.waitForSelector(process.env.SUBMIT_BUTTON_SELECTOR || selectors.submitButton);
  
    await this.page.click(process.env.SUBMIT_BUTTON_SELECTOR || selectors.submitButton);
  
    try {
      await this.page.waitForFunction(() => {
        return !window.location.pathname.includes('/login');
      }, { timeout: 10000 });
      console.log('✅ Login success (URL changed)');
    } catch {
      console.warn('⚠️ Login may have failed (still on /login)');
      await this.takeScreenshot('login_maybe_failed.png');
    }
  }
  

  async takeScreenshot(filePath: string): Promise<void> {
    if (!this.page) throw new Error('Agent not initialized.');
    await this.page.screenshot({ path: filePath, fullPage: true });
  }

  getConsoleLogs(): ConsoleLogEntry[] {
    return [...this.consoleLogs];
  }

  getConsoleErrors(): ConsoleLogEntry[] {
    return this.consoleLogs.filter(log => log.type === 'error');
  }

  getNetworkLogs(): NetworkLogEntry[] {
    return [...this.networkLogs];
  }

  getNetworkErrors(): string[] {
    return [...this.networkErrors];
  }

  async extractElements(selectors: string[]): Promise<Record<string, string[]>> {
    if (!this.page) throw new Error('Agent not initialized.');

    const results: Record<string, string[]> = {};

    for (const selector of selectors) {
      const texts = await this.page.$$eval(selector, elements =>
        elements.map(el => el.textContent?.trim() || '')
      );
      results[selector] = texts;
    }

    return results;
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
    this.consoleLogs = [];
    this.networkLogs = [];
    this.networkErrors = [];
  }
}
