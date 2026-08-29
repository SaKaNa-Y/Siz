const variants = [
  {
    key: 'A',
    name: 'Inline Signals',
    mode: 'ANNOTATE',
    thesis:
      'Keep the existing multiselect intact. Put the target verdict on every row and ask once at confirmation.',
    win: 'Minimal workflow change; every target remains reachable, including a security patch.',
    risk: 'An error becomes one more badge in a dense list. Repeated confirmation trains click-through.',
  },
  {
    key: 'B',
    name: 'Severity Gate',
    mode: 'REFUSE',
    thesis:
      'Let committed severity shape the affordance: pass and warn are selectable, unknown needs review, error is blocked.',
    win: 'The interface and the project policy say the same thing. A disabled row cannot be mistaken for advice.',
    risk: 'A policy error can hold back a security patch until the policy or a deliberate bypass changes.',
  },
  {
    key: 'C',
    name: 'Evidence Review',
    mode: 'EXPLICIT OVERRIDE',
    thesis:
      'Move policy crossings into a focused evidence step. A one-run override is a separate, package-specific act.',
    win: 'The user sees the fact transition before authorizing a mutation; no global bypass is required.',
    risk: 'Adds a second decision loop to a command whose current strength is a fast multiselect.',
  },
]

const entries = {
  licenseFlip: {
    id: 'licenseFlip',
    name: 'image-pipeline',
    scope: 'packages/api',
    depType: 'dependencies',
    current: '2.4.0',
    target: '3.0.0',
    proposed: '^3.0.0',
    diff: 'major',
    currentVerdict: { kind: 'pass', label: 'passes policy' },
    targetVerdict: {
      kind: 'error',
      label: 'license error',
      facts: [
        {
          rule: 'license',
          severity: 'error',
          actual: 'GPL-3.0-only',
          expected: 'MIT OR Apache-2.0',
        },
      ],
    },
    story: 'The current version is compliant; the target changes the declared license.',
  },
  deprecatedBoth: {
    id: 'deprecatedBoth',
    name: 'legacy-codec',
    scope: 'packages/media',
    depType: 'dependencies',
    current: '1.8.4',
    target: '1.9.0',
    proposed: '^1.9.0',
    diff: 'minor',
    currentVerdict: { kind: 'error', label: 'deprecated' },
    targetVerdict: {
      kind: 'error',
      label: 'still deprecated',
      facts: [
        {
          rule: 'deprecated',
          severity: 'error',
          actual: 'Deprecated: use modern-codec',
          expected: 'not deprecated',
        },
      ],
    },
    story: 'Both versions violate. The target changes the version but does not clear the finding.',
  },
  baselineNoWorse: {
    id: 'baselineNoWorse',
    name: 'sharp',
    scope: 'packages/images',
    depType: 'dependencies',
    current: '0.32.6',
    target: '0.33.5',
    proposed: '^0.33.5',
    diff: 'minor',
    currentVerdict: { kind: 'accepted', label: 'accepted error debt' },
    targetVerdict: {
      kind: 'error',
      label: 'size error · no worse',
      facts: [
        {
          rule: 'installSize',
          severity: 'error',
          actual: '8.8 MB',
          expected: '≤ 5 MB',
        },
      ],
    },
    baseline: {
      accepted: '9.4 MB',
      target: '8.8 MB',
      direction: 'no worse',
      note: 'Audit would keep this debt accepted. The baseline does not authorize an upgrade.',
    },
    story: 'Accepted current debt improves, but the target still violates committed policy.',
  },
  baselineWorse: {
    id: 'baselineWorse',
    name: 'native-image',
    scope: 'packages/images',
    depType: 'optionalDependencies',
    current: '4.2.0',
    target: '5.0.0',
    proposed: '^5.0.0',
    diff: 'major',
    currentVerdict: { kind: 'accepted', label: 'accepted error debt' },
    targetVerdict: {
      kind: 'error',
      label: 'size error · worse',
      facts: [
        {
          rule: 'installSize',
          severity: 'error',
          actual: '11.1 MB',
          expected: '≤ 5 MB',
        },
      ],
    },
    baseline: {
      accepted: '7.2 MB',
      target: '11.1 MB',
      direction: 'worse',
      note: 'Audit would reactivate this finding. Upgrade must not inherit the old acceptance.',
    },
    story: 'Accepted current debt becomes materially worse under the rule-specific comparator.',
  },
  warning: {
    id: 'warning',
    name: 'ui-compat',
    scope: 'packages/web',
    depType: 'devDependencies',
    current: '6.1.0',
    target: '6.2.1',
    proposed: '^6.2.1',
    diff: 'minor',
    currentVerdict: { kind: 'pass', label: 'passes policy' },
    targetVerdict: {
      kind: 'warn',
      label: 'provenance warning',
      facts: [
        {
          rule: 'provenance',
          severity: 'warn',
          actual: 'no attestation',
          expected: 'attestation present',
        },
      ],
    },
    story: 'The target lacks provenance, but the repository configured this rule as warn.',
  },
  unknown: {
    id: 'unknown',
    name: 'private-addon',
    scope: 'packages/desktop',
    depType: 'dependencies',
    current: '3.1.4',
    target: '3.2.0',
    proposed: '^3.2.0',
    diff: 'minor',
    currentVerdict: { kind: 'pass', label: 'passes known policy' },
    targetVerdict: {
      kind: 'unknown',
      label: 'target facts unavailable',
      unknowns: ['license', 'installSize', 'deprecated', 'provenance'],
      reason: 'registry timeout',
    },
    story: 'The exact target manifest did not resolve. Unknown is not a policy finding.',
  },
  safe: {
    id: 'safe',
    name: 'zod',
    scope: 'packages/api',
    depType: 'dependencies',
    current: '4.0.5',
    target: '4.1.5',
    proposed: '^4.1.5',
    diff: 'minor',
    currentVerdict: { kind: 'pass', label: 'passes policy' },
    targetVerdict: { kind: 'pass', label: 'passes policy', facts: [] },
    story: 'All configured target facts resolved and passed.',
  },
}

