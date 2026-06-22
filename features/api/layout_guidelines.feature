@api @US-004
Feature: Layout Guidelines
  As a design system curator
  I want to define layout guidelines for patterns
  So that patterns are positioned and sized consistently

  Background:
    Given the patterns API is accessible
    And the database is empty

  @US-004-create
  Scenario: Create a layout guideline
    When I POST to "/api/v1/layout-guidelines" with:
      | field       | value                          |
      | type        | breakpoints                    |
      | name        | mobile-breakpoints             |
      | data        | {"sm":480,"md":768,"lg":1024}  |
    Then the response status should be 201
    And the response should contain guideline data

  @US-004-list
  Scenario: List all layout guidelines
    Given layout guidelines exist:
      | name    |
      | mobile  |
      | tablet  |
      | desktop |
    When I GET "/api/v1/layout-guidelines"
    Then the response status should be 200
    And the response should contain 3 guideline objects

  @US-004-get-by-id
  Scenario: Get a layout guideline by ID
    Given layout guidelines exist:
      | name   |
      | gl-one |
    And a layout guideline "gl-one" exists
    When I GET "/api/v1/layout-guidelines/{guideline_id}"
    Then the response status should be 200
    And the response should contain guideline data

  @US-004-update
  Scenario: Update a layout guideline
    Given a layout guideline "upd-gl" with min_width 200 exists
    When I PATCH "/api/v1/layout-guidelines/{guideline_id}" with:
      | field | value           |
      | data  | {"minWidth":300} |
    Then the response status should be 200
    And the guideline min_width should be 300

  @US-004-delete
  Scenario: Delete a layout guideline
    Given a layout guideline "dep-gl" exists
    When I DELETE "/api/v1/layout-guidelines/{guideline_id}"
    Then the response status should be 204
    And the guideline should no longer exist

  @US-004-invalid-type
  Scenario: Reject layout guideline with invalid type
    When I POST to "/api/v1/layout-guidelines" with:
      | field | value        |
      | type  | invalid-type |
      | name  | test         |
    Then the response status should be 400
    And the error should include "type"
