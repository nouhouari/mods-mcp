@api @mcp
Feature: C-mcp REST Tokens

  Background:
    Given the MCP server is running with secret "test-secret-123"

  @US-015
  Scenario: GET /api/projects/:id/tokens returns empty array for new project
    Given a project "tok-proj" exists in the registry
    When I GET "/api/projects/tok-proj/tokens" with bearer token "test-secret-123"
    Then the response status is 200
    And the response body is a JSON array

  @US-015
  Scenario: DELETE /api/projects/:id/tokens/:key/override returns 204 (idempotent)
    Given a project "tok-proj2" exists in the registry
    When I DELETE "/api/projects/tok-proj2/tokens/color.primary/override" with bearer token "test-secret-123"
    Then the response status is 204
