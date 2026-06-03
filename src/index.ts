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
  addTags,
  removeTags,
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
  collectDeps,
  applyRangeEdits,
  writeManifest,
  isUpgradableSpecifier,
  type DepType,
  type ProjectDep,
  type ProjectManifest,
} from './core/project.ts'
export {
  buildUpgradePlan,
  analyzeDep,
  resolveTarget,
  currentVersionFromRange,
  detectRangePrefix,
  applyPrefix,
  fetchVersionInfo,
  type UpgradeMode,
  type UpgradePlan,
  type UpgradePlanItem,
  type DepAnalysis,
  type VersionInfo,
} from './core/upgrade.ts'
export { searchPrompt, type SearchOption, type SearchPromptOptions } from './ui/search-prompt.ts'
export { highlightKeywords } from './ui/highlight.ts'
