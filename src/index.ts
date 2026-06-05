// Public library surface for programmatic use.
export * from './core/types.ts'
export * from './core/registry.ts'
export * from './core/categories.ts'
export {
  loadData,
  saveData,
  migrate,
  emptyData,
  trackPackage,
  setFavorite,
  setCategory,
  untrack,
  listPackages,
  upsertBundle,
  addToBundle,
  removeFromBundle,
  getBundle,
  listBundles,
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
  buildSyncCommand,
  buildBundleInstallCommands,
  formatCommand,
  runInstall,
  type InstallCommand,
  type SpecSelection,
} from './core/pm.ts'
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
  buildUpgradePlan,
  planManifests,
  collectQueryNames,
  analyzeDep,
  resolveTarget,
  currentVersionFromRange,
  detectRangePrefix,
  applyPrefix,
  fetchVersionInfo,
  planCatalog,
  collectCatalogNames,
  type UpgradeMode,
  type UpgradePlan,
  type UpgradePlanItem,
  type ManifestPlan,
  type DepAnalysis,
  type VersionInfo,
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
export { searchPrompt, type SearchOption, type SearchPromptOptions } from './ui/search-prompt.ts'
export { highlightKeywords } from './ui/highlight.ts'
