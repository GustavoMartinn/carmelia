// carmelia — Code-aware HTTP client
// Public API exports

export type {
  ScannedRoute,
  RouteParam,
  RequestBody,
  BodyField,
  RequiredHeader,
  AuthRequirement,
  HttpMethod,
  FrameworkType,
  ScanOptions,
  ScanDiff,
} from './core/scanner/types.js'

export type { FrameworkParser } from './core/scanner/parsers/base.js'

export type {
  HttxConfig,
  FrameworkSource,
  GeneratorConfig,
  RunnerConfig,
  EnvVariables,
} from './core/config/types.js'

export { loadConfig, saveConfig, configExists } from './core/config/index.js'
export { loadEnv, listEnvs } from './core/config/env-loader.js'
export { scanProject, detectFrameworks, registerParser } from './core/scanner/index.js'
