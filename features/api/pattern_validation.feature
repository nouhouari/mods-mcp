@api @US-005
Feature: Pattern Inline Validation
  As a design system maintainer
  I want create operations to enforce field requirements, format rules, and enum constraints inline
  So that invalid data is rejected immediately with clear error codes

  Background:
    Given the patterns API is accessible
    And the database is empty

  @US-005-invalid-id
  Scenario: Reject pattern with non-kebab-case id
    When I POST to "/api/v1/patterns" with:
      | id        | name   | category  |
      | My Button | Button | component |
    Then the response status should be 400
    And the error should include "INVALID_PATTERN_ID"

  @US-005-missing-id
  Scenario: Reject pattern creation when id field is absent
    When I POST to "/api/v1/patterns" with:
      | name   | category  |
      | Button | component |
    Then the response status should be 400

  @US-005-missing-name
  Scenario: Reject pattern creation when name field is absent
    When I POST to "/api/v1/patterns" with:
      | id    | category  |
      | btn-v | component |
    Then the response status should be 400

  @US-005-missing-category
  Scenario: Reject pattern creation when category field is absent
    When I POST to "/api/v1/patterns" with:
      | id     | name   |
      | btn-v2 | Button |
    Then the response status should be 400

  @US-005-duplicate-pattern
  Scenario: Reject pattern creation when id already exists
    Given a pattern exists with id "dup-val" and name "Original"
    When I POST to "/api/v1/patterns" with:
      | id      | name | category  |
      | dup-val | Dup  | component |
    Then the response status should be 400
    And the error should include "DUPLICATE_PATTERN_ID"

  @US-005-invalid-relation
  Scenario: Reject composition rule with invalid relation enum
    Given patterns exist:
      | id    | name |
      | rel-a | A    |
      | rel-b | B    |
    When I POST to "/api/v1/composition-rules" with:
      | patternAId | patternBId | relation     |
      | rel-a      | rel-b      | invalid-enum |
    Then the response status should be 400
    And the error should include "INVALID_RELATION"

  @US-005-invalid-guideline-type
  Scenario: Reject layout guideline creation with unknown type
    When I POST to "/api/v1/layout-guidelines" with:
      | type         | name    |
      | unknown-type | test-gl |
    Then the response status should be 400

  @US-005-pattern-not-found-for-rule
  Scenario: Reject composition rule when referenced patterns do not exist
    When I POST to "/api/v1/composition-rules" with:
      | patternAId | patternBId | relation        |
      | ghost-a    | ghost-b    | NESTING_ALLOWED |
    Then the error should include "PATTERN_NOT_FOUND"
