export type EnvironmentName = 'production' | 'preview' | 'alpha' | 'local' | 'test'

export interface EnvVars {
  ENVIRONMENT?: string
  SITE_URL?: string
  [key: string]: any
}

export function getEnvironment(env?: EnvVars | null): EnvironmentName {
  if (!env || !env.ENVIRONMENT) {
    return 'production'
  }
  const raw = String(env.ENVIRONMENT).toLowerCase() as EnvironmentName
  const allowed: EnvironmentName[] = ['production', 'preview', 'alpha', 'local', 'test']
  if (allowed.includes(raw)) {
    return raw
  }
  return 'production'
}

export function isPreview(env: string | EnvironmentName): boolean {
  return env === 'preview'
}

export function isAlpha(env: string | EnvironmentName): boolean {
  return env === 'alpha'
}

export function isProduction(env: string | EnvironmentName): boolean {
  return env === 'production'
}

export function isLocal(env: string | EnvironmentName): boolean {
  return env === 'local' || env === 'test'
}
