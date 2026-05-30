import { getLatestVersion } from 'fast-npm-meta'

export interface PackageMeta {
  name: string
  version?: string
  /** True if the package exists on the registry. */
  exists: boolean
}

/**
 * Resolve the latest version of a package via fast-npm-meta.
 * Returns { exists: false } if the package is not found.
 */
export async function resolveLatest(name: string): Promise<PackageMeta> {
  try {
    const meta = await getLatestVersion(name)
    const version = (meta as { version?: string })?.version
    return { name, version, exists: Boolean(version) }
  } catch {
    return { name, exists: false }
  }
}
