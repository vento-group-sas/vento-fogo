import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANONICAL_PACKAGES,
  CONSUMER_REPOSITORY,
  CONTRACTUAL_TEST_COUNT,
  EXPECTED_PAGE_FILES,
  EXPECTED_ROUTE_HANDLERS,
  FOGO_RELATIONS,
  REQUIRED_EVIDENCE_FIELDS,
  SURFACES,
  containsSensitiveData,
  evaluateProfile,
  evaluateSurface,
  evidenceIsStale,
  resolveTargetPackages,
  sha256Identity,
  validateEvidence,
  validateRouteInventoryEntries,
} from './fogo-consumer-baseline-gate.mjs';

const positiveSurfaceScenarios = Object.freeze({
  'FOGO-SURFACE-001': {
    session: true,
    app_access: true,
    permission: true,
    auth_error: false,
    expired: false,
  },
  'FOGO-SURFACE-002': {
    site_id: 'SITE-001',
    area_id: 'AREA-001',
    actor_effective: 'EMP-001',
    manipulated: false,
    override_authorized: true,
    shared_device: true,
    actor_signed: true,
  },
  'FOGO-SURFACE-003': {
    page_count: 9,
    unique_page_count: 9,
    handler_count: 1,
    handler_registered: true,
    handler_counted_as_page: false,
    protected_direct_access: true,
  },
  'FOGO-SURFACE-004': {
    authorized: true,
    product_id: 'PROD-001',
    site_id: 'SITE-001',
    area_id: 'AREA-001',
    status: 'draft',
    input_valid: true,
  },
  'FOGO-SURFACE-005': {
    yield_qty: 12,
    yield_unit: 'unidad',
    ingredient_count: 3,
    quantities_valid: true,
    units_compatible: true,
    implicit_conversion: false,
  },
  'FOGO-SURFACE-006': {
    step_count: 4,
    steps_ordered: true,
    outputs_valid: true,
    status: 'published',
    publishable: true,
  },
  'FOGO-SURFACE-007': {
    authorized: true,
    published_only: true,
    read_only: true,
    formula_scope_allowed: true,
  },
  'FOGO-SURFACE-008': {
    permission: true,
    recipe_published: true,
    produced_qty: 10,
    ingredient_count: 3,
    destination_location_id: 'LOC-OUT-001',
    package_count: 2,
    packaged_qty: 10,
    output_count: 1,
    output_mode: 'inventory_stock',
    shared_device: true,
    actor_signed: true,
  },
  'FOGO-SURFACE-009': {
    route_valid: true,
    output_mode: 'inventory_stock',
    destination_valid: true,
    package_reconciled: true,
  },
  'FOGO-SURFACE-010': {
    batch_id: 'BATCH-001',
    produced_qty: 10,
    consumptions_attributable: true,
    destination_attributable: true,
    state_valid: true,
    duplicate: false,
  },
  'FOGO-SURFACE-011': {
    contract_consumed: true,
    claimed_owner: 'recipe',
  },
  'FOGO-SURFACE-012': {
    server_render: true,
    client_render: true,
    hydration_mismatch: false,
    interaction_ok: true,
    accessibility_ok: true,
    export_authorized: true,
    export_smoke_ok: true,
  },
});

