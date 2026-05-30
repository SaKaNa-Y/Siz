/** The fixed starter set of categories Siz ships with. */
export const CATEGORIES = [
  'Frontend',
  'Backend',
  'Build Tools',
  'Testing',
  'Database',
  'State Management',
  'UI',
  'DevTools',
  'CLI Tools',
] as const

export type Category = (typeof CATEGORIES)[number]

/**
 * Match priority for categorization (most specific first). Order matters:
 * e.g. "vitest" must hit Testing before Build Tools ("vite"), and "pinia"
 * must hit State Management before Frontend ("vue").
 */
const PRIORITY: Category[] = [
  'State Management',
  'Testing',
  'Build Tools',
  'Database',
  'UI',
  'CLI Tools',
  'DevTools',
  'Frontend',
  'Backend',
]

/**
 * Keyword -> category heuristics. Each category lists substrings we look for
 * in a package's name, description, and keywords. Evaluated in PRIORITY order.
 */
const HEURISTICS: Record<Category, string[]> = {
  'State Management': ['redux', 'mobx', 'zustand', 'pinia', 'vuex', 'recoil', 'jotai', 'state management', 'store'],
  Testing: ['test', 'jest', 'vitest', 'mocha', 'chai', 'cypress', 'playwright', 'assertion', 'spec', 'mock'],
  'Build Tools': ['bundler', 'webpack', 'rollup', 'vite', 'esbuild', 'babel', 'compiler', 'transpile', 'build tool', 'tsup', 'tsdown'],
  Database: ['database', 'orm', 'sql', 'mongo', 'postgres', 'mysql', 'sqlite', 'redis', 'prisma', 'sequelize', 'knex'],
  UI: ['component', 'ui library', 'design system', 'css', 'tailwind', 'styled', 'chakra', 'antd', 'material', 'icons'],
  Frontend: ['react', 'vue', 'svelte', 'angular', 'solid', 'frontend', 'browser', 'dom', 'spa', 'router', 'jsx'],
  Backend: ['server', 'express', 'fastify', 'koa', 'nest', 'http', 'api', 'backend', 'middleware', 'graphql', 'rest'],
  'CLI Tools': ['cli', 'command line', 'terminal', 'prompt', 'argv', 'commander', 'yargs'],
  DevTools: ['lint', 'eslint', 'prettier', 'format', 'debug', 'devtool', 'logger', 'logging', 'typescript', 'types'],
}

/**
 * Suggest a category for a package based on its name/description/keywords.
 * Returns undefined when nothing matches confidently.
 */
export function suggestCategory(pkg: {
  name?: string
  description?: string
  keywords?: string[]
}): Category | undefined {
  const haystack = [
    pkg.name ?? '',
    pkg.description ?? '',
    ...(pkg.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase()

  for (const category of PRIORITY) {
    const needles = HEURISTICS[category]
    if (needles?.some((n) => haystack.includes(n))) return category
  }
  return undefined
}

/** Case-insensitively resolve a user-typed category to a canonical one. */
export function normalizeCategory(input: string): Category | undefined {
  const lower = input.trim().toLowerCase()
  return CATEGORIES.find((c) => c.toLowerCase() === lower)
}
