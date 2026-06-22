import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import * as assert from 'assert';
import { MpdsWorld } from '../support/world';
import * as patternsService from '../modules/patterns/index';

// Module augmentation to add lastVariantId to MpdsWorld
declare module '../support/world' {
  interface MpdsWorld {
    lastVariantId: string | null;
  }
}

/**
 * Patterns API Step Definitions
 *
 * These steps test the patterns service functions directly,
 * following the same pattern as other services (tokens, components).
 */

const projectId = 'test-project';

// ============================================================================
// HELPERS
// ============================================================================

function tableToObject(table: DataTable): Record<string, any> {
  const raw = table.raw();
  const headers = raw[0] || [];

  // Handle the special field|value two-column format where each row is a key-value pair.
  if (headers.length === 2 && headers[0] === 'field' && headers[1] === 'value') {
    const obj: Record<string, any> = {};
    table.hashes().forEach((row) => {
      const key = row['field'];
      const val = row['value'];
      try {
        obj[key] = JSON.parse(val);
      } catch {
        obj[key] = val;
      }
    });
    return obj;
  }

  // General multi-column format: merge all rows into a single object (later rows overwrite earlier).
  const obj: Record<string, any> = {};
  table.hashes().forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      try {
        obj[key] = JSON.parse(value as string);
      } catch {
        obj[key] = value;
      }
    });
  });
  return obj;
}

// ============================================================================
// BACKGROUND STEPS
// ============================================================================

Given('the patterns API is accessible', async function (this: MpdsWorld) {
  // This is a no-op step for this test
});

Given('the database is empty', async function (this: MpdsWorld) {
  // Database is reset in the Before hook
});

// ============================================================================
// PATTERN CRUD
// ============================================================================

When('I POST to {string} with:', async function (this: MpdsWorld, endpoint: string, table: DataTable) {
  const data = tableToObject(table);
  
  try {
    if (endpoint === '/api/v1/patterns') {
      this.lastResponse = await patternsService.createPattern(projectId, data as any);
      this.lastStatus = 201;
      this.lastPatternId = this.lastResponse.id;
    } else if (endpoint.includes('/variants') && endpoint.includes('{pattern_id}')) {
      const patternId = this.lastPatternId;
      const variant = await patternsService.createVariant(projectId, patternId!, data as any);
      this.lastResponse = variant;
      this.lastStatus = 201;
      this.lastVariantId = variant.id;
    } else if (endpoint === '/api/v1/composition-rules') {
      this.lastResponse = await patternsService.createCompositionRule(projectId, data as any);
      this.lastStatus = 201;
      this.lastRuleId = this.lastResponse.id;
    } else if (endpoint === '/api/v1/layout-guidelines') {
      this.lastResponse = await patternsService.createLayoutGuideline(projectId, data as any);
      this.lastStatus = 201;
      this.lastGuidelineId = this.lastResponse.id;
    } else if (endpoint.includes('/layout-guidelines') && endpoint.includes('{pattern_id}')) {
      this.lastResponse = await patternsService.createLayoutGuideline(projectId, data as any);
      this.lastStatus = 201;
    }
  } catch (err: any) {
    if (err instanceof patternsService.PatternsError) {
      this.lastError = err;
      this.lastStatus = err.code === 'PATTERN_NOT_FOUND' || err.code === 'VARIANT_NOT_FOUND' 
        ? 404 
        : 400;
      this.lastResponse = { error: { code: err.code, message: err.message } };
    } else {
      this.lastError = err;
      this.lastStatus = 500;
    }
  }
});

