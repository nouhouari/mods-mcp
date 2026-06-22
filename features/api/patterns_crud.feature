@api @US-001
Feature: Pattern CRUD Operations
  As a design system author
  I want to create, read, update, and delete design patterns
  So that I can manage the pattern library effectively

  Background:
    Given the patterns API is accessible
    And the database is empty

  @US-001-create
  Scenario: Create a new pattern successfully
    When I POST to "/api/v1/patterns" with:
      | field    | value     |
      | id       | button    |
      | name     | Button    |
      | category | component |
    Then the response status should be 201
    And the response should contain:
      | field | value  |
      | id    | button |
      | name  | Button |

  @US-001-create-invalid
  Scenario: Reject pattern creation with missing required fields
    When I POST to "/api/v1/patterns" with:
      | field | value  |
      | id    | btn    |
      | name  | Button |
    Then the response status should be 400
    And the error should include "category"

  @US-001-read
  Scenario: Retrieve a pattern by ID
    Given a pattern exists with id "card" and name "Card"
    When I GET "/api/v1/patterns/{pattern_id}"
    Then the response status should be 200
    And the response body should match the stored pattern

  @US-001-read-notfound
  Scenario: Return 404 when pattern does not exist
    When I GET "/api/v1/patterns/non-existent"
    Then the response status should be 404
    And the error should include "PATTERN_NOT_FOUND"

  @US-001-list
  Scenario: List all patterns
    Given patterns exist:
      | id    | name   | category  |
      | btn   | Button | component |
      | card  | Card   | component |
      | modal | Modal  | container |
    When I GET "/api/v1/patterns"
    Then the response status should be 200
    And the response should contain a list of 3 patterns

  @US-001-update
  Scenario: Update an existing pattern
    Given a pattern exists with id "upd-btn" and name "Button"
    When I PATCH "/api/v1/patterns/{pattern_id}" with:
      | field       | value        |
      | description | Updated docs |
    Then the response status should be 200
    And the response should contain:
      | field | value  |
      | name  | Button |

  @US-001-delete
  Scenario: Delete a pattern
    Given a pattern exists with name "dep-btn"
    When I DELETE "/api/v1/patterns/{pattern_id}"
    Then the response status should be 204
    And the pattern should no longer exist in the database

  @US-001-delete-notfound
  Scenario: Return 404 when deleting non-existent pattern
    When I DELETE "/api/v1/patterns/non-existent"
    Then the response status should be 404
