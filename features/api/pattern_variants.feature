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
    When I POST to "/api/v1/patterns/{pattern_id}/variants" with:
      | field     | value   |
      | name      | primary |
      | appliesAt | mobile  |
    Then the response status should be 201
    And the response should contain:
      | field | value   |
      | name  | primary |

  @US-002-list-variants
  Scenario: List all variants for a pattern
    Given a pattern exists with name "btn-list"
    And the pattern has variants:
      | name      | appliesAt |
      | primary   | mobile    |
      | secondary | tablet    |
      | disabled  | desktop   |
    When I GET "/api/v1/patterns/{pattern_id}/variants"
    Then the response status should be 200
    And the response should contain 3 variant objects

  @US-002-get-variant
  Scenario: Retrieve a specific variant
    Given a pattern exists with name "btn-get"
    And a variant "primary" exists for the pattern
    When I GET "/api/v1/patterns/{pattern_id}/variants/{variant_id}"
    Then the response status should be 200
    And the response should contain:
      | field | value   |
      | name  | primary |

  @US-002-update-variant
  Scenario: Update variant properties
    Given a pattern exists with name "btn-upd"
    And a variant "primary" exists for the pattern
    When I PATCH "/api/v1/patterns/{pattern_id}/variants/{variant_id}" with:
      | field     | value   |
      | name      | primary |
      | appliesAt | tablet  |
    Then the response status should be 200
    And the response should contain:
      | field     | value  |
      | appliesAt | tablet |

  @US-002-delete-variant
  Scenario: Delete a variant
    Given a pattern exists with name "btn-del"
    And a variant "deprecated" exists for the pattern
    When I DELETE "/api/v1/patterns/{pattern_id}/variants/{variant_id}"
    Then the response status should be 204
    And the variant should no longer exist

  @US-002-duplicate-variant
  Scenario: Reject duplicate variant name within a pattern
    Given a pattern exists with name "btn-dup"
    And a variant "primary" exists for the pattern
    When I POST to "/api/v1/patterns/{pattern_id}/variants" with:
      | field     | value   |
      | name      | primary |
      | appliesAt | mobile  |
    Then the response status should be 400
