const policyRules = [
  { name: 'name', severity: 'error', source: 'local', origin: 'siz.config.json#/rules/name' },
  {
    name: 'license',
    severity: 'error',
    source: 'npm-packument',
    origin: 'siz.config.json#/rules/license',
  },
  {
    name: 'installSize',
    severity: 'error',
    source: 'npm-packument',
    origin: 'siz.config.json#/rules/installSize',
  },
  {
    name: 'stale',
    severity: 'warn',
    source: 'fast-npm-meta',
    origin: 'siz.config.json#/rules/stale',
  },
  {
    name: 'deprecated',
    severity: 'error',
    source: 'npm-packument',
    origin: 'siz.config.json#/rules/deprecated',
  },
  {
    name: 'provenance',
    severity: 'off',
    source: 'npm-packument',
    origin: 'siz.config.json#/rules/provenance',
  },
]

const baseLocations = [
  ['package.json', 'dependencies'],
  ['apps/web/package.json', 'dependencies'],
  ['packages/design-system/package.json', 'dependencies'],
  ['tools/scripts/package.json', 'devDependencies'],
]

function finding({
  packageName,
  version,
  manifest,
  dependencyType,
  declared,
  rule,
  severity,
  actual,
  expected,
  actualData,
  expectedData,
}) {
  return {
    packageName,
    version,
    manifest,
    dependencyType,
    declared,
    rule,
    severity,
    actual,
    expected,
    actualData,
    expectedData,
    origin: `siz.config.json#/rules/${rule}`,
  }
}

function buildLegacyFindings() {
  const rows = []

  for (let index = 0; index < 16; index += 1) {
    const [manifest, dependencyType] = baseLocations[index % baseLocations.length]
    rows.push(
      finding({
        packageName: `@acme/legacy-license-${String(index + 1).padStart(2, '0')}`,
        version: `1.${index}.0`,
        manifest,
        dependencyType,
        declared: `^1.${index}.0`,
        rule: 'license',
        severity: 'error',
        actual: index % 3 === 0 ? 'SEE LICENSE IN LICENSE' : 'GPL-3.0-only',
        expected: 'MIT | Apache-2.0',
        actualData: {
          license: index % 3 === 0 ? 'SEE LICENSE IN LICENSE' : 'GPL-3.0-only',
          clarity: index % 3 === 0 ? 'unclear' : 'clear',
        },
        expectedData: { allow: ['MIT', 'Apache-2.0'] },
      }),
    )
  }

  for (let index = 0; index < 10; index += 1) {
    const [manifest, dependencyType] = baseLocations[(index + 1) % baseLocations.length]
    const size = 6.2 + index * 0.7
    rows.push(
      finding({
        packageName: `@acme/heavy-runtime-${String(index + 1).padStart(2, '0')}`,
        version: `3.${index}.1`,
        manifest,
        dependencyType,
        declared: `~3.${index}.0`,
        rule: 'installSize',
        severity: 'error',
        actual: `${size.toFixed(1)} MB`,
        expected: '≤ 5 MB',
        actualData: { bytes: Math.round(size * 1_000_000), display: `${size.toFixed(1)} MB` },
        expectedData: { maxBytes: 5_000_000, display: '5 MB' },
      }),
    )
  }

  for (let index = 0; index < 4; index += 1) {
    const [manifest, dependencyType] = baseLocations[(index + 2) % baseLocations.length]
    rows.push(
      finding({
        packageName: index === 0 ? 'left-pad' : `@acme/retired-name-${index + 1}`,
        version: `0.${index + 1}.0`,
        manifest,
        dependencyType,
        declared: `^0.${index + 1}.0`,
        rule: 'name',
        severity: 'error',
        actual: index === 0 ? 'denied by "left-pad"' : 'denied by "@acme/retired-*"',
        expected: 'name permitted by policy',
        actualData: { matchedDeny: index === 0 ? 'left-pad' : '@acme/retired-*' },
        expectedData: { permitted: true },
      }),
    )
  }

  for (let index = 0; index < 10; index += 1) {
    const [manifest, dependencyType] = baseLocations[(index + 3) % baseLocations.length]
    const years = 3 + (index % 5)
    rows.push(
      finding({
        packageName: `@acme/dormant-${String(index + 1).padStart(2, '0')}`,
        version: `2.${index}.0`,
        manifest,
        dependencyType,
        declared: `^2.${index}.0`,
        rule: 'stale',
        severity: 'warn',
        actual: `${years}y ${index % 12}mo`,
        expected: '≤ 2y since latest publish',
        actualData: { age: `${years}y ${index % 12}mo` },
        expectedData: { max: '2y' },
      }),
    )
  }

  return rows
}

