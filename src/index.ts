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
  CURRENT_VERSION,
} from './core/store.ts'
export { resolveLatest } from './core/meta.ts'
export { getConfigDir, getDataFile } from './core/paths.ts'
export {
  detectPM,
  buildInstallCommand,
  formatCommand,
  runInstall,
  type InstallCommand,
} from './core/pm.ts'
export { searchPrompt, type SearchOption, type SearchPromptOptions } from './ui/search-prompt.ts'
export { highlightKeywords } from './ui/highlight.ts'