const scenarios = [
  {
    key: 'mixed',
    name: 'Mixed queue',
    short: '7 targets · every verdict',
    description:
      'A realistic monorepo queue: pass, warn, error, accepted debt, and unknown evidence.',
    itemIds: [
      'safe',
      'warning',
      'licenseFlip',
      'deprecatedBoth',
      'baselineNoWorse',
      'baselineWorse',
      'unknown',
    ],
  },
  {
    key: 'transition',
    name: 'Clean → error',
    short: '2 targets · authority boundary',
    description: 'Can a compliant current version move to a target rejected by committed policy?',
    itemIds: ['safe', 'licenseFlip'],
  },
  {
    key: 'baseline',
    name: 'Accepted debt',
    short: '2 targets · no worse vs worse',
    description:
      'The baseline explains current debt but is not permission to install another version.',
    itemIds: ['baselineNoWorse', 'baselineWorse'],
  },
  {
    key: 'network',
    name: 'Registry gap',
    short: '2 targets · partial evidence',
    description: 'One target resolves completely; the other has no exact-version facts.',
    itemIds: ['safe', 'unknown'],
  },
]

const outdatedRows = [
  {
    name: 'react',
    current: '18.2.0',
    wanted: '18.3.1',
    latest: '19.1.1',
    wantedPolicy: { kind: 'pass', label: 'wanted passes' },
    latestPolicy: { kind: 'pass', label: 'latest passes' },
  },
  {
    name: 'image-pipeline',
    current: '2.4.0',
    wanted: '2.4.4',
    latest: '3.0.0',
    wantedPolicy: { kind: 'pass', label: 'wanted passes' },
    latestPolicy: { kind: 'error', label: 'license · error', detail: 'GPL-3.0-only' },
  },
  {
    name: 'ui-compat',
    current: '6.1.0',
    wanted: '6.2.1',
    latest: '7.0.0',
    wantedPolicy: { kind: 'pass', label: 'wanted passes' },
    latestPolicy: { kind: 'warn', label: 'provenance · warn', detail: 'no attestation' },
  },
  {
    name: 'private-addon',
    current: '3.1.4',
    wanted: '3.2.0',
    latest: '4.0.0',
    wantedPolicy: {
      kind: 'unknown',
      label: 'wanted facts unknown',
      detail: 'registry request timed out',
    },
    latestPolicy: {
      kind: 'unknown',
      label: 'latest facts unknown',
      detail: 'license, installSize, deprecated, provenance',
    },
  },
]

const outdatedCandidates = outdatedRows.flatMap((row) => [
  {
    name: row.name,
    target: 'WANTED',
    version: row.wanted,
    policy: row.wantedPolicy,
  },
  {
    name: row.name,
    target: 'LATEST',
    version: row.latest,
    policy: row.latestPolicy,
  },
])

const views = [
  { key: 'upgrade', name: 'Upgrade prompt' },
  { key: 'outdated', name: 'Outdated report' },
  { key: 'fetch', name: 'Facts contract' },
]

const params = new URLSearchParams(window.location.search)
let currentVariant =
  variants.find((variant) => variant.key === params.get('variant')) ?? variants[0]
let currentView = views.find((view) => view.key === params.get('view')) ?? views[0]
let currentScenario =
  scenarios.find((scenario) => scenario.key === params.get('scenario')) ?? scenarios[0]
