import type { FrameworkType } from '../scanner/types.js'

export interface HttxConfig {
  version: number
  frameworks: FrameworkSource[]
  output: string
  generator: GeneratorConfig
  runner: RunnerConfig
  defaults: DefaultsConfig
}

export interface FrameworkSource {
  type: FrameworkType
  source: string
  include?: string[]
  exclude?: string[]
}

export interface GeneratorConfig {
  bodyStyle: 'typed' | 'example'
  includeComments: boolean
  includeValidation: boolean
}

export interface RunnerConfig {
  timeout: number
  followRedirects: boolean
  saveResponses: boolean
  responsesDir: string
}

export interface DefaultsConfig {
  headers: Record<string, string>
}

export interface EnvVariables {
  [key: string]: string
}

export const DEFAULT_CONFIG: HttxConfig = {
  version: 1,
  frameworks: [],
  output: './.carmelia/requests',
  generator: {
    bodyStyle: 'typed',
    includeComments: true,
    includeValidation: true,
  },
  runner: {
    timeout: 30000,
    followRedirects: true,
    saveResponses: true,
    responsesDir: './.carmelia/responses',
  },
  defaults: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
}