const negativeSurfaceScenarios = Object.freeze({
  'FOGO-SURFACE-001': {
    session: false,
    app_access: true,
    permission: true,
    auth_error: false,
    expired: false,
  },
  'FOGO-SURFACE-002': {
    site_id: 'SITE-001',
    area_id: 'AREA-001',
    actor_effective: 'EMP-001',
    manipulated: true,
    override_authorized: false,
    shared_device: true,
    actor_signed: false,
  },
  'FOGO-SURFACE-003': {
    page_count: 8,
    unique_page_count: 8,
    handler_count: 1,
    handler_registered: true,
    handler_counted_as_page: true,
    protected_direct_access: false,
  },
  'FOGO-SURFACE-004': {
    authorized: false,
    product_id: 'PROD-001',
    site_id: 'SITE-002',
    area_id: 'AREA-999',
    status: 'draft',
    input_valid: false,
  },
  'FOGO-SURFACE-005': {
    yield_qty: 0,
    yield_unit: '',
    ingredient_count: 0,
    quantities_valid: false,
    units_compatible: false,
    implicit_conversion: true,
  },
  'FOGO-SURFACE-006': {
    step_count: 2,
    steps_ordered: false,
    outputs_valid: false,
    status: 'published',
    publishable: false,
  },
  'FOGO-SURFACE-007': {
    authorized: true,
    published_only: false,
    read_only: false,
    formula_scope_allowed: false,
  },
  'FOGO-SURFACE-008': {
    permission: false,
    recipe_published: false,
    produced_qty: 0,
    ingredient_count: 0,
    destination_location_id: '',
    package_count: 0,
    packaged_qty: 0,
    output_count: 0,
    output_mode: 'inventory_stock',
    shared_device: true,
    actor_signed: false,
  },
  'FOGO-SURFACE-009': {
    route_valid: false,
    output_mode: 'unknown',
    destination_valid: false,
    package_reconciled: false,
  },
  'FOGO-SURFACE-010': {
    batch_id: 'BATCH-001',
    produced_qty: 10,
    consumptions_attributable: false,
    destination_attributable: false,
    state_valid: false,
    duplicate: true,
  },
  'FOGO-SURFACE-011': {
    contract_consumed: true,
    claimed_owner: 'inventory',
  },
  'FOGO-SURFACE-012': {
    server_render: true,
    client_render: true,
    hydration_mismatch: true,
    interaction_ok: false,
    accessibility_ok: false,
    export_authorized: false,
    export_smoke_ok: false,
  },
});

const positiveProfiles = Object.freeze({
  '@vento/contracts': {
    types_compile: true,
    payload_shapes_checked: true,
    serialization_checked: true,
    identifier_semantics_preserved: true,
    no_global_cast_bypass: true,
  },
  '@vento/os-context': {
    session_checked: true,
    site_area_context_checked: true,
    permission_allow_checked: true,
    permission_deny_checked: true,
    shared_device_signature_checked: true,
    client_cannot_elevate_authority: true,
  },
  '@vento/supabase': {
    browser_client_checked: true,
    server_client_checked: true,
    permission_rpc_checked: true,
    production_rpc_checked: true,
    deny_path_checked: true,
    isolated_schema_source: true,
    no_service_role_fixture: true,
  },
  '@vento/ui-web': {
    server_render_checked: true,
    client_render_checked: true,
    hydration_checked: true,
    forms_checked: true,
    accessibility_checked: true,
    pdf_export_checked: true,
  },
});

for (const surface of SURFACES) {
  test(`POS ${surface.id} ${surface.name}`, () => {
    assert.equal(evaluateSurface(surface.id, positiveSurfaceScenarios[surface.id]), true);
  });
}

for (const surface of SURFACES) {
  test(`NEG ${surface.id} ${surface.name} falla cerrado`, () => {
    assert.equal(evaluateSurface(surface.id, negativeSurfaceScenarios[surface.id]), false);
  });
}

for (const packageName of CANONICAL_PACKAGES) {
  test(`PROFILE POS ${packageName}`, () => {
    assert.equal(evaluateProfile(packageName, positiveProfiles[packageName]), true);
  });
}

for (const packageName of CANONICAL_PACKAGES) {
  test(`PROFILE NEG ${packageName} no acepta cobertura incompleta`, () => {
    const incomplete = { ...positiveProfiles[packageName] };
    const firstKey = Object.keys(incomplete)[0];
    incomplete[firstKey] = false;
    assert.equal(evaluateProfile(packageName, incomplete), false);
  });
}

