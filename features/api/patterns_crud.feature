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
    When I POST to /api/v1/patterns with:
      | field       | value                                   |
      | name        | Button                                  |
      | description | Clickable button component              |
      | category    | component                              |
      | version     | 1.0.0                                   |
    Then the response status should be 201
    And the response should contain:
      | field   | value  |
      | id      | <uuid> |
      | name    | Button |
      | version | 1.0.0  |

  @US-001-create-invalid
  Scenario: Reject pattern creation with missing required fields
    When I POST to /api/v1/patterns with:
      | field   | value      |
      | name    | Button     |
    Then the response status should be 400
    And the error should include "description is required"

  @US-001-read
  Scenario: Retrieve a pattern by ID
    Given a pattern exists with:
      | name    | Card           |
      | version | 1.0.0          |
    When I GET /api/v1/patterns/{pattern_id}
    Then the response status should be 200
    And the response body should match the stored pattern

  @US-001-read-notfound
  Scenario: Return 404 when pattern does not exist
    When I GET /api/v1/patterns/invalid-uuid
    Then the response status should be 404
    And the error should include "Pattern not found"

  @US-001-list
  Scenario: List all patterns with pagination
    Given patterns exist:
      | name    | category   |
      | Button  | component  |
      | Card    | component  |
      | Modal   | container  |
    When I GET /api/v1/patterns?limit=2&offset=0
    Then the response status should be 200
    And the response should contain a list of 2 patterns
    And the pagination metadata should indicate:
      | field  | value |
      | total  | 3     |
      | limit  | 2     |
      | offset | 0     |

  @US-001-update
  Scenario: Update an existing pattern
    Given a pattern exists with:
      | name    | Button             |
      | version | 1.0.0              |
    When I PATCH /api/v1/patterns/{pattern_id} with:
      | field       | value                             |
      | description | Updated button documentation      |
      | version     | 1.1.0                             |
    Then the response status should be 200
    And the response should contain:
      | field   | value                             |
      | name    | Button                            |
      | version | 1.1.0                             |

  @US-001-delete
  Scenario: Delete a pattern
    Given a pattern exists with name "Deprecated Button"
    When I DELETE /api/v1/patterns/{pattern_id}
    Then the response status should be 204
    And the pattern should no longer exist in the database

  @US-001-delete-notfound
  Scenario: Return 404 when deleting non-existent pattern
    When I DELETE /api/v1/patterns/invalid-uuid
    Then the response status should be 404