let selected = new Set()
let overrides = new Set()
let acknowledgements = new Set()
let focusedId = currentScenario.itemIds[0]
let confirmationOpen = false

const scenarioList = document.querySelector('#scenario-list')
const viewTabs = document.querySelector('#view-tabs')
const terminal = document.querySelector('#terminal')
const variantHeading = document.querySelector('#variant-heading')
const variantNotes = document.querySelector('#variant-notes')
const switcherTitle = document.querySelector('#switcher-title')
const stateStrip = document.querySelector('#state-strip')

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function updateUrl() {
  const next = new URL(window.location.href)
  next.searchParams.set('variant', currentVariant.key)
  next.searchParams.set('view', currentView.key)
  next.searchParams.set('scenario', currentScenario.key)
  window.history.replaceState({}, '', next)
}

function scenarioItems() {
  return currentScenario.itemIds.map((id) => entries[id])
}

function verdictClass(kind) {
  return 'verdict verdict--' + kind
}

function verdictMark(kind) {
  return { pass: '✓', warn: '!', error: '×', unknown: '?', accepted: '≈' }[kind] ?? '·'
}

function verdictBadge(verdict) {
  return (
    '<span class="' +
    verdictClass(verdict.kind) +
    '"><b>' +
    verdictMark(verdict.kind) +
    '</b> ' +
    escapeHtml(verdict.label) +
    '</span>'
  )
}

function resetInteraction() {
  selected = new Set()
  overrides = new Set()
  acknowledgements = new Set()
  focusedId = currentScenario.itemIds[0]
  confirmationOpen = false

  for (const item of scenarioItems()) {
    const kind = item.targetVerdict.kind
    if (currentVariant.key === 'A') selected.add(item.id)
    if (currentVariant.key === 'B' && (kind === 'pass' || kind === 'warn')) selected.add(item.id)
    if (currentVariant.key === 'C' && (kind === 'pass' || kind === 'warn')) selected.add(item.id)
  }
}

function renderScenarioList() {
  scenarioList.innerHTML = scenarios
    .map(
      (scenario, index) =>
        '<button class="scenario-button ' +
        (scenario.key === currentScenario.key ? 'is-active' : '') +
        '" type="button" data-scenario="' +
        scenario.key +
        '">' +
        '<span class="scenario-number">' +
        String(index + 1).padStart(2, '0') +
        '</span>' +
        '<span><strong>' +
        escapeHtml(scenario.name) +
        '</strong><small>' +
        escapeHtml(scenario.short) +
        '</small></span>' +
        '</button>',
    )
    .join('')
}

function renderViewTabs() {
  viewTabs.innerHTML = views
    .map(
      (view) =>
        '<button type="button" class="' +
        (view.key === currentView.key ? 'is-active' : '') +
        '" data-view="' +
        view.key +
        '">' +
        escapeHtml(view.name) +
        '</button>',
    )
    .join('')
}

function renderVariantNotes() {
  variantNotes.innerHTML =
    '<div class="mode-label">' +
    escapeHtml(currentVariant.mode) +
    '</div>' +
    '<p class="variant-thesis">' +
    escapeHtml(currentVariant.thesis) +
    '</p>' +
    '<dl>' +
    '<div><dt>What it protects</dt><dd>' +
    escapeHtml(currentVariant.win) +
    '</dd></div>' +
    '<div><dt>Failure mode</dt><dd>' +
    escapeHtml(currentVariant.risk) +
    '</dd></div>' +
    '</dl>'
}

function rowMeta(item) {
  return (
    '<span class="row-scope">' +
    escapeHtml(item.scope) +
    '</span>' +
    '<span class="row-dep">' +
    escapeHtml(
      item.depType === 'devDependencies'
        ? 'dev'
        : item.depType === 'optionalDependencies'
          ? 'optional'
          : 'prod',
    ) +
    '</span>'
  )
}

function versionDelta(item) {
  return (
    '<span class="version-current" title="Declared range floor, not installed version">' +
    escapeHtml(item.current) +
    '</span><span class="arrow">→</span><strong class="version-target">' +
    escapeHtml(item.target) +
    '</strong><span class="write-range">writes ' +
    escapeHtml(item.proposed) +
    '</span><span class="diff">' +
    escapeHtml(item.diff) +
    '</span>'
  )
}

function baselineNote(item) {
  if (!item.baseline) return ''
  return (
    '<div class="baseline-note baseline-note--' +
    (item.baseline.direction === 'worse' ? 'worse' : 'steady') +
    '"><span>BASELINE CONTEXT</span><strong>' +
    escapeHtml(item.baseline.accepted) +
    ' → ' +
    escapeHtml(item.baseline.target) +
    ' · ' +
    escapeHtml(item.baseline.direction) +
    '</strong><small>' +
    escapeHtml(item.baseline.note) +
    '</small></div>'
  )
}