function unknown({ packageName, manifest, dependencyType, declared, outage = false }) {
  return {
    packageName,
    manifest,
    dependencyType,
    declared,
    lookups: outage
      ? [
          {
            source: 'npm-packument',
            code: 'network-unreachable',
            facts: ['license', 'installSize', 'deprecated'],
          },
          {
            source: 'fast-npm-meta',
            code: 'network-unreachable',
            facts: ['stale'],
          },
        ]
      : [
          {
            source: 'npm-packument',
            code: 'timeout',
            facts: ['license', 'installSize', 'deprecated'],
          },
        ],
    affectedRules: outage
      ? ['license', 'installSize', 'stale', 'deprecated']
      : ['license', 'installSize', 'deprecated'],
  }
}

const outageNames = [
  'react',
  'react-dom',
  'zod',
  'cac',
  'ansis',
  'yaml',
  'semver',
  'tinyglobby',
  'vitest',
  'typescript',
  'tsx',
  '@changesets/cli',
]

const scenarios = {
  clean: {
    label: 'Clean checkout',
    short: '12 checked · complete',
    description: 'The fast path still proves every active rule ran.',
    checked: 12,
    manifests: [{ path: 'package.json', checked: 12 }],
    findings: [],
    unknowns: [],
  },
  failing: {
    label: 'Small failure',
    short: '3 findings · 1 unknown',
    description: 'Enough friction to test facts, limits, origin, and completeness.',
    checked: 12,
    manifests: [
      { path: 'package.json', checked: 8 },
      { path: 'apps/web/package.json', checked: 4 },
    ],
    findings: [
      finding({
        packageName: 'left-pad',
        version: '1.3.0',
        manifest: 'package.json',
        dependencyType: 'dependencies',
        declared: '^1.3.0',
        rule: 'name',
        severity: 'error',
        actual: 'denied by "left-pad"',
        expected: 'name permitted by policy',
        actualData: { matchedDeny: 'left-pad' },
        expectedData: { permitted: true },
      }),
      finding({
        packageName: 'sharp',
        version: '0.34.3',
        manifest: 'apps/web/package.json',
        dependencyType: 'dependencies',
        declared: '^0.34.0',
        rule: 'installSize',
        severity: 'error',
        actual: '9.4 MB',
        expected: '≤ 5 MB',
        actualData: { bytes: 9_400_000, display: '9.4 MB' },
        expectedData: { maxBytes: 5_000_000, display: '5 MB' },
      }),
      finding({
        packageName: 'moment',
        version: '2.30.1',
        manifest: 'package.json',
        dependencyType: 'dependencies',
        declared: '^2.30.0',
        rule: 'stale',
        severity: 'warn',
        actual: '5y 11mo',
        expected: '≤ 2y since latest publish',
        actualData: { age: '5y 11mo' },
        expectedData: { max: '2y' },
      }),
    ],
    unknowns: [
      unknown({
        packageName: '@acme/private-ui',
        manifest: 'apps/web/package.json',
        dependencyType: 'dependencies',
        declared: 'workspace:*',
      }),
    ],
  },
  legacy: {
    label: 'Legacy repository',
    short: '40 findings · 4 manifests',
    description: 'The deciding case: the report must remain useful, not merely complete.',
    checked: 91,
    manifests: [
      { path: 'package.json', checked: 24 },
      { path: 'apps/web/package.json', checked: 31 },
      { path: 'packages/design-system/package.json', checked: 22 },
      { path: 'tools/scripts/package.json', checked: 14 },
    ],
    findings: buildLegacyFindings(),
    unknowns: [],
  },
  outage: {
    label: 'Registry offline',
    short: '12 unknown · 0 findings',
    description: 'A green exit must never masquerade as a complete pass.',
    checked: 12,
    manifests: [{ path: 'package.json', checked: 12 }],
    findings: [],
    unknowns: outageNames.map((packageName, index) =>
      unknown({
        packageName,
        manifest: 'package.json',
        dependencyType: index > 7 ? 'devDependencies' : 'dependencies',
        declared: index > 7 ? '^4.0.0' : '^1.0.0',
        outage: true,
      }),
    ),
  },
}