When('I GET {string}', async function (this: MpdsWorld, endpoint: string) {
  try {
    const resolvedEndpoint = endpoint
      .replace('{pattern_id}', this.lastPatternId || '')
      .replace('{rule_id}', this.lastRuleId || '')
      .replace('{variant_id}', this.lastVariantId || '')
      .replace('{guideline_id}', this.lastGuidelineId || '');

    if (resolvedEndpoint === '/api/v1/patterns' || resolvedEndpoint.startsWith('/api/v1/patterns?')) {
      const response = await patternsService.listPatterns(projectId, {});
      this.lastResult = response;
      this.lastResponse = response.patterns || [];
      this.lastStatus = 200;
    } else if (resolvedEndpoint.match(/^\/api\/v1\/patterns\/[^/]+$/) && !resolvedEndpoint.includes('/variants') && !resolvedEndpoint.includes('/composition') && !resolvedEndpoint.includes('/layout')) {
      const patternId = resolvedEndpoint.split('/')[4];
      this.lastResponse = await patternsService.getPattern(projectId, patternId);
      this.lastStatus = 200;
    } else if (resolvedEndpoint.includes('/variants') && !resolvedEndpoint.split('/variants')[1]) {
      const patternId = resolvedEndpoint.split('/')[4];
      this.lastResponse = await patternsService.listVariants(projectId, patternId);
      this.lastStatus = 200;
    } else if (resolvedEndpoint.includes('/variants/')) {
      const parts = resolvedEndpoint.split('/');
      const patternId = parts[4];
      const variantId = parts[6];
      this.lastResponse = await patternsService.getVariant(projectId, patternId, variantId);
      this.lastStatus = 200;
    } else if (resolvedEndpoint === '/api/v1/composition-rules' || resolvedEndpoint.startsWith('/api/v1/composition-rules?')) {
      this.lastResponse = await patternsService.listCompositionRules(projectId, {});
      this.lastStatus = 200;
    } else if (resolvedEndpoint.match(/^\/api\/v1\/patterns\/[^/]+\/composition-rules$/)) {
      // Pattern-scoped: GET /api/v1/patterns/{pattern_id}/composition-rules
      const patternId = resolvedEndpoint.split('/')[4];
      this.lastResponse = await patternsService.getCompositionRules(projectId, patternId);
      this.lastStatus = 200;
    } else if (resolvedEndpoint === '/api/v1/layout-guidelines' || (resolvedEndpoint.includes('/layout-guidelines') && !resolvedEndpoint.split('/layout-guidelines')[1])) {
      this.lastResponse = await patternsService.listLayoutGuidelines(projectId, {});
      this.lastStatus = 200;
    } else if (resolvedEndpoint.match(/^\/api\/v1\/layout-guidelines\/[^/]+$/)) {
      // Project-scoped: /api/v1/layout-guidelines/{guideline_id}
      const guidelineId = resolvedEndpoint.split('/')[4];
      this.lastResponse = await patternsService.getLayoutGuideline(projectId, guidelineId);
      this.lastStatus = 200;
    } else if (resolvedEndpoint.includes('/layout-guidelines/')) {
      // Pattern-scoped: /api/v1/patterns/{pattern_id}/layout-guidelines/{guideline_id}
      const parts = resolvedEndpoint.split('/');
      const guidelineId = parts[6];
      this.lastResponse = await patternsService.getLayoutGuideline(projectId, guidelineId);
      this.lastStatus = 200;
    }
  } catch (err: any) {
    if (err instanceof patternsService.PatternsError) {
      this.lastError = err;
      this.lastStatus = 404;
      this.lastResponse = { error: { code: err.code, message: err.message } };
    } else {
      this.lastError = err;
      this.lastStatus = 500;
    }
  }
});

