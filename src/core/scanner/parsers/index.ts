import { registerParser } from '../index.js'
import { NestJSParser } from './nestjs.js'
import { ExpressParser } from './express.js'
import { GoParser } from './go.js'

// Register all built-in parsers
export function registerBuiltinParsers(): void {
  registerParser(new NestJSParser())
  registerParser(new ExpressParser())
  registerParser(new GoParser())
}
