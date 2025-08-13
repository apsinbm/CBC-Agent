#!/usr/bin/env node
/**
 * Weather Service Smoke Test
 * CLI tool to test weather service functionality
 * Usage: node scripts/weather-smoketest.js --lat 32.294 --lon -64.783
 */

import { program } from 'commander';
import weatherService, { WEATHER_UNITS } from '../src/lib/weather/index.js';
import { validateWeatherConfig, checkTimeSync } from '../src/lib/weather/config.js';
import chalk from 'chalk';

program
  .name('weather-smoketest')
  .description('Test CBC-Agent weather service')
  .option('--lat <latitude>', 'Latitude coordinate', '32.2949')
  .option('--lon <longitude>', 'Longitude coordinate', '-64.7814')
  .option('--units <units>', 'Units (metric|imperial)', 'metric')
  .option('--provider <provider>', 'Force specific provider (openmeteo|weatherkit|openweather)')
  .option('--verbose', 'Verbose output')
  .option('--health-only', 'Only run health checks')
  .parse();

const options = program.opts();

// Logging helpers
const log = (message) => console.log(message);
const logSuccess = (message) => console.log(chalk.green('✓'), message);
const logError = (message) => console.log(chalk.red('✗'), message);
const logWarning = (message) => console.log(chalk.yellow('⚠'), message);
const logInfo = (message) => console.log(chalk.blue('ℹ'), message);

async function runSmokeTest() {
  console.log(chalk.bold('\n🌤️  CBC-Agent Weather Service Smoke Test\n'));

  const startTime = Date.now();
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  try {
    // Step 1: Configuration validation
    logInfo('Step 1: Validating configuration...');
    try {
      const config = validateWeatherConfig();
      logSuccess(`Configuration valid - Provider: ${config.provider}`);
      
      if (options.verbose) {
        console.log('  Config details:', {
          provider: config.provider,
          fallback: config.fallbackProvider,
          timeout: config.timeout,
          retries: config.retries,
          cache: config.cache
        });
      }
      passed++;
    } catch (error) {
      logError(`Configuration invalid: ${error.message}`);
      failed++;
      return;
    }

    // Step 2: Time synchronization check (for WeatherKit)
    logInfo('Step 2: Checking time synchronization...');
    try {
      const timeSync = await checkTimeSync();
      if (timeSync.synced) {
        logSuccess('Time synchronization OK');
      } else {
        logWarning(`Time drift detected: ${timeSync.warning}`);
        warnings++;
      }
      passed++;
    } catch (error) {
      logWarning(`Time sync check failed: ${error.message}`);
      warnings++;
    }

    // Step 3: Service initialization
    logInfo('Step 3: Initializing weather service...');
    try {
      await weatherService.initialize();
      logSuccess('Service initialized successfully');
      passed++;
    } catch (error) {
      logError(`Service initialization failed: ${error.message}`);
      failed++;
      return;
    }

    // Step 4: Health check
    logInfo('Step 4: Running health check...');
    try {
      const health = await weatherService.healthCheck();
      if (health.healthy) {
        logSuccess(`Health check passed - Provider: ${health.provider || 'Unknown'}`);
        if (health.is_stale) {
          logWarning('Data is stale (served from cache)');
          warnings++;
        }
      } else {
        logError(`Health check failed: ${health.error}`);
        failed++;
      }
      passed++;
    } catch (error) {
      logError(`Health check error: ${error.message}`);
      failed++;
    }

    // Exit early if health-only flag is set
    if (options.healthOnly) {
      logInfo('Health-only mode - skipping weather fetch test');
    } else {
      // Step 5: Weather data fetch
      logInfo(`Step 5: Fetching weather data for (${options.lat}, ${options.lon})...`);
      try {
        const lat = parseFloat(options.lat);
        const lon = parseFloat(options.lon);
        const units = options.units === 'imperial' ? WEATHER_UNITS.IMPERIAL : WEATHER_UNITS.METRIC;

        if (isNaN(lat) || isNaN(lon)) {
          throw new Error('Invalid coordinates provided');
        }

        const weatherData = await weatherService.getCurrentWeather({ lat, lon, units });
        
        logSuccess('Weather data fetched successfully');
        
        // Display weather information
        console.log(chalk.bold('\n📊 Weather Data:'));
        console.log(`   Temperature: ${weatherData.current.temp}`);
        console.log(`   Feels like: ${weatherData.current.feels_like}`);
        console.log(`   Humidity: ${weatherData.current.humidity}%`);
        console.log(`   Wind: ${weatherData.current.wind_speed}`);
        console.log(`   Conditions: ${weatherData.current.condition}`);
        console.log(`   Provider: ${weatherData.provider}`);
        console.log(`   Fresh data: ${weatherData.is_stale ? 'No (stale)' : 'Yes'}`);
        
        if (weatherData.is_stale) {
          logWarning('Data is stale - live data temporarily unavailable');
          warnings++;
        }
        
        passed++;
      } catch (error) {
        logError(`Weather fetch failed: ${error.message}`);
        failed++;
      }
    }

    // Step 6: Metrics check
    logInfo('Step 6: Checking service metrics...');
    try {
      const metrics = weatherService.getMetrics();
      logSuccess(`Metrics available - ${metrics.requests_total} total requests`);
      
      if (options.verbose) {
        console.log('  Metrics summary:', {
          requests: metrics.requests_total,
          errors: metrics.errors_total,
          errorRate: metrics.error_rate + '%',
          fallbackUsed: metrics.fallback_used,
          latency: metrics.latency_ms
        });
      }
      passed++;
    } catch (error) {
      logWarning(`Metrics check failed: ${error.message}`);
      warnings++;
    }

    // Step 7: Provider capabilities
    logInfo('Step 7: Checking provider capabilities...');
    try {
      const capabilities = weatherService.getProviderCapabilities();
      logSuccess('Provider capabilities retrieved');
      
      if (options.verbose) {
        console.log('  Primary provider:', capabilities.primary);
        console.log('  Fallback provider:', capabilities.fallback);
      }
      passed++;
    } catch (error) {
      logWarning(`Capabilities check failed: ${error.message}`);
      warnings++;
    }

  } catch (error) {
    logError(`Unexpected error: ${error.message}`);
    failed++;
  }

  // Results summary
  const duration = Date.now() - startTime;
  const total = passed + failed;
  
  console.log(chalk.bold('\n📋 Test Results:'));
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Passed: ${chalk.green(passed)}`);
  console.log(`   Failed: ${chalk.red(failed)}`);
  console.log(`   Warnings: ${chalk.yellow(warnings)}`);
  console.log(`   Success Rate: ${total > 0 ? Math.round((passed / total) * 100) : 0}%`);

  // Final status
  if (failed === 0) {
    logSuccess('All tests passed! Weather service is operational.');
    process.exit(0);
  } else {
    logError('Some tests failed. Check configuration and try again.');
    process.exit(1);
  }
}

// Handle errors and cleanup
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logError(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Run the smoke test
runSmokeTest().catch((error) => {
  logError(`Smoke test failed: ${error.message}`);
  process.exit(1);
});