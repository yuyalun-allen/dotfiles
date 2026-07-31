import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'fs';

// 检查本地系统是否存在 Arch Linux 安装的浏览器路径
const systemChromium = existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined;
const systemFirefox = existsSync('/usr/bin/firefox') ? '/usr/bin/firefox' : undefined;

export default defineConfig({
  testDir: './tests',
  /* 失败时重试次数 */
  retries: process.env.CI ? 2 : 0,
  /* CI 环境下使用 1 个 Worker，本地并发 */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter 输出样式 */
  reporter: 'html',

  use: {
    /* 基础 URL，如果项目有本地服务器可设置 */
    // baseURL: 'http://127.0.0.1:3000',

    /* 失败时收集 Trace */
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 如果 /usr/bin/chromium 存在则直接使用，不存在（如 CI 环境）则自动退回到 Playwright 内置 Chromium
        launchOptions: systemChromium ? { executablePath: systemChromium } : {},
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // 同理，如果本地有 Arch 原生 Firefox 则使用，否则使用 Playwright 内置的版本
        launchOptions: systemFirefox ? { executablePath: systemFirefox } : {},
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // WebKit 在 Arch 上无原生二进制程序，本地跳过或依靠 CI 上的 Ubuntu 内置 WebKit 跑测试
      },
    },
  ],
});
