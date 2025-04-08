#!/usr/bin/env tsx
import { BrowserAutomationAgent } from './agent/browser-agent';

const {
  TOOL_NAME,
  USE_LOGIN,
  LOGIN_URL,
  LOGIN_USERNAME,
  LOGIN_PASSWORD,
  SUBMIT_BUTTON_SELECTOR,
  TARGET_PAGE,
  SELECTORS,
  USERNAME_FIELD,
  PASSWORD_FIELD,
} = process.env;

(async () => {
  if (!TOOL_NAME) {
    console.error('❌ TOOL_NAME is required.');
    process.exit(1);
  }

  const agent = new BrowserAutomationAgent();
  await agent.initialize(false);

  try {
    // Handle login if needed
    if (USE_LOGIN === 'true') {
      if (!LOGIN_URL || !LOGIN_USERNAME || !LOGIN_PASSWORD || !SUBMIT_BUTTON_SELECTOR) {
        console.error('❌ Missing login environment variables.');
        process.exit(1);
      }

      console.log(`🔐 Logging in as ${LOGIN_USERNAME}...`);
      await agent.navigateTo(LOGIN_URL);
      await agent.login(
        { username: LOGIN_USERNAME, password: LOGIN_PASSWORD },
        {
          usernameField: USERNAME_FIELD || '#emEail',
          passwordField: PASSWORD_FIELD || '#passEword',
          submitButton: SUBMIT_BUTTON_SELECTOR || 'button[type="submit"]',
        }
      );

      if (agent.getPage()?.url().includes('/login')) {
        console.warn('⚠️ Login may have failed (still on /login)');
      } else {
        console.log('✅ Logged in and ready.');
      }
    }

    switch (TOOL_NAME) {
      case 'login_and_capture': {
        if (!TARGET_PAGE) throw new Error('TARGET_PAGE is required');
        await agent.navigateTo(TARGET_PAGE);
        await agent.wait(2000);
        await agent.takeScreenshot('result.png');
        console.log('✅ Screenshot saved as result.png');
        console.log('📜 Logs:\n' + agent.getConsoleLogs().map(l => `[${l.type}] ${l.text}`).join('\n'));
        break;
      }

      case 'extract_elements': {
        if (!TARGET_PAGE || !SELECTORS) throw new Error('TARGET_PAGE and SELECTORS are required');
        console.log(`🧲 Extracting from ${TARGET_PAGE}...`);
        await agent.navigateTo(TARGET_PAGE);
        const selectors = SELECTORS.split(',').map(s => s.trim());
        const result = await agent.extractElements(selectors);

        for (const selector of selectors) {
          console.log(`\n🔍 Selector: ${selector}`);
          result[selector].forEach(text => console.log(` - ${text}`));
        }
        break;
      }

      case 'get_console_logs': {
        if (!TARGET_PAGE) throw new Error('TARGET_PAGE is required');
        await agent.navigateTo(TARGET_PAGE);
        await agent.wait(2000);
        console.log('📜 Console logs:\n' + agent.getConsoleLogs().map(l => `[${l.type}] ${l.text}`).join('\n'));
        break;
      }

      case 'get_console_errors': {
        if (!TARGET_PAGE) throw new Error('TARGET_PAGE is required');
        await agent.navigateTo(TARGET_PAGE);
        await agent.wait(2000);
        console.log('❗ Console errors:\n' + agent.getConsoleErrors().map(l => `[${l.type}] ${l.text}`).join('\n'));
        break;
      }

      case 'get_network_logs': {
        if (!TARGET_PAGE) throw new Error('TARGET_PAGE is required');
        await agent.navigateTo(TARGET_PAGE);
        await agent.wait(2000);
        console.log('🌐 Network logs:\n' + agent.getNetworkLogs().map(l => `${l.method} ${l.status} ${l.url}`).join('\n'));
        break;
      }

      case 'get_network_errors': {
        if (!TARGET_PAGE) throw new Error('TARGET_PAGE is required');
        await agent.navigateTo(TARGET_PAGE);
        await agent.wait(2000);
        const errors = agent.getNetworkErrors();
        console.log(errors.length ? '❌ Network errors:\n' + errors.join('\n') : '✅ No network errors.');
        break;
      }

      default:
        console.error(`❌ Unknown TOOL_NAME: ${TOOL_NAME}`);
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`);
  } finally {
    await agent.close();
  }
})();