import { Given, When, Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import { MpdsWorld } from '../support/world';
import { createProject } from '../modules/registry/index';
import {
  createToken,
  getToken,
  listTokens,
  updateToken,
  deleteToken,
  resolveTokens,
  setOverride,
  deleteOverride,
  TokensError,
} from '../modules/tokens/index';

// ---------------------------------------------------------------------------
// Given steps — tokens-primitive-crud
// ---------------------------------------------------------------------------

Given("a base project {string} exists with token {string} in category {string}", async function (
  this: MpdsWorld,
  projectId: string,
  tokenKey: string,
  category: string
) {
  await createProject({ id: projectId, name: projectId });
  await createToken({ projectId, key: tokenKey, category, value: '#FF0000' });
});

Given("a base project {string} with tokens in {string} and {string} categories", async function (
  this: MpdsWorld,
  projectId: string,
  cat1: string,
  cat2: string
) {
  await createProject({ id: projectId, name: projectId });
  await createToken({ projectId, key: `${cat1}-token`, category: cat1, value: 'val1' });
  await createToken({ projectId, key: `${cat2}-token`, category: cat2, value: 'val2' });
});

Given("a base project {string} with token {string} at version 0", async function (
  this: MpdsWorld,
  projectId: string,
  tokenKey: string
) {
  await createProject({ id: projectId, name: projectId });
  // Determine a sensible category based on key prefix
  const category = tokenKey.startsWith('spacing') ? 'spacing' : 'color';
  await createToken({ projectId, key: tokenKey, category, value: '#FF0000' });
});

// ---------------------------------------------------------------------------
// Given steps — tokens-semantic
// ---------------------------------------------------------------------------

Given("a base project {string} with primitive token {string} value {string}", async function (
  this: MpdsWorld,
  projectId: string,
  tokenKey: string,
  value: string
) {
  await createProject({ id: projectId, name: projectId });
  await createToken({ projectId, key: tokenKey, category: 'color', value });
});

Given("a base project {string} with semantic token {string} referencing primitive {string}", async function (
  this: MpdsWorld,
  projectId: string,
  semanticKey: string,
  primitiveKey: string
) {
  await createProject({ id: projectId, name: projectId });
  // Create the primitive first
  await createToken({ projectId, key: primitiveKey, category: 'color', value: '#000000' });
  // Create the semantic token
  await createToken({ projectId, key: semanticKey, category: 'color', value: '#000000', isSemantic: true, semanticRef: primitiveKey });
});

Given("a base project {string} with primitive {string} and semantic {string} referencing {string}", async function (
  this: MpdsWorld,
  projectId: string,
  primitiveKey: string,
  semanticKey: string,
  refKey: string
) {
  await createProject({ id: projectId, name: projectId });
  await createToken({ projectId, key: primitiveKey, category: 'color', value: '#0000FF' });
  await createToken({ projectId, key: semanticKey, category: 'color', value: '#0000FF', isSemantic: true, semanticRef: refKey });
});

Given("a base project {string} with a semantic reference chain of depth 5", async function (
  this: MpdsWorld,
  projectId: string
) {
  await createProject({ id: projectId, name: projectId });
  // t5 is primitive; t4 refs t5; t3 refs t4; t2 refs t3; t1 refs t2
  await createToken({ projectId, key: 't5', category: 'color', value: '#000005' });
  await createToken({ projectId, key: 't4', category: 'color', value: '#000004', isSemantic: true, semanticRef: 't5' });
  await createToken({ projectId, key: 't3', category: 'color', value: '#000003', isSemantic: true, semanticRef: 't4' });
  await createToken({ projectId, key: 't2', category: 'color', value: '#000002', isSemantic: true, semanticRef: 't3' });
  await createToken({ projectId, key: 't1', category: 'color', value: '#000001', isSemantic: true, semanticRef: 't2' });
});

// ---------------------------------------------------------------------------
// Given steps — tokens-overrides-resolution
// ---------------------------------------------------------------------------

Given("a base project {string} with token {string} value {string}", async function (
  this: MpdsWorld,
  projectId: string,
  tokenKey: string,
  value: string
) {
  // Check if project already exists before creating
  try {
    await createProject({ id: projectId, name: projectId });
  } catch (_) { /* may already exist if combined with other Given steps */ }
  const category = tokenKey.startsWith('spacing') ? 'spacing' : 'color';
  await createToken({ projectId, key: tokenKey, category, value });
});

Given("a child project {string} with parentId {string}", async function (
  this: MpdsWorld,
  childId: string,
  parentId: string
) {
  await createProject({ id: childId, name: childId, parentId });
});

Given("a child project {string} with an override for {string} value {string}", async function (
  this: MpdsWorld,
  childId: string,
  tokenKey: string,
  value: string
) {
  // We need the base project to exist. Set it up: base project with the token
  const baseId = 'base';
  try {
    await createProject({ id: baseId, name: baseId });
  } catch (_) {}
  try {
    await createToken({ projectId: baseId, key: tokenKey, category: 'color', value: '#FF0000' });
  } catch (_) {}
  try {
    await createProject({ id: childId, name: childId, parentId: baseId });
  } catch (_) {}
  await setOverride(childId, tokenKey, value, 0);
});

Given("a child project {string} with parentId {string} and no overrides", async function (
  this: MpdsWorld,
  childId: string,
  parentId: string
) {
  await createProject({ id: childId, name: childId, parentId });
});

Given("projects {string} and {string} both inheriting from {string}", async function (
  this: MpdsWorld,
  a: string,
  b: string,
  baseId: string
) {
  await createProject({ id: a, name: a, parentId: baseId });
  await createProject({ id: b, name: b, parentId: baseId });
});

Given("{string} has an override for {string} set to {string}", async function (
  this: MpdsWorld,
  projectId: string,
  tokenKey: string,
  value: string
) {
  await setOverride(projectId, tokenKey, value, 0);
});

Given("a child project {string} with base tokens in {string} and {string} categories", async function (
  this: MpdsWorld,
  childId: string,
  cat1: string,
  cat2: string
) {
  // Create base project first
  const baseId = 'base-for-' + childId;
  await createProject({ id: baseId, name: baseId });
  await createToken({ projectId: baseId, key: `${cat1}-token`, category: cat1, value: 'val1' });
  await createToken({ projectId: baseId, key: `${cat2}-token`, category: cat2, value: 'val2' });
  await createProject({ id: childId, name: childId, parentId: baseId });
});

Given("a base project {string} with tokens and a child {string} with overrides", async function (
  this: MpdsWorld,
  baseId: string,
  childId: string
) {
  await createProject({ id: baseId, name: baseId });
  await createToken({ projectId: baseId, key: 'color-primary', category: 'color', value: '#FF0000' });
  await createToken({ projectId: baseId, key: 'spacing-md', category: 'spacing', value: '8px' });
  await createProject({ id: childId, name: childId, parentId: baseId });
  await setOverride(childId, 'color-primary', '#00FF00', 0);
});

// ---------------------------------------------------------------------------
// When steps — tokens
// ---------------------------------------------------------------------------

When("I call createToken with projectId {string}, key {string}, category {string}, value {string}", async function (
  this: MpdsWorld,
  projectId: string,
  key: string,
  category: string,
  value: string
) {
  this.lastError = null;
  try {
    this.lastResult = await createToken({ projectId, key, category, value });
  } catch (err) {
    this.lastError = err;
  }
});

When("I call createToken with category {string} for project {string}", async function (
  this: MpdsWorld,
  category: string,
  projectId: string
) {
  this.lastError = null;
  try {
    this.lastResult = await createToken({ projectId, key: 'test-key', category, value: 'test-value' });
  } catch (err) {
    this.lastError = err;
  }
});

When("I call createToken with the same key {string} and category {string} for project {string}", async function (
  this: MpdsWorld,
  key: string,
  category: string,
  projectId: string
) {
  this.lastError = null;
  try {
    this.lastResult = await createToken({ projectId, key, category, value: '#0000FF' });
  } catch (err) {
    this.lastError = err;
  }
});

When("I call listTokens for project {string} with category {string}", async function (
  this: MpdsWorld,
  projectId: string,
  category: string
) {
  this.lastError = null;
  try {
    this.lastResult = await listTokens(projectId, category as any);
  } catch (err) {
    this.lastError = err;
  }
});

When("I call updateToken for {string} key {string} with value {string} and version 0", async function (
  this: MpdsWorld,
  projectId: string,
  key: string,
  value: string
) {
  this.lastError = null;
  try {
    this.lastResult = await updateToken(projectId, key, { version: 0, value });
  } catch (err) {
    this.lastError = err;
  }
});

When(/^I call updateToken for '([^']+)' key '([^']+)' with version 99 \(stale\)$/, async function (
  this: MpdsWorld,
  projectId: string,
  key: string
) {
  this.lastError = null;
  try {
    this.lastResult = await updateToken(projectId, key, { version: 99, value: '#STALE' });
  } catch (err) {
    this.lastError = err;
  }
});

When("I call deleteToken for project {string} key {string} version 0", async function (
  this: MpdsWorld,
  projectId: string,
  key: string
) {
  this.lastError = null;
  try {
    await deleteToken(projectId, key, 0);
    this.lastResult = null;
  } catch (err) {
    this.lastError = err;
  }
});

When("I call createToken with key {string}, isSemantic true, semanticRef {string} for project {string}", async function (
  this: MpdsWorld,
  key: string,
  semanticRef: string,
  projectId: string
) {
  this.lastError = null;
  try {
    this.lastResult = await createToken({ projectId, key, category: 'color', value: '#000000', isSemantic: true, semanticRef });
  } catch (err) {
    this.lastError = err;
  }
});

When("I call createToken with key {string} as semantic, semanticRef {string} for project {string}", async function (
  this: MpdsWorld,
  key: string,
  semanticRef: string,
  projectId: string
) {
  this.lastError = null;
  try {
    this.lastResult = await createToken({ projectId, key, category: 'color', value: '#000000', isSemantic: true, semanticRef });
  } catch (err) {
    this.lastError = err;
  }
});

When("I call resolveTokens for project {string}", async function (this: MpdsWorld, projectId: string) {
  this.lastError = null;
  try {
    this.lastResult = await resolveTokens(projectId);
  } catch (err) {
    this.lastError = err;
  }
});

When("I call setOverride for project {string} key {string} value {string} version 0", async function (
  this: MpdsWorld,
  projectId: string,
  key: string,
  value: string
) {
  this.lastError = null;
  try {
    this.lastResult = await setOverride(projectId, key, value, 0);
  } catch (err) {
    this.lastError = err;
  }
});

When("I call deleteOverride for project {string} key {string}", async function (
  this: MpdsWorld,
  projectId: string,
  key: string
) {
  this.lastError = null;
  try {
    await deleteOverride(projectId, key);
    this.lastResult = null;
  } catch (err) {
    this.lastError = err;
  }
});

When("I call resolveTokens for project {string} with category {string}", async function (
  this: MpdsWorld,
  projectId: string,
  category: string
) {
  this.lastError = null;
  try {
    this.lastResult = await resolveTokens(projectId, category as any);
  } catch (err) {
    this.lastError = err;
  }
});

When("I call resolveTokens for project {string} twice without any mutations between calls", async function (
  this: MpdsWorld,
  projectId: string
) {
  this.lastError = null;
  try {
    this.lastResult = await resolveTokens(projectId);
    this.secondResult = await resolveTokens(projectId);
  } catch (err) {
    this.lastError = err;
  }
});

// ---------------------------------------------------------------------------
// Then steps — tokens
// ---------------------------------------------------------------------------

Then("the returned token has key {string} and value {string}", function (this: MpdsWorld, key: string, value: string) {
  const token = this.lastResult as any;
  assert.ok(token, 'Expected a token result');
  assert.strictEqual(token.key, key);
  assert.strictEqual(token.value, value);
});

Then("listTokens for project {string} includes the token {string}", async function (
  this: MpdsWorld,
  projectId: string,
  tokenKey: string
) {
  const tokens = await listTokens(projectId);
  const found = tokens.find((t: any) => t.key === tokenKey);
  assert.ok(found, `Expected to find token '${tokenKey}' in listTokens for project '${projectId}'`);
});

Then("a TokensError is thrown with code {string}", function (this: MpdsWorld, code: string) {
  assert.ok(this.lastError, `Expected a TokensError but no error was thrown`);
  const err = this.lastError as any;
  assert.ok(err instanceof TokensError, `Expected TokensError but got ${err.constructor?.name}: ${err.message}`);
  assert.strictEqual(err.code, code);
});

Then("all returned tokens have category {string}", function (this: MpdsWorld, category: string) {
  const tokens = this.lastResult as any[];
  assert.ok(Array.isArray(tokens), 'Expected an array of tokens');
  assert.ok(tokens.length > 0, 'Expected at least one token');
  for (const token of tokens) {
    assert.strictEqual(token.category, category, `Token '${token.key}' has category '${token.category}', expected '${category}'`);
  }
});

Then("the returned token has value {string} and version 1", function (this: MpdsWorld, value: string) {
  const token = this.lastResult as any;
  assert.ok(token, 'Expected a token result');
  assert.strictEqual(token.value, value);
  assert.strictEqual(token.version, 1);
});

Then("calling getToken for {string} key {string} throws TOKEN_NOT_FOUND", async function (
  this: MpdsWorld,
  projectId: string,
  key: string
) {
  let error: any = null;
  try {
    await getToken(projectId, key);
  } catch (err) {
    error = err;
  }
  assert.ok(error, 'Expected TOKEN_NOT_FOUND error');
  assert.ok(error instanceof TokensError, `Expected TokensError but got ${error.constructor?.name}`);
  assert.strictEqual(error.code, 'TOKEN_NOT_FOUND');
});

Then("the returned token has isSemantic true and semanticRef {string}", function (this: MpdsWorld, semanticRef: string) {
  const token = this.lastResult as any;
  assert.ok(token, 'Expected a token result');
  assert.strictEqual(token.isSemantic, true);
  assert.strictEqual(token.semanticRef, semanticRef);
});

Then("all tokens in the chain are returned without error", function (this: MpdsWorld) {
  assert.ok(!this.lastError, `Expected no error but got: ${(this.lastError as any)?.message}`);
  const tokens = this.lastResult as any[];
  assert.ok(Array.isArray(tokens), 'Expected an array of tokens');
  assert.ok(tokens.length >= 5, `Expected at least 5 tokens, got ${tokens.length}`);
});

Then("the resolved token {string} has value {string} and source {string}", function (
  this: MpdsWorld,
  key: string,
  value: string,
  source: string
) {
  const tokens = this.lastResult as any[];
  assert.ok(Array.isArray(tokens), 'Expected an array of resolved tokens');
  const token = tokens.find((t: any) => t.key === key);
  assert.ok(token, `Expected resolved token with key '${key}'`);
  assert.strictEqual(token.value, value);
  assert.strictEqual(token.source, source);
});

Then("the resolved token {string} has source {string}", function (this: MpdsWorld, key: string, source: string) {
  const tokens = this.lastResult as any[];
  assert.ok(Array.isArray(tokens), 'Expected an array of resolved tokens');
  const token = tokens.find((t: any) => t.key === key);
  assert.ok(token, `Expected resolved token with key '${key}'`);
  assert.strictEqual(token.source, source);
});

Then("the resolved token {string} has source {string} and value {string}", function (
  this: MpdsWorld,
  key: string,
  source: string,
  value: string
) {
  const tokens = this.lastResult as any[];
  assert.ok(Array.isArray(tokens), 'Expected an array of resolved tokens');
  const token = tokens.find((t: any) => t.key === key);
  assert.ok(token, `Expected resolved token with key '${key}'`);
  assert.strictEqual(token.source, source);
  assert.strictEqual(token.value, value);
});

Then("both results are identical", function (this: MpdsWorld) {
  assert.ok(!this.lastError, `Expected no error but got: ${(this.lastError as any)?.message}`);
  assert.ok(this.lastResult !== null, 'Expected first result');
  assert.ok(this.secondResult !== null, 'Expected second result');
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(this.lastResult)),
    JSON.parse(JSON.stringify(this.secondResult)),
    'Expected both resolveTokens results to be identical'
  );
});