const variants = {
  A: {
    key: 'A',
    name: 'Manifest Ledger',
    tag: 'Remediation-first',
    argument:
      'The manifest is the unit people edit, and the package is the unit they replace. Keep every fact for one package together, even when the report gets tall.',
    strengths: [
      'Matches the existing recursive scope vocabulary.',
      'One package card contains the whole remediation story.',
      'Nested JSON avoids repeating manifest and package context.',
    ],
    risk: 'Forty findings become a long document, and cross-project policy patterns are hard to see.',
    jsonTitle: 'Nested manifest contract',
    jsonNotes: [
      'Presentation and contract share the same tree.',
      'Unknowns remain a separate top-level bucket.',
      'Consumers must traverse manifests and package occurrences.',
    ],
    caption: 'Source → package → finding. Best for fixing one manifest at a time.',
  },
  B: {
    key: 'B',
    name: 'Policy Brief',
    tag: 'Pattern-first',
    argument:
      'Six rules give us a permanently bounded scoreboard. Lead with coverage and systemic patterns, then print every finding under the rule that produced it.',
    strengths: [
      'The 40-finding case reveals concentration immediately.',
      'Rule origin prints once instead of once per finding.',
      'Flat JSON is simple for CI consumers and streaming tools.',
    ],
    risk: 'A developer fixing packages must jump between rule sections when one package violates more than one rule.',
    jsonTitle: 'Flat evidence contract',
    jsonNotes: [
      'Policy verdict and evidence completeness are orthogonal.',
      'Actual and expected values stay structured, not prose.',
      'This is the recommended contract baseline.',
    ],
    caption: 'Rule scoreboard → rule tables. Best at showing why a legacy repository is red.',
  },
  C: {
    key: 'C',
    name: 'Diagnostic Stream',
    tag: 'Log-first',
    argument:
      'Treat audit findings like compiler diagnostics: deterministic, grep-friendly, narrow-terminal-safe records that can be copied into issues without reformatting.',
    strengths: [
      'Every finding survives plain logs and no-color output.',
      'Deterministic ordering makes diffs and snapshots stable.',
      'Machine codes pair naturally with human messages.',
    ],
    risk: 'Systemic patterns disappear in a flat stream, and repeated origin text is noisy.',
    jsonTitle: 'Diagnostic-code contract',
    jsonNotes: [
      'Stable codes support editor and annotation integrations.',
      'Human messages are additive, never parsed by consumers.',
      'Unknowns still live outside the findings array.',
    ],
    caption: 'One diagnostic per finding. Best for CI logs, grep, and annotations.',
  },
}

const views = [
  { key: 'terminal', label: 'Terminal' },
  { key: 'json', label: 'JSON' },
  { key: 'exit', label: 'Exit rules' },
]

const params = new URLSearchParams(window.location.search)
const state = {
  variant: variants[params.get('variant')] ? params.get('variant') : 'A',
  scenario: scenarios[params.get('scenario')] ? params.get('scenario') : 'legacy',
  view: views.some(({ key }) => key === params.get('view')) ? params.get('view') : 'terminal',
}

