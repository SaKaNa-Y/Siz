/**
 * `--fav` retired along with favorites. The arg parser would reject it with a
 * bare "Unknown option", which teaches the user nothing, so it is caught before
 * parsing and answered with the flow that replaced it.
 */
const FAV_MESSAGE =
  'The --fav flag was removed along with favorites — bundles are now the only place packages are saved.\n' +
  '  Save:   siz add <package> --bundle <name>\n' +
  '  Remove: siz bundle rm <name> <package>\n' +
  '  List:   siz list\n' +
  '  Your old favorites were migrated into the "favorites" bundle.'

/** Throw an explanatory error when argv still uses a flag siz no longer has. */
export function assertNoRemovedFlags(argv: string[]): void {
  if (argv.some((arg) => arg.split('=')[0] === '--fav')) throw new Error(FAV_MESSAGE)
}