function evidenceList(item) {
  const verdict = item.targetVerdict
  if (verdict.kind === 'unknown') {
    return (
      '<div class="evidence-line evidence-line--unknown"><span>Unavailable</span><strong>' +
      escapeHtml(verdict.unknowns.join(', ')) +
      '</strong><small>' +
      escapeHtml(verdict.reason) +
      '</small></div>'
    )
  }
  if (!verdict.facts || verdict.facts.length === 0) {
    return '<div class="evidence-line evidence-line--pass"><span>Configured rules</span><strong>all evaluated</strong><small>complete evidence</small></div>'
  }
  return verdict.facts
    .map(
      (fact) =>
        '<div class="evidence-line evidence-line--' +
        fact.severity +
        '"><span>' +
        escapeHtml(fact.rule) +
        '</span><strong>' +
        escapeHtml(fact.actual) +
        '</strong><small>required ' +
        escapeHtml(fact.expected) +
        '</small></div>',
    )
    .join('')
}

function checkbox(item, disabled) {
  const isSelected = selected.has(item.id)
  return (
    '<button class="check ' +
    (isSelected ? 'is-checked' : '') +
    '" type="button" data-action="toggle" data-id="' +
    item.id +
    '"' +
    (disabled ? ' disabled aria-disabled="true"' : '') +
    ' aria-label="' +
    (isSelected ? 'Deselect ' : 'Select ') +
    escapeHtml(item.name) +
    '"><span>' +
    (isSelected ? '✓' : '') +
    '</span></button>'
  )
}

function terminalHeader(command, subtitle) {
  return (
    '<div class="terminal-chrome"><div class="terminal-lights"><span></span><span></span><span></span></div>' +
    '<code>' +
    escapeHtml(command) +
    '</code><small>' +
    escapeHtml(subtitle) +
    '</small></div>'
  )
}

function continueButton(copy) {
  return (
    '<button type="button" class="continue-button" data-action="continue">' +
    escapeHtml(copy) +
    '<span>→</span></button>'
  )
}

function renderConfirmation(modelCopy) {
  if (!confirmationOpen) return ''
  const chosen = scenarioItems().filter((item) => selected.has(item.id))
  const errors = chosen.filter((item) => item.targetVerdict.kind === 'error')
  const unknowns = chosen.filter((item) => item.targetVerdict.kind === 'unknown')
  return (
    '<div class="confirmation">' +
    '<div><p class="terminal-kicker">SIMULATED CONFIRMATION</p><h3>' +
    chosen.length +
    ' targets selected</h3><p>' +
    escapeHtml(modelCopy) +
    '</p></div>' +
    '<div class="confirmation-counts">' +
    '<span><b>' +
    errors.length +
    '</b> error targets</span><span><b>' +
    unknowns.length +
    '</b> unknown targets</span><span><b>' +
    overrides.size +
    '</b> explicit overrides</span></div>' +
    '<button type="button" data-action="close-confirm">Back to review</button>' +
    '</div>'
  )
}

function renderInlineSignals() {
  const selectedErrors = scenarioItems().filter(
    (item) => selected.has(item.id) && item.targetVerdict.kind === 'error',
  ).length
  const rows = scenarioItems()
    .map(
      (item) =>
        '<article class="upgrade-row upgrade-row--inline ' +
        (selected.has(item.id) ? 'is-selected' : '') +
        '">' +
        checkbox(item, false) +
        '<div class="package-cell"><div><strong>' +
        escapeHtml(item.name) +
        '</strong>' +
        rowMeta(item) +
        '</div><div class="version-line">' +
        versionDelta(item) +
        '</div></div>' +
        '<div class="inline-verdict">' +
        verdictBadge(item.targetVerdict) +
        '<small>' +
        escapeHtml(item.story) +
        '</small></div>' +
        baselineNote(item) +
        '</article>',
    )
    .join('')

  return (
    terminalHeader(
      'siz upgrade major',
      'Variant A · exact target verdicts · Current is range floor',
    ) +
    '<div class="terminal-body">' +
    '<div class="prompt-line"><span>◆</span><strong>Select packages to upgrade</strong><small>all targets remain selectable</small></div>' +
    '<div class="inline-list">' +
    rows +
    '</div>' +
    '<div class="terminal-footer"><p><span class="verdict verdict--error"><b>×</b> ' +
    selectedErrors +
    ' selected error' +
    (selectedErrors === 1 ? '' : 's') +
    '</span> ' +
    (selectedErrors === 1 ? 'remains' : 'remain') +
    ' actionable in this model.</p>' +
    continueButton('Review selected targets') +
    '</div>' +
    renderConfirmation(
      'Inline Signals warns at the last moment. It does not turn an error-level rule into a refusal.',
    ) +
    '</div>'
  )
}

