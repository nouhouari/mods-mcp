import { Given, When, Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import { MpdsWorld } from '../support/world';
import { createProject } from '../modules/registry/index';
import {
  createSpec,
  getSpec,
  listSpecs,
  updateSpec,
  deleteSpec,
  setOverride,
  deleteOverride,
  ComponentsError,
} from '../modules/components/index';

// ---------------------------------------------------------------------------
// Given steps — project setup
// ---------------------------------------------------------------------------

Given("a child project {string} with parentId {string} exists", async function (
  this: MpdsWorld,
  childId: string,
  parentId: string
) {
  await createProject({ id: childId, name: childId, parentId });
});

// ---------------------------------------------------------------------------
// Given steps — component spec setup
// ---------------------------------------------------------------------------

Given("a component spec {string} named {string} exists in project {string}", async function (
  this: MpdsWorld,
  componentId: string,
  name: string,
  projectId: string
) {
  await createSpec({ id: componentId, projectId, name });
});

Given("component specs {string}, {string}, {string} exist in project {string}", async function (
  this: MpdsWorld,
  id1: string,
  id2: string,
  id3: string,
  projectId: string
) {
  await createSpec({ id: id1, projectId, name: id1 });
  await createSpec({ id: id2, projectId, name: id2 });
  await createSpec({ id: id3, projectId, name: id3 });
});

Given("a base project {string} has component {string} with a child project override", async function (
  this: MpdsWorld,
  baseProjectId: string,
  componentId: string
) {
  await createSpec({ id: componentId, projectId: baseProjectId, name: componentId });
  const childId = `${baseProjectId}-child`;
  try {
    await createProject({ id: childId, name: childId, parentId: baseProjectId });
  } catch (_) {}
  await setOverride(childId, componentId, { variants: ['primary'] });
});

Given("a component spec {string} named {string} with props {string} exists in project {string}", async function (
  this: MpdsWorld,
  componentId: string,
  name: string,
  propsJson: string,
  projectId: string
) {
  const props = JSON.parse(propsJson);
  await createSpec({ id: componentId, projectId, name, props });
});

Given("a component spec {string} named {string} with variants {string} exists in project {string}", async function (
  this: MpdsWorld,
  componentId: string,
  name: string,
  variantsJson: string,
  projectId: string
) {
  const variants = JSON.parse(variantsJson);
  await createSpec({ id: componentId, projectId, name, variants });
});

// ---------------------------------------------------------------------------
// Given steps — override setup
// ---------------------------------------------------------------------------

Given("an override exists for project {string} component {string} with variants {string}", async function (
  this: MpdsWorld,
  projectId: string,
  componentId: string,
  variantsJson: string
) {
  const variants = JSON.parse(variantsJson);
  await setOverride(projectId, componentId, { variants });
});

Given("an override exists for project {string} component {string} with props {string}", async function (
  this: MpdsWorld,
  projectId: string,
  componentId: string,
  propsJson: string
) {
  const props = JSON.parse(propsJson);
  await setOverride(projectId, componentId, { props });
});

// ---------------------------------------------------------------------------
// When steps — createSpec
// ---------------------------------------------------------------------------

When("I call createSpec with id {string}, projectId {string}, name {string}", async function (
  this: MpdsWorld,
  id: string,
  projectId: string,
  name: string
) {
  this.lastError = null;
  try {
    this.lastResult = await createSpec({ id, projectId, name });
  } catch (err) {
    this.lastError = err;
  }
});

// ---------------------------------------------------------------------------
// When steps — getSpec
// ---------------------------------------------------------------------------

When("I call getSpec for project {string} and component {string}", async function (
  this: MpdsWorld,
  projectId: string,
  componentId: string
) {
  this.lastError = null;
  try {
    this.lastResult = await getSpec(projectId, componentId);
  } catch (err) {
    this.lastError = err;
  }
});

// ---------------------------------------------------------------------------
// When steps — listSpecs
// ---------------------------------------------------------------------------

When("I call listSpecs for project {string}", async function (
  this: MpdsWorld,
  projectId: string
) {
  this.lastError = null;
  try {
    this.lastResult = await listSpecs(projectId);
  } catch (err) {
    this.lastError = err;
  }
});

// ---------------------------------------------------------------------------
// When steps — updateSpec
// ---------------------------------------------------------------------------

When("I call updateSpec for project {string} component {string} with name {string} and version {int}", async function (
  this: MpdsWorld,
  projectId: string,
  componentId: string,
  name: string,
  version: number
) {
  this.lastError = null;
  try {
    this.lastResult = await updateSpec(projectId, componentId, { name, version });
  } catch (err) {
    this.lastError = err;
  }
});

// ---------------------------------------------------------------------------
// When steps — deleteSpec
// ---------------------------------------------------------------------------

When("I call deleteSpec for project {string} component {string}", async function (
  this: MpdsWorld,
  projectId: string,
  componentId: string
) {
  this.lastError = null;
  try {
    await deleteSpec(projectId, componentId);
    this.lastResult = null;
  } catch (err) {
    this.lastError = err;
  }
});

// ---------------------------------------------------------------------------
// When steps — setOverride
// ---------------------------------------------------------------------------

When("I call setOverride for project {string} component {string} with variants {string}", async function (
  this: MpdsWorld,
  projectId: string,
  componentId: string,
  variantsJson: string
) {
  this.lastError = null;
  try {
    const variants = JSON.parse(variantsJson);
    this.lastResult = await setOverride(projectId, componentId, { variants });
  } catch (err) {
    this.lastError = err;
  }
});

When("I call setOverride for project {string} component {string} with invalid field {string}", async function (
  this: MpdsWorld,
  projectId: string,
  componentId: string,
  fieldName: string
) {
  this.lastError = null;
  try {
    this.lastResult = await setOverride(projectId, componentId, { [fieldName]: 'bad-value' } as any);
  } catch (err) {
    this.lastError = err;
  }
});

// ---------------------------------------------------------------------------
// When steps — deleteOverride
// ---------------------------------------------------------------------------

When("I call deleteOverride for project {string} component {string}", async function (
  this: MpdsWorld,
  projectId: string,
  componentId: string
) {
  this.lastError = null;
  try {
    await deleteOverride(projectId, componentId);
    this.lastResult = null;
  } catch (err) {
    this.lastError = err;
  }
});

// ---------------------------------------------------------------------------
// Then steps — spec shape assertions
// ---------------------------------------------------------------------------

Then("the returned spec has id {string}, projectId {string}, name {string}", function (
  this: MpdsWorld,
  id: string,
  projectId: string,
  name: string
) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  assert.strictEqual(spec.id, id);
  assert.strictEqual(spec.projectId, projectId);
  assert.strictEqual(spec.name, name);
});