const elements = {
  scenarioList: document.querySelector('#scenario-list'),
  variantTitle: document.querySelector('#variant-title'),
  viewTabs: document.querySelector('#view-tabs'),
  output: document.querySelector('#output'),
  caption: document.querySelector('#caption'),
  notes: document.querySelector('#variant-notes'),
  switcherTitle: document.querySelector('#switcher-title'),
  previous: document.querySelector('#previous-variant'),
  next: document.querySelector('#next-variant'),
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function span(className, value) {
  return `<span class="${className}">${escapeHtml(value)}</span>`
}

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

function groupBy(items, keyFor) {
  const groups = new Map()
  for (const item of items) {
    const key = keyFor(item)
    const existing = groups.get(key) ?? []
    existing.push(item)
    groups.set(key, existing)
  }
  return groups
}

function summaryFor(scenario) {
  const errors = scenario.findings.filter(({ severity }) => severity === 'error').length
  const warnings = scenario.findings.filter(({ severity }) => severity === 'warn').length
  const findingPackages = new Set(
    scenario.findings.map(({ manifest, dependencyType, packageName }) =>
      [manifest, dependencyType, packageName].join('\0'),
    ),
  ).size
  const policyVerdict = errors > 0 ? 'fail' : 'pass'
  const completeness = scenario.unknowns.length > 0 ? 'partial' : 'complete'

  return {
    checked: scenario.checked,
    findings: scenario.findings.length,
    errors,
    warnings,
    findingPackages,
    unknownPackages: scenario.unknowns.length,
    policyVerdict,
    completeness,
  }
}

function verdictText(summary) {
  if (summary.policyVerdict === 'fail' && summary.completeness === 'partial') {
    return ['FAILED · INCOMPLETE', 't-error']
  }
  if (summary.policyVerdict === 'fail') return ['FAILED', 't-error']
  if (summary.completeness === 'partial') return ['INCOMPLETE', 't-unknown']
  return ['COMPLETE', 't-ok']
}

function terminalShell(content, command = 'siz check --recursive') {
  return `<div class="terminal"><div class="terminal__topline"><span class="terminal__dots">● ● ●</span><span>siz audit output prototype</span></div>${span('t-prompt', '$')} ${span('t-command', command)}
${content}</div>`
}

function summaryLine(summary) {
  const [verdict, className] = verdictText(summary)
  return `${span(className, verdict)} ${span('t-divider', '—')} ${plural(summary.errors, 'error')} ${span('t-divider', '·')} ${plural(summary.warnings, 'warning')} ${span('t-divider', '·')} ${plural(summary.unknownPackages, 'unknown package')} ${span('t-divider', '·')} ${summary.checked} checked`
}

function policyLine() {
  return `${span('t-dim', 'Policy')}  siz.config.json ${span('t-divider', '·')} 4 error ${span('t-divider', '·')} 1 warn ${span('t-divider', '·')} ${span('t-off', '1 off (provenance)')}`
}

function renderUnknownList(unknowns, indent = '') {
  if (unknowns.length === 0)
    return `${indent}${span('t-unknown', 'Unknown facts')} ${span('t-divider', '—')} none`

  const lines = [
    `${indent}${span('t-unknown', 'UNKNOWN FACTS')} ${span('t-divider', `— ${plural(unknowns.length, 'package')}`)}`,
  ]
  for (const item of unknowns) {
    const facts = item.lookups.flatMap(({ facts: lookupFacts }) => lookupFacts)
    const causes = item.lookups.map(({ source, code }) => `${source}:${code}`).join(', ')
    lines.push(
      `${indent}  ${span('t-unknown', '? UNKNOWN')} ${span('t-package', item.packageName)} ${span('t-dim', `[${facts.join(', ')}]`)}`,
      `${indent}    ${span('t-origin', `${item.manifest}:${item.dependencyType} · ${causes}`)}`,
    )
  }
  return lines.join('\n')
}

function renderTerminalA(scenario) {
  const summary = summaryFor(scenario)
  const lines = [policyLine(), '']

  if (scenario.findings.length === 0) {
    for (const manifest of scenario.manifests) {
      lines.push(
        `${span('t-ok', '✓')} ${span('t-heading', manifest.path)} ${span('t-dim', `${manifest.checked}/${manifest.checked} dependency occurrences satisfy every evaluated rule`)}`,
      )
    }
  } else {
    const byManifest = groupBy(scenario.findings, ({ manifest }) => manifest)
    for (const manifest of scenario.manifests) {
      const manifestFindings = byManifest.get(manifest.path) ?? []
      lines.push(
        `${span('t-heading', manifest.path.toUpperCase())} ${span('t-divider', '—')} ${plural(manifestFindings.length, 'finding')}`,
      )
      if (manifestFindings.length === 0) {
        lines.push(`  ${span('t-ok', '✓ clean')}`, '')
        continue
      }

      const byPackage = groupBy(manifestFindings, ({ packageName }) => packageName)
      for (const [packageName, packageFindings] of byPackage) {
        const first = packageFindings[0]
        const errorCount = packageFindings.filter(({ severity }) => severity === 'error').length
        const warningCount = packageFindings.length - errorCount
        const counts = [
          errorCount ? plural(errorCount, 'error') : '',
          warningCount ? plural(warningCount, 'warning') : '',
        ]
          .filter(Boolean)
          .join(' · ')
        lines.push(
          `  ${span('t-package', `${packageName}@${first.version}`)} ${span('t-dim', `· ${first.dependencyType} · ${counts}`)}`,
        )
        for (const item of packageFindings) {
          const marker = item.severity === 'error' ? '✗ ERROR' : '! WARN '
          const className = item.severity === 'error' ? 't-error' : 't-warn'
          lines.push(
            `    ${span(className, marker)}  ${span('t-rule', item.rule)}`,
            `      ${span('t-dim', 'found')}     ${item.actual}`,
            `      ${span('t-dim', 'expected')}  ${item.expected}`,
            `      ${span('t-dim', 'origin')}    ${span('t-origin', item.origin)}`,
          )
        }
        lines.push('')
      }
    }
  }

  lines.push(renderUnknownList(scenario.unknowns), '', summaryLine(summary))
  return terminalShell(lines.join('\n'))
}

function coverageFor(ruleName, scenario) {
  if (ruleName === 'provenance') return '—'
  if (ruleName === 'name') return `${scenario.checked}/${scenario.checked}`
  const missed = scenario.unknowns.filter(({ affectedRules }) =>
    affectedRules.includes(ruleName),
  ).length
  return `${scenario.checked - missed}/${scenario.checked}`
}

function renderRuleTable(scenario) {
  const rows = ['RULE          SEVERITY  FINDINGS  COVERAGE  ORIGIN']
  for (const rule of policyRules) {
    const count = scenario.findings.filter(({ rule: ruleName }) => ruleName === rule.name).length
    rows.push(
      `${rule.name.padEnd(13)} ${rule.severity.padEnd(9)} ${String(rule.severity === 'off' ? '—' : count).padStart(8)}  ${coverageFor(rule.name, scenario).padStart(8)}  ${rule.origin}`,
    )
  }
  return rows
    .join('\n')
    .replaceAll('error', '<span class="t-error">error</span>')
    .replaceAll('warn', '<span class="t-warn">warn</span>')
    .replaceAll('off', '<span class="t-off">off</span>')
}

function renderTerminalB(scenario) {
  const summary = summaryFor(scenario)
  const [verdict, verdictClass] = verdictText(summary)
  const lines = [
    `${span(verdictClass, verdict)}  ${span('t-dim', `policy ${summary.policyVerdict} · evidence ${summary.completeness}`)}`,
    '',
    renderRuleTable(scenario),
  ]

  const byRule = groupBy(scenario.findings, ({ rule }) => rule)
  for (const rule of policyRules.filter(({ name }) => byRule.has(name))) {
    const rows = byRule.get(rule.name)
    const severityClass = rule.severity === 'error' ? 't-error' : 't-warn'
    lines.push(
      '',
      `${span(severityClass, rule.name.toUpperCase())} ${span('t-divider', `· ${rule.severity} · ${plural(rows.length, 'finding')}`)} ${span('t-origin', rule.origin)}`,
      'PACKAGE                          FOUND                       REQUIRED                     LOCATION',
    )
    for (const item of rows) {
      const packageText = `${item.packageName}@${item.version}`.slice(0, 32).padEnd(32)
      const actual = item.actual.slice(0, 27).padEnd(27)
      const expected = item.expected.slice(0, 27).padEnd(27)
      lines.push(
        `${span('t-package', packageText)} ${actual} ${expected} ${span('t-origin', `${item.manifest}:${item.dependencyType}`)}`,
      )
    }
  }

  lines.push('', renderUnknownList(scenario.unknowns), '', summaryLine(summary))
  return terminalShell(lines.join('\n'))
}

function renderTerminalC(scenario) {
  const summary = summaryFor(scenario)
  const lines = [policyLine(), '']
  const ordered = scenario.findings.toSorted((left, right) => {
    const severity = left.severity === right.severity ? 0 : left.severity === 'error' ? -1 : 1
    return (
      severity ||
      left.manifest.localeCompare(right.manifest) ||
      left.packageName.localeCompare(right.packageName) ||
      left.rule.localeCompare(right.rule)
    )
  })

  if (ordered.length === 0) {
    lines.push(
      `${span('t-ok', '✓ NO FINDINGS')} ${span('t-dim', `${scenario.checked} dependency occurrences evaluated`)}`,
    )
  } else {
    for (const item of ordered) {
      const marker = item.severity === 'error' ? '✗ ERROR' : '! WARN '
      const className = item.severity === 'error' ? 't-error' : 't-warn'
      lines.push(
        `${span(className, marker)} ${span('t-origin', `${item.manifest}:${item.dependencyType}`)} ${span('t-package', `${item.packageName}@${item.version}`)} ${span('t-rule', `[${item.rule}]`)}`,
        `  found ${item.actual}; expected ${item.expected}`,
        `  policy ${span('t-origin', item.origin)}`,
        '',
      )
    }
  }

  lines.push(
    renderUnknownList(scenario.unknowns),
    '',
    summaryLine(summary),
    `${span('t-off', '○ OFF')} provenance`,
  )
  return terminalShell(lines.join('\n'))
}

function ruleContract() {
  return policyRules.map(({ name, severity, origin }) => ({
    name,
    severity,
    origin: {
      path: 'siz.config.json',
      pointer: origin.slice(origin.indexOf('#') + 1),
    },
  }))
}

function findingContract(item, includeLocation = true) {
  return {
    rule: item.rule,
    severity: item.severity,
    package: { name: item.packageName, version: item.version },
    ...(includeLocation
      ? {
          location: {
            manifest: item.manifest,
            dependencyType: item.dependencyType,
            declared: item.declared,
          },
        }
      : {}),
    actual: item.actualData,
    expected: item.expectedData,
    ruleOrigin: {
      path: 'siz.config.json',
      pointer: `/rules/${item.rule}`,
    },
  }
}

function unknownContract(item) {
  return {
    package: { name: item.packageName },
    location: {
      manifest: item.manifest,
      dependencyType: item.dependencyType,
      declared: item.declared,
    },
    lookups: item.lookups,
    affectedRules: item.affectedRules,
  }
}

function defaultExitCode(variantKey, scenario) {
  const summary = summaryFor(scenario)
  if (variantKey === 'A') return 0
  return summary.errors > 0 ? 1 : 0
}

function baseContract(scenario, variantKey) {
  const summary = summaryFor(scenario)
  return {
    schemaVersion: 1,
    policy: {
      path: 'siz.config.json',
      rules: ruleContract(),
    },
    summary: {
      checked: summary.checked,
      findings: {
        total: summary.findings,
        error: summary.errors,
        warn: summary.warnings,
        packageOccurrences: summary.findingPackages,
      },
      unknown: {
        packages: summary.unknownPackages,
        factChecks: scenario.unknowns.reduce(
          (count, item) =>
            count + item.lookups.reduce((sum, lookup) => sum + lookup.facts.length, 0),
          0,
        ),
      },
      policyVerdict: summary.policyVerdict,
      completeness: summary.completeness,
    },
    exitCode: defaultExitCode(variantKey, scenario),
  }
}

function jsonContractA(scenario) {
  const base = baseContract(scenario, 'A')
  const manifests = scenario.manifests.map(({ path }) => {
    const rows = scenario.findings.filter(({ manifest }) => manifest === path)
    const byPackage = groupBy(
      rows,
      ({ packageName, dependencyType }) => `${packageName}\0${dependencyType}`,
    )
    return {
      path,
      packages: [...byPackage.values()].map((items) => ({
        name: items[0].packageName,
        version: items[0].version,
        dependencyType: items[0].dependencyType,
        declared: items[0].declared,
        findings: items.map((item) => findingContract(item, false)),
      })),
    }
  })
  return {
    schemaVersion: base.schemaVersion,
    policy: base.policy,
    manifests,
    unknowns: scenario.unknowns.map(unknownContract),
    summary: base.summary,
    options: { exitCode: false, failOnUnknown: false },
    exitCode: base.exitCode,
  }
}

function jsonContractB(scenario) {
  const base = baseContract(scenario, 'B')
  return {
    schemaVersion: base.schemaVersion,
    policy: base.policy,
    findings: scenario.findings.map((item) => findingContract(item)),
    unknowns: scenario.unknowns.map(unknownContract),
    summary: base.summary,
    options: { failOnUnknown: false },
    exitCode: base.exitCode,
  }
}

function jsonContractC(scenario) {
  const base = baseContract(scenario, 'C')
  return {
    schemaVersion: base.schemaVersion,
    diagnostics: scenario.findings.map((item) => ({
      code: `policy.${item.rule}`,
      severity: item.severity,
      message: `${item.packageName} has ${item.actual}; expected ${item.expected}`,
      path: item.manifest,
      package: { name: item.packageName, version: item.version },
      dependencyType: item.dependencyType,
      data: {
        actual: item.actualData,
        expected: item.expectedData,
        ruleOrigin: `/rules/${item.rule}`,
      },
    })),
    unknowns: scenario.unknowns.map(unknownContract),
    summary: base.summary,
    options: { requireComplete: false },
    exitCode: base.exitCode,
  }
}

function syntaxHighlightJson(value) {
  return escapeHtml(JSON.stringify(value, null, 2)).replace(
    /(&quot;(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\&])*&quot;)(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (match, quoted, keySuffix, bool) => {
      if (quoted) {
        return keySuffix
          ? `<span class="json-key">${quoted}</span>${keySuffix}`
          : `<span class="json-string">${quoted}</span>`
      }
      if (bool) return `<span class="json-bool">${match}</span>`
      return `<span class="json-number">${match}</span>`
    },
  )
}

function renderJson(variant, scenario) {
  const contract =
    variant.key === 'A'
      ? jsonContractA(scenario)
      : variant.key === 'B'
        ? jsonContractB(scenario)
        : jsonContractC(scenario)
  return `<div class="json-contract"><pre>${syntaxHighlightJson(contract)}</pre><aside class="json-contract__notes"><h3>${escapeHtml(variant.jsonTitle)}</h3><p>Rendered with every record for the selected scenario. No truncation is hidden in this preview.</p><ul>${variant.jsonNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul></aside></div>`
}

const exitPolicies = {
  A: {
    name: 'Report by default',
    lede: 'Mirrors `siz outdated`: policy errors are visible but only become a gate with `--exit-code`.',
    flag: '--exit-code + --fail-on-unknown',
    rows: [
      ['Clean or warnings only', 'siz check', '0'],
      ['Error finding', 'siz check', '0'],
      ['Error finding', 'siz check --exit-code', '1'],
      ['Unknown facts', 'siz check', '0 · incomplete'],
      ['Unknown facts', 'siz check --fail-on-unknown', '1'],
      ['Invalid policy / fatal command error', 'siz check', '1'],
    ],
  },
  B: {
    name: 'Configured errors are already opt-in',
    lede: 'An error-level rule fails by default; warnings and unknown evidence stay green unless completeness is explicitly required.',
    flag: '--fail-on-unknown',
    rows: [
      ['Clean or warnings only', 'siz check', '0'],
      ['Error finding', 'siz check', '1'],
      ['Unknown facts', 'siz check', '0 · incomplete'],
      ['Unknown facts', 'siz check --fail-on-unknown', '1'],
      ['Error + unknown facts', 'either form', '1'],
      ['Invalid policy / fatal command error', 'siz check', '2'],
    ],
  },
  C: {
    name: 'Typed automation exits',
    lede: 'Policy failure, incomplete evidence, and command failure each receive a distinct code for shell consumers.',
    flag: '--require-complete',
    rows: [
      ['Clean or warnings only', 'siz check', '0'],
      ['Error finding', 'siz check', '1'],
      ['Unknown facts', 'siz check', '0 · incomplete'],
      ['Unknown facts', 'siz check --require-complete', '2'],
      ['Error + unknown facts', 'either form', '1'],
      ['Invalid policy / fatal command error', 'siz check', '3'],
    ],
  },
}

function renderExit(variant, scenario) {
  const policy = exitPolicies[variant.key]
  const code = defaultExitCode(variant.key, scenario)
  const summary = summaryFor(scenario)
  const [verdict] = verdictText(summary)
  const codeClass = code === 0 ? 't-ok' : 't-error'
  return `<div class="exit-matrix"><div class="exit-lede"><div class="exit-code ${codeClass}">${code}</div><div><h3>${escapeHtml(policy.name)}</h3><p>${escapeHtml(policy.lede)}</p><p><span class="t-dim">Selected scenario:</span> <strong class="${codeClass}">${escapeHtml(verdict)}</strong> · default exit ${code}</p></div></div><table class="exit-table"><thead><tr><th>Condition</th><th>Invocation</th><th>Exit</th></tr></thead><tbody>${policy.rows.map(([condition, command, exit]) => `<tr><td>${escapeHtml(condition)}</td><td>${escapeHtml(command)}</td><td>${escapeHtml(exit)}</td></tr>`).join('')}</tbody></table><p><span class="t-dim">Unknown escalation spelling under test:</span> <span class="t-rule">${escapeHtml(policy.flag)}</span></p></div>`
}

function renderScenarios() {
  elements.scenarioList.innerHTML = Object.entries(scenarios)
    .map(
      ([key, scenario], index) =>
        `<button class="scenario-button" type="button" data-scenario="${key}" aria-pressed="${state.scenario === key}"><span class="scenario-button__index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(scenario.label)}</strong><small>${escapeHtml(scenario.short)}</small></span></button>`,
    )
    .join('')
}

function renderViews() {
  elements.viewTabs.innerHTML = views
    .map(
      ({ key, label }) =>
        `<button type="button" data-view="${key}" aria-pressed="${state.view === key}">${escapeHtml(label)}</button>`,
    )
    .join('')
}

function renderNotes(variant) {
  elements.notes.innerHTML = `<div class="variant-argument"><span class="variant-argument__tag">${escapeHtml(variant.tag)}</span><p>${escapeHtml(variant.argument)}</p><ul>${variant.strengths.map((strength) => `<li>${escapeHtml(strength)}</li>`).join('')}</ul><p><strong>Failure mode:</strong> ${escapeHtml(variant.risk)}</p></div>`
}

function syncUrl() {
  const next = new URLSearchParams(window.location.search)
  next.set('variant', state.variant)
  next.set('scenario', state.scenario)
  next.set('view', state.view)
  window.history.replaceState(null, '', `${window.location.pathname}?${next}`)
}

function render() {
  const variant = variants[state.variant]
  const scenario = scenarios[state.scenario]
  document.body.dataset.variant = state.variant
  elements.variantTitle.textContent = `${variant.key} — ${variant.name}`
  elements.switcherTitle.textContent = `${variant.key} — ${variant.name}`
  renderScenarios()
  renderViews()
  renderNotes(variant)

  if (state.view === 'terminal') {
    elements.output.innerHTML =
      state.variant === 'A'
        ? renderTerminalA(scenario)
        : state.variant === 'B'
          ? renderTerminalB(scenario)
          : renderTerminalC(scenario)
  } else if (state.view === 'json') {
    elements.output.innerHTML = renderJson(variant, scenario)
  } else {
    elements.output.innerHTML = renderExit(variant, scenario)
  }

  elements.caption.innerHTML = `<span><strong>${escapeHtml(scenario.label)}:</strong> ${escapeHtml(scenario.description)}</span><span>${escapeHtml(variant.caption)}</span>`
  syncUrl()
}

function cycleVariant(direction) {
  const keys = Object.keys(variants)
  const current = keys.indexOf(state.variant)
  state.variant = keys[(current + direction + keys.length) % keys.length]
  render()
}

elements.scenarioList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-scenario]')
  if (!button) return
  state.scenario = button.dataset.scenario
  render()
})

elements.viewTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]')
  if (!button) return
  state.view = button.dataset.view
  render()
})

elements.previous.addEventListener('click', () => cycleVariant(-1))
elements.next.addEventListener('click', () => cycleVariant(1))

window.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea, [contenteditable]')) return
  if (event.key === 'ArrowLeft') cycleVariant(-1)
  if (event.key === 'ArrowRight') cycleVariant(1)
})

render()
