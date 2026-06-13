@api @mcp
Feature: C-mcp REST Projects CRUD

  Background:
    Given the MCP server is running with secret "test-secret-123"

  @US-040
  Scenario: GET /api/projects returns empty array initially
    When I GET "/api/projects" with bearer token "test-secret-123"
    Then the response status is 200
    And the response body is a JSON array

  @US-040
  Scenario: POST /api/projects creates a project
    When I POST "/api/projects" with bearer token "test-secret-123" and body:
      """
      {"id":"proj-new","name":"New Project"}
      """
    Then the response status is 201
    And the response body has "id" equal to "proj-new"

  @US-040
  Scenario: GET /api/projects/:id returns the project
    Given a project "proj-get" exists in the registry
    When I GET "/api/projects/proj-get" with bearer token "test-secret-123"
    Then the response status is 200
    And the response body has "id" equal to "proj-get"

  @US-040
  Scenario: GET /api/projects/:id for unknown project returns 404
    When I GET "/api/projects/no-such-project" with bearer token "test-secret-123"
    Then the response status is 404
    And the response error code is "PROJECT_NOT_FOUND"

  @US-040
  Scenario: POST /api/projects with duplicate id returns 409
    Given a project "proj-dup" exists in the registry
    When I POST "/api/projects" with bearer token "test-secret-123" and body:
      """
      {"id":"proj-dup","name":"Duplicate"}
      """
    Then the response status is 409
    And the response error code is "DUPLICATE_PROJECT_ID"

  @US-040
  Scenario: DELETE /api/projects/:id returns 204
    Given a project "proj-del" exists in the registry
    When I DELETE "/api/projects/proj-del" with bearer token "test-secret-123"
    Then the response status is 204
