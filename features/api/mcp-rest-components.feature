@api @mcp
Feature: C-mcp REST Components

  Background:
    Given the MCP server is running with secret "test-secret"

  @US-025
  Scenario: GET /api/projects/:id/components returns array
    Given a project "comp-proj" exists in the registry
    When I GET "/api/projects/comp-proj/components" with bearer token "test-secret"
    Then the response status is 200
    And the response body is a JSON array

  @US-025
  Scenario: GET /api/projects/:id/components/:componentId returns component
    Given a project "comp-proj2" exists in the registry
    And a component "btn" exists in project "comp-proj2"
    When I GET "/api/projects/comp-proj2/components/btn" with bearer token "test-secret"
    Then the response status is 200
    And the response body has "id" equal to "btn"

  @US-025
  Scenario: GET /api/projects/:id/components/nonexistent returns 404
    Given a project "comp-proj3" exists in the registry
    When I GET "/api/projects/comp-proj3/components/ghost-component" with bearer token "test-secret"
    Then the response status is 404
    And the response error code is "COMPONENT_NOT_FOUND"
