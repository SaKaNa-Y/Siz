// Public library surface for programmatic use.
export * from './core/types.ts'
export * from './core/registry.ts'
export * from './core/categories.ts'
export {
  loadData,
  saveData,
  migrate,
  emptyData,
  addFavorite,
  setCategory,
  removeFavorite,
  listFavorites,
  upsertBundle,
  addToBundle,
  removeFromBundle,
  getBundle,
  listBundles,
  listSavedEntries,
  type BundleRemoval,
  removeBundle,
  renameBundle,
  touchBundle,
  type BundleMeta,
  CURRENT_VERSION,
} from './core/store.ts'
export {
  resolveBundleInstall,
  type BundleInstallItem,
  type BundleInstallPlan,
} from './core/bundle.ts'
export { resolveLatest } from './core/meta.ts'
export { getConfigDir, getDataFile } from './core/paths.ts'
export {
  detectPM,
  buildInstallCommand,
  buildInstallCommands,
  buildRemoveCommand,
  buildSyncCommand,
  buildBundleInstallCommands,
  parseSpec,
  formatCommand,
  runInstall,
  type InstallCommand,
  type SpecSelection,
} from './core/pm.ts'
export {
  fetchTrustSignals,
  fetchDownloadTrend,
  computeMomentum,
  isStale,
  formatPublishAge,
  parseReplacement,
  STALE_YEARS,
  MOMENTUM_THRESHOLD,
  MOMENTUM_MIN_DOWNLOADS,
} from './core/trust.ts'
export {
  fetchInstallSizes,
  fetchBundleSize,
  formatBytes,
  isHeavy,
  HEAVY_INSTALL_BYTES,
} from './core/size.ts'
export {
  fetchLicenses,
  normalizeLicense,
  isUnclearLicense,
  formatLicense,
  truncateLicense,
  LICENSE_INLINE_MAX,
} from './core/license.ts'
export { fetchManifests, type PackageManifest } from './core/packument.ts'
export {
  findPackageJson,
  loadProjectManifest,
  loadManifestAt,
  discoverManifests,
  loadWorkspaceGlobs,
  collectDeps,
  applyRangeEdits,
  writeManifest,
  isUpgradableSpecifier,
  type DepType,
  type DiscoverOptions,
  type ProjectDep,
  type ProjectManifest,
  type WorkspaceGlobs,
} from './core/project.ts'
export {
  discoverProjectDeps,
  collectQueryNames,
  collectCatalogNames,
  type DependencyScan,
} from './core/resolve.ts'
export {
  compareDep,
  fetchVersionInfo,
  currentVersionFromRange,
  detectRangePrefix,
  applyPrefix,
  type VersionInfo,
  type DepComparison,
  type CompareResult,
  type CompareSkip,
  type DiffLevel,
  type RangePrefix,
} from './core/compare.ts'
export {
  buildUpgradePlan,
  planManifests,
  analyzeDep,
  resolveTarget,
  planCatalog,
  type UpgradeMode,
  type UpgradePlan,
  type UpgradePlanItem,
  type ManifestPlan,
  type DepAnalysis,
  type CatalogPlanItem,
} from './core/upgrade.ts'
export {
  findWorkspaceYaml,
  loadCatalogManifest,
  discoverCatalog,
  readWorkspacePackages,
  applyCatalogEdits,
  DEFAULT_CATALOG,
  type CatalogEntry,
  type CatalogManifest,
} from './core/catalog.ts'
export {
  analyzeOutdated,
  buildOutdatedReport,
  planManifestsOutdated,
  planCatalogOutdated,
  type OutdatedItem,
  type OutdatedReport,
  type ManifestOutdated,
  type CatalogOutdatedItem,
} from './core/outdated.ts'
export {
  loadRules,
  evaluateRule,
  partitionByRules,
  matchesPattern,
  globToRegExp,
  normalizeRules,
  CONFIG_FILENAME,
  type DependencyRules,
  type SizConfig,
  type RuleVerdict,
  type RulePartition,
  type LoadedRules,
} from './core/rules.ts'
export { searchPrompt, type SearchOption, type SearchPromptOptions } from './ui/search-prompt.ts'
export { highlightKeywords } from './ui/highlight.ts'