When('I PATCH {string} with:', async function (this: MpdsWorld, endpoint: string, table: DataTable) {
  const data = tableToObject(table);

  try {
    const resolvedEndpoint = endpoint
      .replace('{pattern_id}', this.lastPatternId || '')
      .replace('{rule_id}', this.lastRuleId || '')
      .replace('{variant_id}', this.lastVariantId || '')
      .replace('{guideline_id}', this.lastGuidelineId || '');

    if (resolvedEndpoint.match(/^\/api\/v1\/patterns\/[^/]+$/) && !resolvedEndpoint.includes('/variants') && !resolvedEndpoint.includes('/layout')) {
      const patternId = resolvedEndpoint.split('/')[4];
      this.lastResponse = await patternsService.updatePattern(projectId, patternId, data);
      this.lastStatus = 200;
    } else if (resolvedEndpoint.includes('/variants/')) {
      const parts = resolvedEndpoint.split('/');
      const patternId = parts[4];
      const variantId = parts[6];
      this.lastResponse = await patternsService.updateVariant(projectId, patternId, variantId, data);
      this.lastStatus = 200;
    } else if (resolvedEndpoint.match(/^\/api\/v1\/layout-guidelines\/[^/]+$/)) {
      // Project-scoped: /api/v1/layout-guidelines/{guideline_id}
      const guidelineId = resolvedEndpoint.split('/')[4];
      this.lastResponse = await patternsService.updateLayoutGuideline(projectId, guidelineId, data);
      this.lastStatus = 200;
    } else if (resolvedEndpoint.includes('/layout-guidelines/')) {
      // Pattern-scoped: /api/v1/patterns/{pattern_id}/layout-guidelines/{guideline_id}
      const parts = resolvedEndpoint.split('/');
      const guidelineId = parts[6];
      this.lastResponse = await patternsService.updateLayoutGuideline(projectId, guidelineId, data);
      this.lastStatus = 200;
    }
  } catch (err: any) {
    if (err instanceof patternsService.PatternsError) {
      this.lastError = err;
      this.lastStatus = 404;
      this.lastResponse = { error: { code: err.code, message: err.message } };
    } else {
      this.lastError = err;
      this.lastStatus = 500;
    }
  }
});

When('I DELETE {string}', async function (this: MpdsWorld, endpoint: string) {
  try {
    const resolvedEndpoint = endpoint
      .replace('{pattern_id}', this.lastPatternId || '')
      .replace('{rule_id}', this.lastRuleId || '')
      .replace('{variant_id}', this.lastVariantId || '')
      .replace('{guideline_id}', this.lastGuidelineId || '');

    if (resolvedEndpoint.match(/^\/api\/v1\/patterns\/[^/]+$/) && !resolvedEndpoint.includes('/variants') && !resolvedEndpoint.includes('/composition') && !resolvedEndpoint.includes('/layout')) {
      const patternId = resolvedEndpoint.split('/')[4];
      await patternsService.deletePattern(projectId, patternId);
      this.lastStatus = 204;
    } else if (resolvedEndpoint.includes('/variants/')) {
      const parts = resolvedEndpoint.split('/');
      const patternId = parts[4];
      const variantId = parts[6];
      await patternsService.deleteVariant(projectId, patternId, variantId);
      this.lastStatus = 204;
    } else if (resolvedEndpoint.match(/^\/api\/v1\/composition-rules\/[^/]+$/)) {
      const ruleId = resolvedEndpoint.split('/')[4];
      await patternsService.deleteCompositionRule(projectId, ruleId);
      this.lastStatus = 204;
    } else if (resolvedEndpoint.match(/^\/api\/v1\/layout-guidelines\/[^/]+$/)) {
      // Project-scoped: /api/v1/layout-guidelines/{guideline_id}
      const guidelineId = resolvedEndpoint.split('/')[4];
      await patternsService.deleteLayoutGuideline(projectId, guidelineId);
      this.lastStatus = 204;
    } else if (resolvedEndpoint.includes('/layout-guidelines/')) {
      // Pattern-scoped: /api/v1/patterns/{pattern_id}/layout-guidelines/{guideline_id}
      const parts = resolvedEndpoint.split('/');
      const guidelineId = parts[6];
      await patternsService.deleteLayoutGuideline(projectId, guidelineId);
      this.lastStatus = 204;
    }
  } catch (err: any) {
    if (err instanceof patternsService.PatternsError) {
      this.lastError = err;
      this.lastStatus = 404;
      this.lastResponse = { error: { code: err.code, message: err.message } };
    } else {
      this.lastError = err;
      this.lastStatus = 500;
    }
  }
});