function renderGateGroup(title, copy, items, kind) {
  if (items.length === 0) return ''
  return (
    '<section class="gate-group gate-group--' +
    kind +
    '"><header><span>' +
    escapeHtml(title) +
    '</span><small>' +
    escapeHtml(copy) +
    '</small><b>' +
    items.length +
    '</b></header><div>' +
    items
      .map((item) => {
        const blocked = kind === 'blocked'
        return (
          '<article class="upgrade-row upgrade-row--gate ' +
          (selected.has(item.id) ? 'is-selected' : '') +
          '">' +
          checkbox(item, blocked) +
          '<div class="package-cell"><div><strong>' +
          escapeHtml(item.name) +
          '</strong>' +
          rowMeta(item) +
          '</div><div class="version-line">' +
          versionDelta(item) +
          '</div></div>' +
          '<div class="gate-verdict">' +
          verdictBadge(item.targetVerdict) +
          (blocked
            ? '<small>Change policy, add a reasoned exception, or rerun with an explicit bypass.</small>'
            : item.targetVerdict.kind === 'unknown'
              ? '<small>Unchecked by default. Selecting it makes missing evidence explicit at confirmation.</small>'
              : '<small>' + escapeHtml(item.story) + '</small>') +
          '</div>' +
          baselineNote(item) +
          '</article>'
        )
      })
      .join('') +
    '</div></section>'
  )
}

function renderSeverityGate() {
  const items = scenarioItems()
  const ready = items.filter(
    (item) => item.targetVerdict.kind === 'pass' || item.targetVerdict.kind === 'warn',
  )
  const review = items.filter((item) => item.targetVerdict.kind === 'unknown')
  const blocked = items.filter((item) => item.targetVerdict.kind === 'error')

  return (
    terminalHeader('siz upgrade major', 'Variant B · severity gates the exact resolved target') +
    '<div class="terminal-body terminal-body--gate">' +
    '<div class="gate-summary"><div><span>READY</span><strong>' +
    ready.length +
    '</strong></div><div><span>REVIEW</span><strong>' +
    review.length +
    '</strong></div><div><span>BLOCKED</span><strong>' +
    blocked.length +
    '</strong></div></div>' +
    renderGateGroup('READY', 'Pass and warn targets may be selected.', ready, 'ready') +
    renderGateGroup(
      'NEEDS REVIEW',
      'Unknown evidence is not a finding, and never stays silent.',
      review,
      'review',
    ) +
    renderGateGroup(
      'BLOCKED BY POLICY',
      'Error severity refuses the target in the normal flow.',
      blocked,
      'blocked',
    ) +
    '<div class="terminal-footer"><p>Blocked rows never enter the install confirmation.</p>' +
    continueButton('Continue with permitted targets') +
    '</div>' +
    renderConfirmation(
      'Severity Gate contains only permitted or explicitly selected unknown targets. Error targets are absent.',
    ) +
    '</div>'
  )
}

function canSelectInReview(item) {
  if (item.targetVerdict.kind === 'error') return overrides.has(item.id)
  if (item.targetVerdict.kind === 'unknown') return acknowledgements.has(item.id)
  return true
}

function renderReviewQueueItem(item) {
  const focused = item.id === focusedId
  const locked = !canSelectInReview(item)
  return (
    '<button type="button" class="review-queue-item ' +
    (focused ? 'is-focused' : '') +
    '" data-action="focus" data-id="' +
    item.id +
    '"><span class="' +
    verdictClass(item.targetVerdict.kind) +
    '"><b>' +
    verdictMark(item.targetVerdict.kind) +
    '</b></span><span><strong>' +
    escapeHtml(item.name) +
    '</strong><small>' +
    escapeHtml(item.current) +
    ' → ' +
    escapeHtml(item.target) +
    '</small></span><em>' +
    (selected.has(item.id) ? 'selected' : locked ? 'review' : 'ready') +
    '</em></button>'
  )
}

