#!/usr/bin/env node

/**
 * Cross-Platform Testing Script for CBC-Agent
 * Tests compatibility across browsers and devices
 */

import puppeteer from 'puppeteer';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// User agents for different platforms
const USER_AGENTS = {
  'Chrome Desktop': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Safari Desktop': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Firefox Desktop': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Edge Desktop': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'iPhone Safari': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Android Chrome': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'iPad Safari': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

// Viewport sizes for different devices
const VIEWPORTS = {
  'Desktop': { width: 1920, height: 1080 },
  'Laptop': { width: 1366, height: 768 },
  'Tablet': { width: 768, height: 1024 },
  'Mobile': { width: 375, height: 812 },
  'Mobile Landscape': { width: 812, height: 375 },
};

// Test scenarios
const TESTS = [
  {
    name: 'Load Homepage',
    test: async (page) => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      const title = await page.title();
      return title.includes('Coral Beach');
    }
  },
  {
    name: 'Chat Input Functionality',
    test: async (page) => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      const input = await page.$('input[type="text"], textarea');
      if (!input) return false;
      await input.type('Hello');
      const value = await page.$eval('input[type="text"], textarea', el => el.value);
      return value === 'Hello';
    }
  },
  {
    name: 'Send Message',
    test: async (page) => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      const input = await page.$('input[type="text"], textarea');
      if (!input) return false;
      await input.type('What time is it?');
      
      // Find and click send button
      const button = await page.$('button[type="submit"], button:has(svg)');
      if (!button) return false;
      await button.click();
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      // Check if message appeared
      const messages = await page.$$eval('.message-content, [class*="message"]', els => els.length);
      return messages > 0;
    }
  },
  {
    name: 'Responsive Design',
    test: async (page) => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      
      // Check if viewport meta tag exists
      const viewport = await page.$eval('meta[name="viewport"]', el => el.content).catch(() => null);
      return viewport && viewport.includes('width=device-width');
    }
  },
  {
    name: 'Performance Metrics',
    test: async (page) => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      
      const metrics = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0];
        return {
          loadTime: perf.loadEventEnd - perf.fetchStart,
          domReady: perf.domContentLoadedEventEnd - perf.fetchStart,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0
        };
      });
      
      // Check if load time is under 3 seconds
      return metrics.loadTime < 3000;
    }
  }
];

// Main test runner
async function runTests() {
  console.log('🧪 CBC-Agent Cross-Platform Testing Suite\n');
  console.log(`Testing URL: ${BASE_URL}\n`);
  console.log('=' .repeat(60));
  
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };
  
  for (const [platformName, userAgent] of Object.entries(USER_AGENTS)) {
    console.log(`\n📱 Testing: ${platformName}`);
    console.log('-'.repeat(40));
    
    // Determine viewport based on platform
    let viewport = VIEWPORTS.Desktop;
    if (platformName.includes('iPhone') || platformName.includes('Android')) {
      viewport = VIEWPORTS.Mobile;
    } else if (platformName.includes('iPad')) {
      viewport = VIEWPORTS.Tablet;
    }
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--user-agent=${userAgent}`
      ]
    });
    
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.setUserAgent(userAgent);
    
    // Run tests for this platform
    for (const test of TESTS) {
      try {
        const passed = await test.test(page);
        
        if (passed) {
          console.log(`  ✅ ${test.name}`);
          results.passed++;
        } else {
          console.log(`  ❌ ${test.name}`);
          results.failed++;
        }
        
        results.details.push({
          platform: platformName,
          test: test.name,
          passed
        });
      } catch (error) {
        console.log(`  ❌ ${test.name} - Error: ${error.message}`);
        results.failed++;
        
        results.details.push({
          platform: platformName,
          test: test.name,
          passed: false,
          error: error.message
        });
      }
    }
    
    await browser.close();
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total: ${results.passed + results.failed}`);
  console.log(`🎯 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  // Platform-specific results
  console.log('\n📱 Platform Breakdown:');
  for (const platform of Object.keys(USER_AGENTS)) {
    const platformTests = results.details.filter(d => d.platform === platform);
    const passed = platformTests.filter(t => t.passed).length;
    const total = platformTests.length;
    console.log(`  ${platform}: ${passed}/${total} passed`);
  }
  
  // Performance recommendations
  console.log('\n💡 Recommendations:');
  if (results.failed > 0) {
    const failedTests = results.details.filter(d => !d.passed);
    const commonFailures = {};
    
    failedTests.forEach(test => {
      commonFailures[test.test] = (commonFailures[test.test] || 0) + 1;
    });
    
    for (const [testName, count] of Object.entries(commonFailures)) {
      if (count > 2) {
        console.log(`  ⚠️ "${testName}" failed on ${count} platforms - needs investigation`);
      }
    }
  } else {
    console.log('  🎉 All tests passed! Application is cross-platform ready.');
  }
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Check if Puppeteer is installed
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  require.resolve('puppeteer');
} catch (e) {
  console.error('❌ Puppeteer not installed. Please run: npm install --save-dev puppeteer');
  process.exit(1);
}

// Run the tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});