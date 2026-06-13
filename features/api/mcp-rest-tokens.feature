@api @mcp
Feature: C-mcp REST Tokens

  Background:
    Given the MCP server is running with secret "test-secret"

  @US-015
  Scenario: GET /api/projects/:id/tokens returns empty array for new project
    Given a project "tok-proj" exists in the registry
    When I GET "/api/projects/tok-proj/tokens" with bearer token "test-secret"
    Then the response status is 200
    And the response body is a JSON array

  @US-015
  Scenario: DELETE /api/projects/:id/tokens/:key/override returns 204 (idempotent)
    Given a project "tok-proj2" exists in the registry
    When I DELETE "/api/projects/tok-proj2/tokens/color.primary/override" with bearer token "test-secret"
    Then the response status is 204

  # ---------------------------------------------------------------------------
  # @US-060 — OCC body validation: validate version before setOverride
  # ---------------------------------------------------------------------------

  @US-060
  Scenario: PUT token override without version in body returns 400 MISSING_VERSION
    Given a project "occ-proj" exists in the registry
    When I PUT "/api/projects/occ-proj/tokens/color.primary" with bearer token "test-secret" and body:
      """
      {"value": "#ff0000"}
      """
    Then the response status is 400
    And the response body has error code "MISSING_VERSION"

  @US-060
  Scenario: PUT token override with non-number version returns 400 INVALID_VERSION
    Given a project "occ-proj2" exists in the registry
    When I PUT "/api/projects/occ-proj2/tokens/color.primary" with bearer token "test-secret" and body:
      """
      {"value": "#ff0000", "version": "not-a-number"}
      """
    Then the response status is 400
    And the response body has error code "INVALID_VERSION"

  @US-060
  Scenario: PUT token override with stale version returns 409 CONFLICT without currentVersion
    Given a project "occ-proj3" exists in the registry
    And a token "color.primary" of category "color" with value "#000000" exists in "occ-proj3"
    When I PUT "/api/projects/occ-proj3/tokens/color.primary" with bearer token "test-secret" and body:
      """
      {"value": "#ff0000", "version": 99}
      """
    Then the response status is 409
    And the response body has error code "CONFLICT"
    And the response body does not contain "currentVersion"
