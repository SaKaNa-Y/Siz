import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  target: 'node20',
  clean: true,
  dts: true,
  // tsdown >=0.22 defaults `fixedExtension` to true on the node platform, which
  // emits `.mjs`/`.d.mts`. Keep `.js`/`.d.ts` to match package.json bin/exports.
  fixedExtension: false,
})