function renderEvidenceInspector(item) {
  const kind = item.targetVerdict.kind
  const unlocked = canSelectInReview(item)
  let action = ''
  if (kind === 'error' && !overrides.has(item.id)) {
    action =
      '<button type="button" class="evidence-action evidence-action--error" data-action="override" data-id="' +
      item.id +
      '">Allow this target once</button>'
  } else if (kind === 'unknown' && !acknowledgements.has(item.id)) {
    action =
      '<button type="button" class="evidence-action evidence-action--unknown" data-action="ack" data-id="' +
      item.id +
      '">Acknowledge missing evidence</button>'
  } else {
    action =
      '<button type="button" class="evidence-action evidence-action--select" data-action="toggle" data-id="' +
      item.id +
      '">' +
      (selected.has(item.id) ? 'Remove from upgrade' : 'Add to upgrade') +
      '</button>'
  }

  return (
    '<article class="evidence-inspector">' +
    '<header><div><p class="terminal-kicker">TARGET REVIEW</p><h3>' +
    escapeHtml(item.name) +
    '</h3></div>' +
    verdictBadge(item.targetVerdict) +
    '</header>' +
    '<div class="version-comparison"><div><span>CURRENT</span><strong>' +
    escapeHtml(item.current) +
    '</strong>' +
    verdictBadge(item.currentVerdict) +
    '</div><div class="comparison-arrow">→</div><div><span>TARGET</span><strong>' +
    escapeHtml(item.target) +
    '</strong>' +
    verdictBadge(item.targetVerdict) +
    '</div></div>' +
    '<div class="evidence-stack">' +
    evidenceList(item) +
    '</div>' +
    baselineNote(item) +
    '<p class="inspector-story">' +
    escapeHtml(item.story) +
    '</p>' +
    action +
    (unlocked && (kind === 'error' || kind === 'unknown')
      ? '<p class="override-receipt">' +
        (kind === 'error'
          ? 'One-run policy override recorded for this target.'
          : 'Missing evidence acknowledged for this target.') +
        '</p>'
      : '') +
    '</article>'
  )
}

function renderEvidenceReview() {
  const items = scenarioItems()
  const focused = entries[focusedId] ?? items[0]
  return (
    terminalHeader('siz upgrade major', 'Variant C · exact target-by-target evidence review') +
    '<div class="terminal-body terminal-body--review">' +
    '<div class="review-layout"><div class="review-queue"><div class="review-queue__head"><span>QUEUE</span><small>' +
    items.length +
    ' targets</small></div>' +
    items.map(renderReviewQueueItem).join('') +
    '</div>' +
    renderEvidenceInspector(focused) +
    '</div>' +
    '<div class="terminal-footer"><p>' +
    selected.size +
    ' selected · ' +
    overrides.size +
    ' overrides · ' +
    acknowledgements.size +
    ' unknown acknowledgements</p>' +
    continueButton('Review authorization receipt') +
    '</div>' +
    renderConfirmation(
      'Evidence Review records each exceptional choice separately so the final mutation has an inspectable receipt.',
    ) +
    '</div>'
  )
}

function renderOutdatedTable() {
  return (
    '<div class="outdated-table"><div class="outdated-row outdated-row--head"><span>PACKAGE</span><span>CURRENT</span><span>WANTED + POLICY</span><span>LATEST + POLICY</span></div>' +
    outdatedRows
      .map(
        (row) =>
          '<div class="outdated-row"><strong>' +
          escapeHtml(row.name) +
          '</strong><span>' +
          escapeHtml(row.current) +
          '</span><span class="outdated-candidate"><b>' +
          escapeHtml(row.wanted) +
          '</b>' +
          verdictBadge(row.wantedPolicy) +
          '</span><span class="outdated-candidate"><b>' +
          escapeHtml(row.latest) +
          '</b>' +
          verdictBadge(row.latestPolicy) +
          '</span></div>',
      )
      .join('') +
    '</div>'
  )
}

