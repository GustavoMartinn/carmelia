import type { ScannedRoute, ScanOptions, ScanDiff } from '../types.js'

export interface FrameworkParser {
  name: string
  language: 'typescript' | 'javascript' | 'go'

  /** Detect if the project uses this framework */
  detect(projectPath: string): Promise<boolean>

  /** Full scan of the project */
  scan(projectPath: string, options?: ScanOptions): Promise<ScannedRoute[]>

  /** Detect changes since last scan */
  diff(projectPath: string, previousScan: ScannedRoute[]): Promise<ScanDiff>
}