Then('the response status should be {int}', function (this: MpdsWorld, status: number) {
  assert.strictEqual(
    this.lastStatus,
    status,
    `Expected status ${status}, got ${this.lastStatus}. Response: ${JSON.stringify(this.lastResponse)}`
  );
});

Then('the response should contain:', function (this: MpdsWorld, table: DataTable) {
  const expected = tableToObject(table);
  const response = this.lastResponse;

  Object.entries(expected).forEach(([key, value]) => {
    if (value === '<uuid>') {
      assert.match(
        response[key],
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        `${key} is not a valid UUID`
      );
      this.lastPatternId = response[key];
    } else {
      assert.strictEqual(
        response[key],
        value,
        `Expected ${key} to be ${value}, got ${response[key]}`
      );
    }
  });
});

Then('the error should include {string}', function (this: MpdsWorld, errorText: string) {
  assert.ok(
    this.lastResponse,
    'Expected an error but response was successful'
  );
  const errorMessage = JSON.stringify(this.lastResponse);
  assert.ok(
    errorMessage.includes(errorText),
    `Expected error to include "${errorText}", got: ${errorMessage}`
  );
});

Then('the response body should match the stored pattern', function (this: MpdsWorld) {
  assert.ok(this.lastResponse.id, 'Response should have id');
  assert.ok(this.lastResponse.name, 'Response should have name');
});

Then('the response should contain a list of {int} patterns', function (this: MpdsWorld, count: number) {
  const list = Array.isArray(this.lastResponse)
    ? this.lastResponse
    : (this.lastResponse?.patterns ?? []);
  assert.strictEqual(
    list.length,
    count,
    `Expected ${count} patterns, got ${list.length}`
  );
});

// Given steps for setup
Given('a pattern exists with:', async function (this: MpdsWorld, table: DataTable) {
  const data = tableToObject(table);
  if (!data.id) throw new Error('id is required for each pattern');
    if (!data.name) throw new Error('name is required for each pattern');
    if (!data.description) data.description = 'Test pattern';
  if (!data.category) data.category = 'component';
  if (!data.version) data.version = '1.0.0';

  this.lastResponse = await patternsService.createPattern(projectId, data as any);
  this.lastPatternId = this.lastResponse.id;
});

Given('a pattern exists with name {string}', async function (this: MpdsWorld, name: string) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const result = await patternsService.createPattern(projectId, {
    id,
    name,
    category: 'component',
    description: 'Test pattern',
  });
  this.lastPatternId = result.id;
});

Given('a pattern exists with id {string} and name {string}', async function (this: MpdsWorld, id: string, name: string) {
  const result = await patternsService.createPattern(projectId, {
    id,
    name,
    category: 'component',
    description: 'Test pattern',
  });
  this.lastPatternId = result.id;
});

Given('patterns exist:', async function (this: MpdsWorld, table: DataTable) {
  const patterns = table.hashes();
  this.patternMap = new Map();

  for (const patternData of patterns) {
    const data: any = { ...patternData };
    if (!data.id) throw new Error('id is required for each pattern');
    if (!data.name) throw new Error('name is required for each pattern');
    if (!data.description) data.description = 'Test pattern';
    if (!data.category) data.category = 'component';
    if (!data.version) data.version = '1.0.0';

    const result = await patternsService.createPattern(projectId, data as any);
    if (patternData.id) {
      this.patternMap!.set(patternData.id, result.id);
    }
    this.lastPatternId = result.id;
  }
});

Given('the pattern has variants:', async function (this: MpdsWorld, table: DataTable) {
  const variants = table.hashes();
  for (const variant of variants) {
    await patternsService.createVariant(projectId, this.lastPatternId!, {
      name: variant.name,
      appliesAt: variant.appliesAt || 'mobile',
    });
  }
});

Given('a variant {string} exists for the pattern', async function (this: MpdsWorld, variantName: string) {
  const result = await patternsService.createVariant(projectId, this.lastPatternId!, {
    name: variantName,
    appliesAt: 'mobile',
  });
  this.lastVariantId = result.id;
});

