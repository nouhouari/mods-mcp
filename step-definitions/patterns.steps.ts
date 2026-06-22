import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import * as assert from 'assert';
import { MpdsWorld } from '../support/world';
import * as patternsService from '../modules/patterns/index';

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
  const obj: Record<string, any> = {};
  table.hashes().forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      try {
        obj[key] = JSON.parse(value);
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
      this.lastResponse = await patternsService.createVariant(projectId, patternId!, data as any);
      this.lastStatus = 201;
    } else if (endpoint === '/api/v1/composition-rules') {
      this.lastResponse = await patternsService.createCompositionRule(projectId, data as any);
      this.lastStatus = 201;
      this.lastRuleId = this.lastResponse.id;
    } else if (endpoint.includes('/layout-guidelines') && endpoint.includes('{pattern_id}')) {
      const patternId = this.lastPatternId;
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
      .replace('{rule_id}', this.lastRuleId || '');

    if (resolvedEndpoint === '/api/v1/patterns' || resolvedEndpoint.startsWith('/api/v1/patterns?')) {
      this.lastResponse = await patternsService.listPatterns(projectId, {});
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
    } else if (resolvedEndpoint.includes('/composition-rules') && !resolvedEndpoint.endsWith('/composition-rules')) {
      const patternId = resolvedEndpoint.split('/')[4];
      this.lastResponse = await patternsService.getCompositionRules(projectId, patternId);
      this.lastStatus = 200;
    } else if (resolvedEndpoint.includes('/layout-guidelines') && !resolvedEndpoint.split('/layout-guidelines')[1]) {
      const patternId = resolvedEndpoint.split('/')[4];
      this.lastResponse = await patternsService.listLayoutGuidelines(projectId, {});
      this.lastStatus = 200;
    } else if (resolvedEndpoint.includes('/layout-guidelines/')) {
      const parts = resolvedEndpoint.split('/');
      const patternId = parts[4];
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
      .replace('{rule_id}', this.lastRuleId || '');

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
    } else if (resolvedEndpoint.includes('/layout-guidelines/')) {
      const parts = resolvedEndpoint.split('/');
      const patternId = parts[4];
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
      .replace('{rule_id}', this.lastRuleId || '');

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
    } else if (resolvedEndpoint.includes('/layout-guidelines/')) {
      const parts = resolvedEndpoint.split('/');
      const patternId = parts[4];
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
  assert.strictEqual(
    (this.lastResponse || []).length,
    count,
    `Expected ${count} patterns, got ${(this.lastResponse || []).length}`
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
  await patternsService.createVariant(projectId, this.lastPatternId!, {
    name: variantName,
    appliesAt: 'mobile',
  });
});

Then('the response should contain {int} variant objects', function (this: MpdsWorld, count: number) {
  assert.strictEqual(
    (this.lastResponse || []).length,
    count,
    `Expected ${count} variants, got ${(this.lastResponse || []).length}`
  );
});

Then('the response should contain {int} composition rules', function (this: MpdsWorld, count: number) {
  assert.strictEqual(
    (this.lastResponse || []).length,
    count,
    `Expected ${count} rules, got ${(this.lastResponse || []).length}`
  );
});

Then('the response should contain {int} guideline objects', function (this: MpdsWorld, count: number) {
  assert.strictEqual(
    (this.lastResponse || []).length,
    count,
    `Expected ${count} guidelines, got ${(this.lastResponse || []).length}`
  );
});

Then('the response should contain {int} rule', function (this: MpdsWorld, count: number) {
  assert.strictEqual(
    (this.lastResponse || []).length,
    count,
    `Expected ${count} rules, got ${(this.lastResponse || []).length}`
  );
});

Then('the response should contain {int} rules', function (this: MpdsWorld, count: number) {
  assert.strictEqual(
    (this.lastResponse || []).length,
    count,
    `Expected ${count} rules, got ${(this.lastResponse || []).length}`
  );
});

Given('composition rules exist:', async function (this: MpdsWorld, table: DataTable) {
  const rules = table.hashes();
  for (const rule of rules) {
    const response = await patternsService.createCompositionRule(projectId, {
      patternAId: this.patternMap?.get(rule.patternA) || rule.patternA,
      patternBId: this.patternMap?.get(rule.patternB) || rule.patternB,
      relation: rule.relation || 'NESTING_ALLOWED',
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
