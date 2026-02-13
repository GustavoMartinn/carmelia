#!/usr/bin/env node

import { Command } from 'commander'
import { registerBuiltinParsers } from '../core/scanner/parsers/index.js'
import { registerInitCommand } from './commands/init.js'
import { registerScanCommand } from './commands/scan.js'
import { registerRunCommand } from './commands/run.js'
import { registerListCommand } from './commands/list.js'
import { registerSyncCommand } from './commands/sync.js'

// Register all built-in framework parsers
registerBuiltinParsers()

const program = new Command()

program
  .name('carmelia')
  .description('Code-aware HTTP client — reads your API code and generates ready-to-run requests')
  .version('0.1.0')

registerInitCommand(program)
registerScanCommand(program)
registerRunCommand(program)
registerListCommand(program)
registerSyncCommand(program)

program.parse()