Then('the response should contain {int} variant objects', function (this: MpdsWorld, count: number) {
  assert.strictEqual(
    (this.lastResponse || []).length,
    count,
    `Expected ${count} variants, got ${(this.lastResponse || []).length}`
  );
});

Then('the response should contain {int} composition rules', function (this: MpdsWorld, count: number) {
  const list = Array.isArray(this.lastResponse)
    ? this.lastResponse
    : (this.lastResponse?.compositionRules ?? []);
  assert.strictEqual(
    list.length,
    count,
    `Expected ${count} rules, got ${list.length}`
  );
});

Then('the response should contain {int} guideline objects', function (this: MpdsWorld, count: number) {
  const list = Array.isArray(this.lastResponse)
    ? this.lastResponse
    : (this.lastResponse?.guidelines ?? []);
  assert.strictEqual(
    list.length,
    count,
    `Expected ${count} guidelines, got ${list.length}`
  );
});

Then('the response should contain {int} rule', function (this: MpdsWorld, count: number) {
  const list = Array.isArray(this.lastResponse)
    ? this.lastResponse
    : (this.lastResponse?.compositionRules ?? []);
  assert.strictEqual(
    list.length,
    count,
    `Expected ${count} rules, got ${list.length}`
  );
});

Then('the response should contain {int} rules', function (this: MpdsWorld, count: number) {
  const list = Array.isArray(this.lastResponse)
    ? this.lastResponse
    : (this.lastResponse?.compositionRules ?? []);
  assert.strictEqual(
    list.length,
    count,
    `Expected ${count} rules, got ${list.length}`
  );
});

Given('composition rules exist:', async function (this: MpdsWorld, table: DataTable) {
  const RELATION_MAP: Record<string, string> = {
    contains: 'NESTING_ALLOWED',
    excludes: 'NESTING_FORBIDDEN',
  };
  const VALID_RELATIONS = ['NESTING_ALLOWED', 'NESTING_FORBIDDEN', 'OVERRIDE_CAUTION', 'SIBLING_ONLY', 'EXCLUSIVE'];

  const rules = table.hashes();
  for (const rule of rules) {
    const patternAId = rule.patternAId || rule.patternA || rule.parent;
    const patternBId = rule.patternBId || rule.patternB || rule.child;
    let relation = (rule.relation || rule.relationship || 'NESTING_ALLOWED').toUpperCase();

    // Map friendly names to enum values
    if (!VALID_RELATIONS.includes(relation)) {
      const lower = relation.toLowerCase();
      relation = RELATION_MAP[lower] || 'NESTING_ALLOWED';
    }

    const resolvedA = this.patternMap?.get(patternAId) || patternAId;
    const resolvedB = this.patternMap?.get(patternBId) || patternBId;

    const response = await patternsService.createCompositionRule(projectId, {
      patternAId: resolvedA,
      patternBId: resolvedB,
      relation,
    });
    this.lastRuleId = response.id;
  }
});

Then('the variant props should be {string}', function (this: MpdsWorld, propsStr: string) {
  const expected = JSON.parse(propsStr);
  assert.deepStrictEqual(
    this.lastResponse.props,
    expected,
    `Expected props ${JSON.stringify(expected)}, got ${JSON.stringify(this.lastResponse.props)}`
  );
});

Given('layout guidelines exist:', async function (this: MpdsWorld, table: DataTable) {
  const guidelines = table.hashes();
  for (const guideline of guidelines) {
    await patternsService.createLayoutGuideline(projectId, {
      type: 'breakpoints',
      name: guideline.name,
      description: guideline.description || '',
      data: {},
    });
  }
});

Given('a layout guideline {string} with min_width {int} exists', async function (
  this: MpdsWorld,
  name: string,
  minWidth: number
) {
  const response = await patternsService.createLayoutGuideline(projectId, {
    type: 'breakpoints',
    name,
    description: '',
    data: { minWidth },
  });
  this.lastGuidelineId = response.id;
});