Then("the returned spec has empty arrays and version 0", function (this: MpdsWorld) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  assert.deepStrictEqual(spec.props, [], `Expected props=[] but got ${JSON.stringify(spec.props)}`);
  assert.deepStrictEqual(spec.variants, [], `Expected variants=[] but got ${JSON.stringify(spec.variants)}`);
  assert.deepStrictEqual(spec.states, [], `Expected states=[] but got ${JSON.stringify(spec.states)}`);
  assert.deepStrictEqual(spec.usageRules, [], `Expected usageRules=[] but got ${JSON.stringify(spec.usageRules)}`);
  assert.deepStrictEqual(spec.accessibilityNotes, [], `Expected accessibilityNotes=[] but got ${JSON.stringify(spec.accessibilityNotes)}`);
  assert.strictEqual(spec.version, 0, `Expected version=0 but got ${spec.version}`);
});

Then("a ComponentsError is thrown with code {string}", function (this: MpdsWorld, code: string) {
  assert.ok(this.lastError, `Expected a ComponentsError but no error was thrown`);
  const err = this.lastError as any;
  assert.ok(
    err instanceof ComponentsError,
    `Expected ComponentsError but got ${err.constructor?.name}: ${err.message}`
  );
  assert.strictEqual(err.code, code);
});

Then("the error has field {string}", function (this: MpdsWorld, field: string) {
  const err = this.lastError as any;
  assert.ok(err, 'Expected an error to be present');
  assert.strictEqual(
    err.field,
    field,
    `Expected error.field='${field}' but got '${err.field}'`
  );
});

Then("the result is an empty array", function (this: MpdsWorld) {
  const result = this.lastResult as any;
  assert.ok(Array.isArray(result), `Expected an array but got ${typeof result}`);
  assert.strictEqual(result.length, 0, `Expected empty array but got ${result.length} items`);
});

Then("the result contains {int} specs", function (this: MpdsWorld, count: number) {
  const result = this.lastResult as any[];
  assert.ok(Array.isArray(result), `Expected an array but got ${typeof result}`);
  assert.strictEqual(result.length, count, `Expected ${count} specs but got ${result.length}`);
});

