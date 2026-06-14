@US-003
Feature: Pattern Composition Rules
  As a design system architect
  I want to define composition rules between patterns
  So that patterns can be combined safely and consistently

  Background:
    Given the patterns API is accessible
    And the database is empty

  @US-003-create-composition-rule
  Scenario: Create a composition rule between patterns
    Given patterns exist:
      | name         | id           |
      | Button       | btn-pattern  |
      | Icon         | icon-pattern |
    When I POST to /api/v1/composition-rules with:
      | field          | value                                      |
      | parent_id      | btn-pattern                                |
      | child_id       | icon-pattern                               |
      | relationship   | contains                                   |
      | cardinality    | "0..1"                                     |
    Then the response status should be 201
    And the response should contain:
      | field        | value        |
      | parent_id    | btn-pattern  |
      | child_id     | icon-pattern |
      | relationship | contains     |

  @US-003-get-composition-rules
  Scenario: Retrieve composition rules for a pattern
    Given a pattern exists with name "Button"
    And composition rules exist:
      | parent      | child | relationship |
      | btn-pattern | icon  | contains     |
      | btn-pattern | text  | contains     |
    When I GET /api/v1/patterns/{pattern_id}/composition-rules
    Then the response status should be 200
    And the response should contain 2 composition rules

  @US-003-validate-composition
  Scenario: Validate composition against rules
    Given a pattern "Button" with composition rule allowing 1 Icon child
    When I POST to /api/v1/patterns/btn-pattern/validate-composition with:
      | field    | value              |
      | children | [{"id":"icon1"}, {"id":"icon2"}] |
    Then the response status should be 400
    And the error should include "Button can contain at most 1 Icon"

  @US-003-delete-composition-rule
  Scenario: Delete a composition rule
    Given a composition rule exists between "Button" and "Icon"
    When I DELETE /api/v1/composition-rules/{rule_id}
    Then the response status should be 204
    And the rule should no longer exist

  @US-003-circular-dependency
  Scenario: Prevent circular composition dependencies
    Given patterns exist:
      | name   | id     |
      | Button | btn-id |
      | Card   | card-id |
    And a composition rule exists: Button contains Card
    When I POST to /api/v1/composition-rules with:
      | field        | value   |
      | parent_id    | card-id |
      | child_id     | btn-id  |
      | relationship | contains |
    Then the response status should be 400
    And the error should include "Circular dependency detected"

  @US-003-list-composition-rules
  Scenario: List all composition rules in the system
    Given composition rules exist:
      | parent | child |
      | btn    | icon  |
      | card   | img   |
      | modal  | btn   |
    When I GET /api/v1/composition-rules?limit=2&offset=0
    Then the response status should be 200
    And the response should contain 2 rules
    And pagination metadata should indicate total of 3
