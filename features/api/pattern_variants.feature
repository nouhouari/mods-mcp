@api @US-002
Feature: Pattern Variants Management
  As a design system maintainer
  I want to define and manage pattern variants
  So that components can express multiple visual and behavioral states

  Background:
    Given the patterns API is accessible
    And the database is empty

  @US-002-create-variant
  Scenario: Create a variant for an existing pattern
    Given a pattern exists with id "btn-pattern" and name "Button"
    When I POST to /api/v1/patterns/{pattern_id}/variants with:
      | field    | value          |
      | name     | primary        |
      | props    | {"color":"primary","size":"md"} |
    Then the response status should be 201
    And the response should contain:
      | field        | value   |
      | variant_name | primary |
      | pattern_id   | <uuid>  |

  @US-002-list-variants
  Scenario: List all variants for a pattern
    Given a pattern exists with name "Button"
    And the pattern has variants:
      | name      |
      | primary   |
      | secondary |
      | disabled  |
    When I GET /api/v1/patterns/{pattern_id}/variants
    Then the response status should be 200
    And the response should contain 3 variant objects

  @US-002-get-variant
  Scenario: Retrieve a specific variant
    Given a pattern exists with name "Button"
    And a variant "primary" exists for the pattern
    When I GET /api/v1/patterns/{pattern_id}/variants/primary
    Then the response status should be 200
    And the response should contain:
      | field        | value   |
      | variant_name | primary |

  @US-002-update-variant
  Scenario: Update variant properties
    Given a pattern exists with name "Button"
    And a variant "primary" exists with props {"color": "blue"}
    When I PATCH /api/v1/patterns/{pattern_id}/variants/primary with:
      | field | value                  |
      | props | {"color":"navy","size":"lg"} |
    Then the response status should be 200
    And the variant props should be {"color": "navy", "size": "lg"}

  @US-002-delete-variant
  Scenario: Delete a variant
    Given a pattern exists with name "Button"
    And a variant "deprecated" exists for the pattern
    When I DELETE /api/v1/patterns/{pattern_id}/variants/deprecated
    Then the response status should be 204
    And the variant should no longer exist

  @US-002-variant-props-validation
  Scenario: Validate variant props against pattern schema
    Given a pattern exists with name "Button" with schema:
      """
      {
        "type": "object",
        "properties": {
          "color": {"type": "string", "enum": ["primary", "secondary"]},
          "size": {"type": "string", "enum": ["sm", "md", "lg"]}
        },
        "required": ["color"]
      }
      """
    When I POST to /api/v1/patterns/{pattern_id}/variants with:
      | field | value                |
      | name  | invalid              |
      | props | {"color":"invalid"}  |
    Then the response status should be 400
    And the error should include "color must be one of: primary, secondary"