function renderOutdated() {
  let content = ''
  if (currentVariant.key === 'A') {
    content =
      '<div class="outdated-intro"><span>4 outdated · 8 candidates</span><p>Annotate Wanted and Latest independently while preserving the familiar drift table.</p></div>' +
      renderOutdatedTable()
  } else if (currentVariant.key === 'B') {
    const groups = [
      ['POLICY PASS', outdatedCandidates.filter((candidate) => candidate.policy.kind === 'pass')],
      ['POLICY WARN', outdatedCandidates.filter((candidate) => candidate.policy.kind === 'warn')],
      ['POLICY ERROR', outdatedCandidates.filter((candidate) => candidate.policy.kind === 'error')],
      [
        'EVIDENCE UNKNOWN',
        outdatedCandidates.filter((candidate) => candidate.policy.kind === 'unknown'),
      ],
    ]
    content =
      '<div class="outdated-scoreboard">' +
      groups
        .map(
          ([name, rows]) =>
            '<div><span>' + name + '</span><strong>' + rows.length + '</strong></div>',
        )
        .join('') +
      '</div><div class="outdated-groups">' +
      groups
        .filter(([, rows]) => rows.length > 0)
        .map(
          ([name, candidates]) =>
            '<section><h3>' +
            name +
            '</h3>' +
            candidates
              .map(
                (candidate) =>
                  '<div class="outdated-card"><strong>' +
                  escapeHtml(candidate.name) +
                  '</strong><span>' +
                  escapeHtml(candidate.target) +
                  ' · ' +
                  escapeHtml(candidate.version) +
                  '</span>' +
                  verdictBadge(candidate.policy) +
                  '</div>',
              )
              .join('') +
            '</section>',
        )
        .join('') +
      '</div>'
  } else {
    content =
      '<div class="outdated-timeline">' +
      outdatedRows
        .map(
          (row) =>
            '<article><div class="timeline-track"><span></span><span></span><span></span></div><div class="timeline-copy"><header><strong>' +
            escapeHtml(row.name) +
            '</strong><span>2 candidate verdicts</span></header><div><span>CURRENT <b>' +
            escapeHtml(row.current) +
            '</b></span><span class="timeline-candidate">WANTED <b>' +
            escapeHtml(row.wanted) +
            '</b>' +
            verdictBadge(row.wantedPolicy) +
            '</span><span class="timeline-candidate">LATEST <b>' +
            escapeHtml(row.latest) +
            '</b>' +
            verdictBadge(row.latestPolicy) +
            '</span></div><small>Wanted: ' +
            escapeHtml(row.wantedPolicy.detail ?? 'all configured exact-version facts passed') +
            ' · Latest: ' +
            escapeHtml(row.latestPolicy.detail ?? 'all configured exact-version facts passed') +
            '</small></div></article>',
        )
        .join('') +
      '</div>'
  }

  return (
    terminalHeader('siz outdated', 'read-only drift report · Wanted + Latest policy annotations') +
    '<div class="terminal-body terminal-body--outdated">' +
    content +
    '<div class="outdated-exit"><div><span>DEFAULT EXIT</span><strong>0</strong><small>policy annotations never turn outdated into Audit</small></div><div><span>WITH --exit-code</span><strong>1</strong><small>because dependencies are outdated, not because policy failed</small></div></div>' +
    '<p class="outdated-contract">Current keeps its range-floor meaning. Policy evaluates the exact <strong>Wanted</strong> and <strong>Latest</strong> candidates independently; when they resolve to the same version, fetch and render one verdict.</p>' +
    '</div>'
  )
}

function fetchDecisionTable() {
  return (
    '<div class="decision-matrix"><div><span>QUESTION</span><span>PROPOSED CONTRACT</span><span>WHY</span></div>' +
    '<div><strong>Fetch key</strong><span><code>name@exactVersion</code></span><small>Minor and patch targets are not necessarily dist-tag latest.</small></div>' +
    '<div><strong>Immutable facts</strong><span>license · installSize · provenance</span><small>Safe for an eventual indefinite persistent cache.</small></div>' +
    '<div><strong>Mutable fact</strong><span>deprecated</span><small>npm can deprecate or undeprecate an existing version; revalidate per invocation.</small></div>' +
    '<div><strong>Package-level fact</strong><span>stale / latest publishedAt</span><small>Not candidate-version age; keep its independent metadata source.</small></div>' +
    '<div><strong>Failed lookup</strong><span>unknown evidence</span><small>Never manufacture a violation and never proceed silently.</small></div>' +
    '<div><strong>Definitive 404</strong><span>skip the candidate</span><small>A disappeared target is not merely policy evidence we failed to learn.</small></div>' +
    '<div><strong>Verdict scope</strong><span>exact resolved target only</span><small>A written caret or tilde range may admit future versions; later Audit catches drift.</small></div>' +
    '<div><strong>Current evidence</strong><span>best effort</span><small>Current is a range floor and may not name a published version; never call it installed.</small></div>' +
    '<div><strong>Persistent cache</strong><span>not decided here</span><small>The map keeps on-disk caching in fog; this ticket fixes only the key and semantics.</small></div>' +
    '</div>'
  )
}

