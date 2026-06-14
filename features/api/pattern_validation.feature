@api @US-005
Feature: Pattern Validation and Schema Enforcement
  As a design system maintainer
  I want to validate pattern definitions against schemas
  So that patterns maintain quality and consistency standards

  Background:
    Given the patterns API is accessible
    And the database is empty

  @US-005-validate-against-schema
  Scenario: Validate pattern structure against JSON schema
    Given a pattern schema exists:
      """
      {
        "type": "object",
        "properties": {
          "name": {"type": "string", "minLength": 1},
          "description": {"type": "string"},
          "category": {"type": "string", "enum": ["component", "container", "layout"]},
          "version": {"type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"}
        },
        "required": ["name", "category", "version"]
      }
      """
    When I POST to /api/v1/patterns/validate with:
      | field       | value       |
      | name        | Button      |
      | category    | component   |
      | version     | 1.0.0       |
    Then the response status should be 200
    And the validation result should indicate "valid"

  @US-005-schema-validation-failure
  Scenario: Reject pattern with invalid version format
    Given a pattern schema validates version format as "X.Y.Z"
    When I POST to /api/v1/patterns with:
      | field   | value       |
      | name    | Button      |
      | version | 1.0         |
    Then the response status should be 400
    And the error should include "version must match pattern ^[0-9]+\\.[0-9]+\\.[0-9]+$"

  @US-005-enum-validation
  Scenario: Enforce enum values in pattern fields
    Given a pattern schema defines category enum: [component, container, layout, primitive]
    When I POST to /api/v1/patterns with:
      | field    | value           |
      | name     | Button          |
      | category | invalid-type    |
    Then the response status should be 400
    And the error should include "category must be one of: component, container, layout, primitive"

  @US-005-required-fields
  Scenario: Validate all required fields are present
    Given a pattern schema requires: [name, description, category, version]
    When I POST to /api/v1/patterns with:
      | field       | value       |
      | name        | Button      |
      | description | A button    |
    Then the response status should be 400
    And the error should include "category is required"
    And the error should include "version is required"

  @US-005-custom-validation
  Scenario: Apply custom validation rules
    Given a custom validation rule: "If category is 'component', version must be provided"
    When I POST to /api/v1/patterns with:
      | field    | value     |
      | name     | Button    |
      | category | component |
    Then the response status should be 400
    And the error should include "version is required for components"

  @US-005-batch-validation
  Scenario: Validate multiple patterns in batch
    When I POST to /api/v1/patterns/batch-validate with:
      """
      [
        {"name": "Button", "category": "component", "version": "1.0.0"},
        {"name": "Card", "category": "container", "version": "2.0.0"},
        {"name": "Invalid"}
      ]
      """
    Then the response status should be 207
    And the batch result should indicate:
      | index | valid |
      | 0     | true  |
      | 1     | true  |
      | 2     | false |
    And item 2 should have error "name, category, version are required"

  @US-005-schema-versioning
  Scenario: Support multiple schema versions
    Given schema version 1.0 is active
    And schema version 2.0 exists with stricter requirements
    When I POST to /api/v1/patterns with schema_version: "1.0" and:
      | field | value     |
      | name  | Button    |
    Then the response status should be 201
    But when using schema_version: "2.0" validation would fail

  @US-005-lint-warnings
  Scenario: Generate lint warnings for style inconsistencies
    When I POST to /api/v1/patterns/lint with pattern:
      """
      {
        "name": "MyButton",
        "description": "Some description",
        "category": "component"
      }
      """
    Then the response status should be 200
    And warnings should include:
      | warning                  |
      | name should use kebab-case |
      | description is too short  |
