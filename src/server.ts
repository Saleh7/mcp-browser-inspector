import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { BrowserAutomationAgent } from './agent/browser-agent';

const server = new Server({
  name: 'mcp-browser-inspector',
  version: '1.0.0',
}, {
  capabilities: { tools: {} },
});

const tools: Tool[] = [
  {
    name: 'get_console_logs_and_take_screenshot',
    description: 'Check our browser logs and take a screenshot of the current page.',
    inputSchema: {
      type: 'object',
      properties: {
        targetPage: { type: 'string', description: 'The URL of the page to navigate to and take a screenshot of and get the console logs.' },
        randomString: { type: 'string', description: 'Outputs the console logs and screenshot path.' },
      },
      required: ['targetPage', 'randomString'],
    },
  },
  {
    name: 'extract_elements',
    description: 'Extract elements from a specified URL using provided CSS selectors.',
    inputSchema: {
      type: 'object',
      properties: {
        targetPage: { type: 'string', description: 'The URL of the page to navigate to and extract elements from.' },
        selectors: { type: 'array', items: { type: 'string' }, description: 'An array of CSS selectors used to identify and extract elements from the page.' },
      },
      required: ['targetPage', 'selectors'],
    },
  },
  {
    name: 'get_console_logs',
    description: 'Check our browser logs',
    inputSchema: {
      type: 'object',
      properties: {
        targetPage: { type: 'string', description: 'The URL of the page to check the logs of.' },
        randomString: { type: 'string', description: 'A random string to identify the logs.' },
        },
      required: ['targetPage', 'randomString'],
    },
  },
  {
    name: 'get_console_errors',
    description: 'Get console errors for a given URL.',
    inputSchema: {
      type: 'object',
      properties: { 
        targetPage: { type: 'string', description: 'The URL of the page to check the errors of.' },
        randomString: { type: 'string', description: 'A random string to identify the errors.' },
      },
      required: ['targetPage', 'randomString'],
    },
  },
  {
    name: 'get_network_logs',
    description: 'Capture network logs for a page visit.',
    inputSchema: {
      type: 'object',
      properties: { 
        targetPage: { type: 'string', description: 'The URL of the page to check the network logs of.' },
        randomString: { type: 'string', description: 'A random string to identify the network logs.' },
      },
      required: ['targetPage', 'randomString'],
    },
  },
  {
    name: 'get_network_errors',
    description: 'Capture failed network requests for a page.',
    inputSchema: {
      type: 'object',
      properties: { 
        targetPage: { type: 'string', description: 'The URL of the page to check the network errors of.' },
        randomString: { type: 'string', description: 'A random string to identify the network errors.' },
      },
      required: ['targetPage', 'randomString'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async ({ params }: { params: any }) => {
  const { name, arguments: args } = params;
  const agent = new BrowserAutomationAgent();

  const useLogin = process.env.USE_LOGIN === 'true';
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;
  const loginUrl = process.env.LOGIN_URL;
  const submitButton = process.env.SUBMIT_BUTTON_SELECTOR;
  const usernameField = process.env.USERNAME_FIELD;
  const passwordField = process.env.PASSWORD_FIELD;

  try {
    await agent.initialize(true);

    if (useLogin) {
      if (!username || !password || !loginUrl) throw new Error('Missing login environment variables.');
      await agent.navigateTo(loginUrl);
      await agent.login({ username, password }, {
        usernameField: usernameField || '#email',
        passwordField: passwordField || '#password',
        submitButton: submitButton || 'button[type="submit"]',
      });
    }

    switch (name) {
      case 'get_console_logs_and_take_screenshot': {
        await agent.navigateTo(args.targetPage);
        await agent.wait(2000);
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        // Use an absolute path that will be easier to find, with env var support
        const outputDir = args.outputPath || process.env.SCREENSHOT_PATH || '/tmp/mcp-screenshots';
        // Ensure directory exists
        const fs = await import('fs/promises');
        try {
          await fs.mkdir(outputDir, { recursive: true });
        } catch (err) {
          console.error(`Failed to create directory ${outputDir}:`, err);
        }
        const screenshotPath = `${outputDir}/login_capture_${timestamp}.png`;
        await agent.takeScreenshot(screenshotPath);
        const logs = agent.getConsoleLogs();
        return {
          content: [
            { type: 'text', text: `✅ Screenshot taken and saved to ${screenshotPath}. Logs:\n` + logs.map((l) => `[${l.type}] ${l.text}`).join('\n') },
          ],
        };
      }

      case 'extract_elements': {
        await agent.navigateTo(args.url);
        if (agent.getPage()?.url().includes('/login')) {
          return {
            content: [
              { type: 'text', text: `🚫 Still on login page after login attempt.` },
            ],
            isError: true,
          };
        }
        const extracted = await agent.extractElements(args.selectors);
        const output = Object.entries(extracted)
          .map(([sel, texts]) => `Selector: ${sel}\n` + texts.map(t => `  - ${t}`).join('\n')).join('\n\n');
        return { content: [{ type: 'text', text: output }] };
      }

      case 'get_console_logs': {
        await agent.navigateTo(args.url);
        await agent.wait(2000);
        const logs = agent.getConsoleLogs();
        return {
          content: [
            { type: 'text', text: logs.length ? logs.map(l => `[${l.type}] ${l.text}`).join('\n') : 'No console logs.' },
          ],
        };
      }

      case 'get_console_errors': {
        await agent.navigateTo(args.url);
        await agent.wait(2000);
        const logs = agent.getConsoleErrors();
        return {
          content: [
            { type: 'text', text: logs.length ? logs.map(l => `[${l.type}] ${l.text}`).join('\n') : 'No console errors.' },
          ],
        };
      }

      case 'get_network_logs': {
        await agent.navigateTo(args.url);
        await agent.wait(2000);
        const logs = agent.getNetworkLogs();
        return {
          content: [
            { type: 'text', text: logs.map(l => `${l.method} ${l.status} ${l.url}`).join('\n') },
          ],
        };
      }

      case 'get_network_errors': {
        await agent.navigateTo(args.url);
        await agent.wait(2000);
        const errors = agent.getNetworkErrors();
        return {
          content: [
            { type: 'text', text: errors.length ? errors.join('\n') : 'No network errors.' },
          ],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        { type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
      isError: true,
    };
  } finally {
    await agent.close();
  }
});

const start = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('🟢 MCP Browser Inspector is running.');
};

start();