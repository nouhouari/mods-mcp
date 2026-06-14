@US-004
Feature: Layout Guidelines and Constraints
  As a design system curator
  I want to define layout guidelines for patterns
  So that patterns are positioned and sized consistently

  Background:
    Given the patterns API is accessible
    And the database is empty

  @US-004-create-layout-guideline
  Scenario: Create layout guideline for a pattern
    Given a pattern exists with name "Card"
    When I POST to /api/v1/patterns/{pattern_id}/layout-guidelines with:
      | field           | value                            |
      | name            | desktop-grid                     |
      | description     | Card layout on desktop grid      |
      | min_width       | 300                              |
      | max_width       | 600                              |
      | min_height      | 200                              |
      | padding         | {"top":16,"right":16,"bottom":16,"left":16} |
      | gap             | 8                                |
      | breakpoint      | 1024                             |
    Then the response status should be 201
    And the response should contain guideline data

  @US-004-get-guidelines
  Scenario: Retrieve layout guidelines for a pattern
    Given a pattern exists with name "Button"
    And layout guidelines exist:
      | name           |
      | mobile         |
      | tablet         |
      | desktop        |
    When I GET /api/v1/patterns/{pattern_id}/layout-guidelines
    Then the response status should be 200
    And the response should contain 3 guideline objects

  @US-004-update-guideline
  Scenario: Update layout guideline constraints
    Given a pattern exists with name "Button"
    And a layout guideline "mobile" with min_width 200 exists
    When I PATCH /api/v1/patterns/{pattern_id}/layout-guidelines/mobile with:
      | field     | value |
      | min_width | 250   |
      | max_width | 400   |
    Then the response status should be 200
    And the guideline min_width should be 250

  @US-004-breakpoint-variants
  Scenario: Define layout variants for different breakpoints
    Given a pattern exists with name "Grid"
    When I POST to /api/v1/patterns/{pattern_id}/layout-guidelines with:
      | field          | value                            |
      | name           | responsive                       |
      | description    | Responsive grid layout           |
      | breakpoints    | [{"bp":480,"cols":1},{"bp":768,"cols":2},{"bp":1024,"cols":3}] |
    Then the response status should be 201
    And the guideline should define 3 breakpoint configurations

  @US-004-spacing-scale
  Scenario: Validate spacing against design scale
    Given a pattern exists with name "Button"
    And the design system defines spacing scale: [4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64]
    When I POST to /api/v1/patterns/{pattern_id}/layout-guidelines with:
      | field        | value                 |
      | name         | standard              |
      | padding      | {"top":10}            |
    Then the response status should be 400
    And the error should include "padding.top must align with spacing scale"

  @US-004-delete-guideline
  Scenario: Delete layout guideline
    Given a pattern exists with name "Card"
    And a layout guideline "deprecated" exists
    When I DELETE /api/v1/patterns/{pattern_id}/layout-guidelines/deprecated
    Then the response status should be 204
    And the guideline should no longer exist

  @US-004-z-index-layering
  Scenario: Define z-index layers for overlapping patterns
    Given patterns exist:
      | name    | z-index |
      | Modal   | 1000    |
      | Tooltip | 800     |
      | Dropdown | 600    |
    When I POST to /api/v1/patterns/modal/layout-guidelines with:
      | field        | value                              |
      | name         | overlay-layering                   |
      | z_index      | 1000                               |
      | above        | ["tooltip", "dropdown"]            |
    Then the response status should be 201
    And the guideline should enforce z-index stacking order