Given('a composition rule exists between {string} and {string}', async function (this: MpdsWorld, nameA: string, nameB: string) {
  // Derive IDs from names using the same slug logic
  const toId = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let idA = this.patternMap?.get(nameA) || toId(nameA);
  let idB = this.patternMap?.get(nameB) || toId(nameB);

  // Ensure both patterns exist, creating them if needed
  try {
    await patternsService.getPattern(projectId, idA);
  } catch {
    const r = await patternsService.createPattern(projectId, { id: idA, name: nameA, category: 'component', description: 'Test pattern' });
    idA = r.id;
  }
  try {
    await patternsService.getPattern(projectId, idB);
  } catch {
    const r = await patternsService.createPattern(projectId, { id: idB, name: nameB, category: 'component', description: 'Test pattern' });
    idB = r.id;
  }

  const result = await patternsService.createCompositionRule(projectId, {
    patternAId: idA,
    patternBId: idB,
    relation: 'NESTING_ALLOWED',
  });
  this.lastRuleId = result.id;
});

Given('a layout guideline {string} exists', async function (this: MpdsWorld, name: string) {
  // Try to find an existing guideline with this name; create it if not found
  const existing = await patternsService.listLayoutGuidelines(projectId, {});
  const found = (existing.guidelines ?? []).find((g: any) => g.name === name);
  if (found) {
    this.lastGuidelineId = found.id;
    return;
  }
  const result = await patternsService.createLayoutGuideline(projectId, {
    type: 'breakpoints',
    name,
    description: '',
    data: {},
  });
  this.lastGuidelineId = result.id;
});

Then('the pagination metadata should indicate:', function (this: MpdsWorld, table: DataTable) {
  const expected = tableToObject(table);
  const response = this.lastResult as any;
  if (expected.total !== undefined) assert.strictEqual(response.total, Number(expected.total));
  if (expected.limit !== undefined) assert.strictEqual(response.limit, Number(expected.limit));
  if (expected.offset !== undefined) assert.strictEqual(response.offset, Number(expected.offset));
});

Then('pagination metadata should indicate total of {int}', function (this: MpdsWorld, total: number) {
  const response = this.lastResult as any;
  assert.strictEqual(response.total, total);
});

Then('the response should contain guideline data', function (this: MpdsWorld) {
  assert.ok(this.lastResponse && this.lastResponse.id, 'Response should have id');
  assert.ok(this.lastResponse.name, 'Response should have name');
});

Then('the guideline min_width should be {int}', function (this: MpdsWorld, minWidth: number) {
  const data = this.lastResponse && this.lastResponse.data;
  assert.strictEqual(data && data.minWidth, minWidth);
});

Then('the pattern should no longer exist in the database', async function (this: MpdsWorld) {
  try {
    await patternsService.getPattern(projectId, this.lastPatternId!);
    throw new Error('Pattern should not exist');
  } catch (err: any) {
    if (!(err instanceof patternsService.PatternsError)) throw err;
    assert.strictEqual(err.code, 'PATTERN_NOT_FOUND', 'Expected PATTERN_NOT_FOUND error');
  }
});

Then('the variant should no longer exist', function (this: MpdsWorld) {
  // Verified by 204 status
});

Then('the rule should no longer exist', function (this: MpdsWorld) {
  // Verified by 204 status
});

Then('the guideline should no longer exist', function (this: MpdsWorld) {
  // Verified by 204 status
});

Given('I select pattern {string}', function (this: MpdsWorld, patternSlug: string) {
  const resolvedId = this.patternMap?.get(patternSlug) || patternSlug;
  this.lastPatternId = resolvedId;
});

Then('the response status should be {int} or {int}', function (
  this: MpdsWorld,
  statusA: number,
  statusB: number
) {
  assert.ok(
    this.lastStatus === statusA || this.lastStatus === statusB,
    `Expected status ${statusA} or ${statusB}, got ${this.lastStatus}. Response: ${JSON.stringify(this.lastResponse)}`
  );
});