function renderFetchContract() {
  let structure = ''
  if (currentVariant.key === 'A') {
    structure =
      '<div class="fetch-log"><div><b>01</b><span>Dependency scan</span><small>names + occurrences</small></div><div><b>02</b><span>Registry comparison</span><small>version lists + latest</small></div><div><b>03</b><span>Resolve command target</span><small>exact version under the chosen ceiling</small></div><div><b>04</b><span>Fetch exact facts</span><small>registry.npmjs.org/&lt;name&gt;/&lt;version&gt;</small></div><div><b>05</b><span>Evaluate project policy</span><small>pass · warn · error · unknown</small></div><div><b>06</b><span>Render interaction</span><small>annotation, gate, or evidence review</small></div></div>'
  } else if (currentVariant.key === 'B') {
    structure =
      '<div class="fetch-pipeline"><div><span>SCAN</span><strong>what to query</strong></div><i>→</i><div><span>COMPARE</span><strong>candidate versions</strong></div><i>→</i><div class="is-accent"><span>EXACT FACTS</span><strong>name@version</strong></div><i>→</i><div><span>POLICY</span><strong>target verdict</strong></div><i>→</i><div><span>COMMAND</span><strong>affordance</strong></div></div>'
  } else {
    structure =
      '<div class="cache-ledger"><div class="cache-ledger__head"><span>KEY</span><span>FIELD</span><span>LIFETIME</span><span>FAILURE DOMAIN</span></div><div><code>sharp@0.33.5</code><strong>license</strong><span>immutable</span><small>exact manifest</small></div><div><code>sharp@0.33.5</code><strong>installSize</strong><span>immutable</span><small>exact manifest</small></div><div><code>sharp@0.33.5</code><strong>provenance</strong><span>immutable</span><small>exact manifest</small></div><div class="is-mutable"><code>sharp@0.33.5</code><strong>deprecated</strong><span>revalidate</span><small>maintainer mutation</small></div><div><code>sharp@latest</code><strong>publishedAt</strong><span>package-level</span><small>metadata batch</small></div></div>'
  }

  return (
    terminalHeader(
      'architecture note',
      'the narrow decision this ticket hands to implementation planning',
    ) +
    '<div class="terminal-body terminal-body--fetch">' +
    '<div class="fetch-proposition"><span>PROPOSITION</span><h3>Build the exact-version facts seam; do not restrict policy-aware upgrades to latest-only.</h3><p>The current <code>/latest</code> memo remains the Discover path. Upgrade and Outdated consume a distinct exact-version API after Registry comparison has chosen a candidate.</p></div>' +
    structure +
    fetchDecisionTable() +
    '<div class="dependent-note"><b>UNBLOCKS</b><span>Policy-aware targets now</span><span>Registry-sourced transitive Audit later</span></div>' +
    '</div>'
  )
}

function renderTerminal() {
  if (currentView.key === 'outdated') return renderOutdated()
  if (currentView.key === 'fetch') return renderFetchContract()
  if (currentVariant.key === 'A') return renderInlineSignals()
  if (currentVariant.key === 'B') return renderSeverityGate()
  return renderEvidenceReview()
}

function renderStateStrip() {
  const itemCount = scenarioItems().length
  stateStrip.innerHTML =
    '<span>STATE</span><code>variant=' +
    currentVariant.key +
    '</code><code>view=' +
    currentView.key +
    '</code><code>scenario=' +
    currentScenario.key +
    '</code><code>selected=' +
    selected.size +
    '/' +
    itemCount +
    '</code><code>overrides=' +
    overrides.size +
    '</code><code>unknownAcknowledgements=' +
    acknowledgements.size +
    '</code>'
}

function render() {
  updateUrl()
  renderScenarioList()
  renderViewTabs()
  renderVariantNotes()
  variantHeading.textContent = currentVariant.key + ' — ' + currentVariant.name
  switcherTitle.textContent = currentVariant.key + ' — ' + currentVariant.name
  terminal.innerHTML = renderTerminal()
  renderStateStrip()
}

function cycleVariant(direction) {
  const index = variants.findIndex((variant) => variant.key === currentVariant.key)
  currentVariant = variants[(index + direction + variants.length) % variants.length]
  resetInteraction()
  render()
}

scenarioList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-scenario]')
  if (!button) return
  currentScenario =
    scenarios.find((scenario) => scenario.key === button.dataset.scenario) ?? scenarios[0]
  resetInteraction()
  render()
})

viewTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]')
  if (!button) return
  currentView = views.find((view) => view.key === button.dataset.view) ?? views[0]
  confirmationOpen = false
  render()
})

terminal.addEventListener('click', (event) => {
  const control = event.target.closest('[data-action]')
  if (!control) return
  const item = entries[control.dataset.id]

  if (
    control.dataset.action === 'toggle' &&
    item &&
    (currentVariant.key !== 'C' || canSelectInReview(item))
  ) {
    if (selected.has(item.id)) selected.delete(item.id)
    else selected.add(item.id)
  }
  if (control.dataset.action === 'focus' && item) focusedId = item.id
  if (control.dataset.action === 'override' && item) {
    overrides.add(item.id)
    selected.add(item.id)
  }
  if (control.dataset.action === 'ack' && item) {
    acknowledgements.add(item.id)
    selected.add(item.id)
  }
  if (control.dataset.action === 'continue') confirmationOpen = true
  if (control.dataset.action === 'close-confirm') confirmationOpen = false
  render()
})

document.querySelector('#previous-variant').addEventListener('click', () => cycleVariant(-1))
document.querySelector('#next-variant').addEventListener('click', () => cycleVariant(1))

window.addEventListener('keydown', (event) => {
  const target = event.target
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  ) {
    return
  }
  if (event.key === 'ArrowLeft') cycleVariant(-1)
  if (event.key === 'ArrowRight') cycleVariant(1)
})

resetInteraction()
render()