function validEvidence() {
  const targetPackageSet = [...CANONICAL_PACKAGES];
  const identity = sha256Identity('fixture');
  return {
    consumer_repository: CONSUMER_REPOSITORY,
    consumer_branch: 'main',
    consumer_base_commit: '1'.repeat(40),
    consumer_manifest_identity: identity,
    consumer_lockfile_identity: identity,
    test_contract_identity: identity,
    test_suite_identity: identity,
    fixture_set_identity: identity,
    environment_identity: 'isolated:win32:x64:node:v24.19.0',
    runtime_identity: 'v24.19.0',
    framework_identity: 'node:test+ci008-policy-engine-v1',
    target_package_set: targetPackageSet,
    compatibility_refs: targetPackageSet.map(
      (packageName) => FOGO_RELATIONS[packageName].compatibility_ref,
    ),
    fogo_profile_set: targetPackageSet.map(
      (packageName) => FOGO_RELATIONS[packageName].profile,
    ),
    route_inventory_identity: identity,
    source_contract_identity: identity,
    execution_identity: identity,
    started_at: '2026-08-17T22:32:00-05:00',
    completed_at: '2026-08-17T22:33:00-05:00',
    result: 'PASS',
    invalidation_reason: null,
    test_summary: {
      executed: CONTRACTUAL_TEST_COUNT,
      passed: CONTRACTUAL_TEST_COUNT,
      failed: 0,
      skipped: 0,
      denied_paths: 16,
    },
  };
}

test('REG-01 evidencia válida tiene los 19 campos contractuales', () => {
  const evidence = validEvidence();
  for (const field of REQUIRED_EVIDENCE_FIELDS) assert.ok(field in evidence);
  assert.deepEqual(validateEvidence(evidence), []);
});

test('REG-02 cero tests jamás se normaliza a PASS', () => {
  const evidence = validEvidence();
  evidence.test_summary.executed = 0;
  assert.ok(validateEvidence(evidence).includes('ZERO_REQUIRED_TESTS'));
});

test('REG-03 evidencia de otro consumidor jamás satisface FOGO', () => {
  const evidence = validEvidence();
  evidence.consumer_repository = 'devVentoGroup/vento-nexo';
  assert.ok(validateEvidence(evidence).includes('WRONG_CONSUMER_REPOSITORY'));
});

test('REG-04 cambiar commit vuelve STALE la evidencia', () => {
  const previous = validEvidence();
  const current = { ...previous, consumer_base_commit: '2'.repeat(40) };
  assert.equal(evidenceIsStale(previous, current), true);
});

test('REG-05 cambiar target package set vuelve STALE la evidencia', () => {
  const previous = validEvidence();
  const current = {
    ...previous,
    target_package_set: ['@vento/contracts'],
    compatibility_refs: ['PKG-COMP-MX-004'],
    fogo_profile_set: ['FOGO-PROFILE-CONTRACTS'],
  };
  assert.equal(evidenceIsStale(previous, current), true);
});

test('REG-06 entorno productivo queda bloqueado', () => {
  const evidence = validEvidence();
  evidence.environment_identity = 'production:remote';
  assert.ok(validateEvidence(evidence).includes('PRODUCTION_ENVIRONMENT_FORBIDDEN'));
});

test('REG-07 secretos reales o con forma de secreto quedan bloqueados', () => {
  assert.equal(containsSensitiveData({ password: 'synthetic-fixture-password-12345678' }), true);
});

test('REG-08 conjunto multi-package conserva orden canónico y perfiles exactos', () => {
  assert.deepEqual(
    resolveTargetPackages('@vento/ui-web,@vento/contracts,@vento/supabase'),
    ['@vento/contracts', '@vento/supabase', '@vento/ui-web'],
  );
});

test('REG-09 inventario exacto acepta nueve páginas y un handler separado', () => {
  const result = validateRouteInventoryEntries(EXPECTED_PAGE_FILES, EXPECTED_ROUTE_HANDLERS);
  assert.equal(result.result, 'PASS');
  assert.equal(result.actual_page_count, 9);
  assert.equal(result.actual_handler_count, 1);
});

test('REG-10 inventario con drift de páginas o handlers queda bloqueado', () => {
  const pages = EXPECTED_PAGE_FILES.filter((entry) => entry !== 'src/app/page.tsx');
  pages.push('src/app/extra/page.tsx');
  const handlers = [...EXPECTED_ROUTE_HANDLERS, 'src/app/api/extra/route.ts'];
  const result = validateRouteInventoryEntries(pages, handlers);
  assert.equal(result.result, 'BLOCKED');
  assert.ok(result.missing_pages.includes('src/app/page.tsx'));
  assert.ok(result.unexpected_pages.includes('src/app/extra/page.tsx'));
  assert.ok(result.unexpected_handlers.includes('src/app/api/extra/route.ts'));
});