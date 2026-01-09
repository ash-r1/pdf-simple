#!/usr/bin/env node
/**
 * pdf-simple CLI
 *
 * Command-line interface for pdf-simple utilities.
 *
 * @module cli
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { formatDoctorResult, runDoctor } from './doctor.js';

/**
 * Get version from package.json
 */
function getVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const packageJsonPath = require.resolve('pdf-simple/package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version ?? '0.0.0';
  } catch {
    // Fallback: try to find package.json relative to this file
    try {
      const packageJsonPath = path.join(
        path.dirname(new URL(import.meta.url).pathname),
        '..',
        'package.json',
      );
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
}

const VERSION: string = getVersion();

/**
 * Print usage information.
 */
function printUsage(): void {
  console.log(`pdf-simple v${VERSION}

Usage: pdf-simple <command>

Commands:
  doctor    Check dependencies and configuration
  help      Show this help message
  version   Show version number

Examples:
  pdf-simple doctor    # Check if all dependencies are properly installed
`);
}

/**
 * Print version.
 */
function printVersion(): void {
  console.log(VERSION);
}

/**
 * Run the doctor command.
 */
async function runDoctorCommand(): Promise<number> {
  const result = await runDoctor();
  console.log(formatDoctorResult(result));
  return result.ok ? 0 : 1;
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  let exitCode = 0;

  switch (command) {
    case 'doctor':
      exitCode = await runDoctorCommand();
      break;

    case 'version':
    case '-v':
    case '--version':
      printVersion();
      break;

    case 'help':
    case '-h':
    case '--help':
    case undefined:
      printUsage();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "pdf-simple help" for usage information.');
      exitCode = 1;
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