Then("every returned spec has id, name, projectId, props, variants, states, usageRules, accessibilityNotes, and version", function (
  this: MpdsWorld
) {
  const specs = this.lastResult as any[];
  assert.ok(Array.isArray(specs) && specs.length > 0, 'Expected at least one spec');
  for (const spec of specs) {
    assert.ok('id' in spec, `spec missing 'id'`);
    assert.ok('name' in spec, `spec missing 'name'`);
    assert.ok('projectId' in spec, `spec missing 'projectId'`);
    assert.ok(Array.isArray(spec.props), `spec.props should be an array`);
    assert.ok(Array.isArray(spec.variants), `spec.variants should be an array`);
    assert.ok(Array.isArray(spec.states), `spec.states should be an array`);
    assert.ok(Array.isArray(spec.usageRules), `spec.usageRules should be an array`);
    assert.ok(Array.isArray(spec.accessibilityNotes), `spec.accessibilityNotes should be an array`);
    assert.ok('version' in spec, `spec missing 'version'`);
  }
});

Then("the returned spec has name {string} and version {int}", function (
  this: MpdsWorld,
  name: string,
  version: number
) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  assert.strictEqual(spec.name, name);
  assert.strictEqual(spec.version, version);
});

Then("calling getSpec for project {string} component {string} throws COMPONENT_NOT_FOUND", async function (
  this: MpdsWorld,
  projectId: string,
  componentId: string
) {
  let error: any = null;
  try {
    await getSpec(projectId, componentId);
  } catch (err) {
    error = err;
  }
  assert.ok(error, 'Expected COMPONENT_NOT_FOUND error');
  assert.ok(
    error instanceof ComponentsError,
    `Expected ComponentsError but got ${error.constructor?.name}`
  );
  assert.strictEqual(error.code, 'COMPONENT_NOT_FOUND');
});

Then("calling listSpecs for project {string} does not include {string}", async function (
  this: MpdsWorld,
  projectId: string,
  componentId: string
) {
  const specs = await listSpecs(projectId);
  const found = specs.find((s: any) => s.id === componentId);
  assert.ok(!found, `Expected component '${componentId}' to be absent from listSpecs but it was found`);
});

// ---------------------------------------------------------------------------
// Then steps — override / resolution assertions
// ---------------------------------------------------------------------------

Then("the returned resolved spec has variants {string}", function (
  this: MpdsWorld,
  variantsJson: string
) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  const expected = JSON.parse(variantsJson);
  assert.deepStrictEqual(
    spec.variants,
    expected,
    `Expected variants=${variantsJson} but got ${JSON.stringify(spec.variants)}`
  );
});

Then("the returned resolved spec has props {string}", function (
  this: MpdsWorld,
  propsJson: string
) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  const expected = JSON.parse(propsJson);
  assert.deepStrictEqual(
    spec.props,
    expected,
    `Expected props=${propsJson} but got ${JSON.stringify(spec.props)}`
  );
});

Then("the returned resolved spec does not contain base variant {string}", function (
  this: MpdsWorld,
  variantName: string
) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  assert.ok(
    !spec.variants.includes(variantName),
    `Expected variants to not include '${variantName}' but got ${JSON.stringify(spec.variants)}`
  );
});

Then("the returned resolved spec does not contain base prop {string}", function (
  this: MpdsWorld,
  propName: string
) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  assert.ok(
    !spec.props.includes(propName),
    `Expected props to not include '${propName}' but got ${JSON.stringify(spec.props)}`
  );
});

Then("the returned resolved spec has name {string}", function (this: MpdsWorld, name: string) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  assert.strictEqual(spec.name, name);
});

Then("no error is thrown", function (this: MpdsWorld) {
  assert.ok(
    this.lastError === null,
    `Expected no error but got: ${(this.lastError as any)?.message}`
  );
});

Then("the resolved spec has all _sources as {string}", function (this: MpdsWorld, source: string) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  assert.ok(spec._sources, `Expected _sources to be present on resolved spec`);
  const sources = spec._sources as Record<string, string>;
  for (const [field, src] of Object.entries(sources)) {
    assert.strictEqual(
      src,
      source,
      `Expected _sources.${field}='${source}' but got '${src}'`
    );
  }
});

Then("the resolved spec _sources.variants is {string}", function (this: MpdsWorld, source: string) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  assert.ok(spec._sources, `Expected _sources to be present on resolved spec`);
  assert.strictEqual(
    spec._sources.variants,
    source,
    `Expected _sources.variants='${source}' but got '${spec._sources.variants}'`
  );
});

Then("the resolved spec _sources.name is {string}", function (this: MpdsWorld, source: string) {
  const spec = this.lastResult as any;
  assert.ok(spec, 'Expected a spec result');
  assert.ok(spec._sources, `Expected _sources to be present on resolved spec`);
  assert.strictEqual(
    spec._sources.name,
    source,
    `Expected _sources.name='${source}' but got '${spec._sources.name}'`
  );
});
