@api @US-003
Feature: Pattern Composition Rules
  As a design system architect
  I want to define composition rules between patterns
  So that patterns can be combined safely and consistently

  Background:
    Given the patterns API is accessible
    And the database is empty

  @US-003-create-rule
  Scenario: Create a composition rule between two patterns
    Given patterns exist:
      | id   | name   |
      | btn  | Button |
      | icon | Icon   |
    When I POST to "/api/v1/composition-rules" with:
      | field      | value           |
      | patternAId | btn             |
      | patternBId | icon            |
      | relation   | NESTING_ALLOWED |
    Then the response status should be 201
    And the response should contain:
      | field    | value           |
      | relation | NESTING_ALLOWED |

  @US-003-get-rules-for-pattern
  Scenario: Retrieve composition rules for a specific pattern
    Given patterns exist:
      | id    | name   |
      | btn   | Button |
      | icon  | Icon   |
      | label | Label  |
    And composition rules exist:
      | patternAId | patternBId | relation        |
      | btn        | icon       | NESTING_ALLOWED |
      | btn        | label      | SIBLING_ONLY    |
    And I select pattern "btn"
    When I GET "/api/v1/patterns/{pattern_id}/composition-rules"
    Then the response status should be 200
    And the response should contain 2 composition rules

  @US-003-list-all-rules
  Scenario: List all composition rules in the system
    Given patterns exist:
      | id | name |
      | a  | A    |
      | b  | B    |
      | c  | C    |
    And composition rules exist:
      | patternAId | patternBId | relation          |
      | a          | b          | NESTING_ALLOWED   |
      | b          | c          | SIBLING_ONLY      |
      | a          | c          | NESTING_FORBIDDEN |
    When I GET "/api/v1/composition-rules"
    Then the response status should be 200
    And the response should contain 3 rules

  @US-003-delete-rule
  Scenario: Delete a composition rule
    Given patterns exist:
      | id    | name |
      | del-a | A    |
      | del-b | B    |
    And a composition rule exists between "del-a" and "del-b"
    When I DELETE "/api/v1/composition-rules/{rule_id}"
    Then the response status should be 204
    And the rule should no longer exist

  @US-003-invalid-relation
  Scenario: Reject a composition rule with an invalid relation value
    Given patterns exist:
      | id   | name |
      | ev-a | A    |
      | ev-b | B    |
    When I POST to "/api/v1/composition-rules" with:
      | field      | value    |
      | patternAId | ev-a     |
      | patternBId | ev-b     |
      | relation   | contains |
    Then the response status should be 400
    And the error should include "INVALID_RELATION"

  @US-003-pattern-not-found
  Scenario: Reject a composition rule when referenced patterns do not exist
    When I POST to "/api/v1/composition-rules" with:
      | field      | value           |
      | patternAId | no-such-pattern |
      | patternBId | also-none       |
      | relation   | NESTING_ALLOWED |
    Then the response status should be 400 or 404
    And the error should include "PATTERN_NOT_FOUND"
