@mcp-server
Feature: C-mcp HTTP Server

  Background:
    Given the MCP server is running with secret "test-secret"

  # ---------------------------------------------------------------------------
  # @US-040 — Transport and authentication
  # ---------------------------------------------------------------------------

  @US-040
  Scenario: Health endpoint returns 200 without auth
    When I GET "/health" without auth
    Then the response status is 200
    And the response body has "status" equal to "ok"

  @US-040
  Scenario: List projects with valid bearer token returns 200
    When I GET "/api/projects" with bearer token "test-secret"
    Then the response status is 200
    And the response body is a JSON array

  @US-040
  Scenario: Missing Authorization header returns 401 MISSING_AUTH_HEADER
    When I GET "/api/projects" without auth
    Then the response status is 401
    And the response error code is "MISSING_AUTH_HEADER"

  @US-040
  Scenario: Invalid bearer token returns 401 INVALID_TOKEN
    When I GET "/api/projects" with bearer token "wrong-token"
    Then the response status is 401
    And the response error code is "INVALID_TOKEN"

  # ---------------------------------------------------------------------------
  # @US-015 — get_tokens MCP tool
  # ---------------------------------------------------------------------------

  @US-015
  Scenario: get_tokens returns token array for existing project
    Given a project "base" exists in the registry
    When I POST "/mcp" with bearer token "test-secret" and body:
      """
      {"jsonrpc":"2.0","id":1,"method":"get_tokens","params":{"projectId":"base"}}
      """
    Then the response status is 200
    And the MCP result is an array

  @US-015
  Scenario: get_tokens filtered by category
    Given a project "base" exists in the registry
    When I POST "/mcp" with bearer token "test-secret" and body:
      """
      {"jsonrpc":"2.0","id":2,"method":"get_tokens","params":{"projectId":"base","category":"color"}}
      """
    Then the response status is 200
    And the MCP result is an array

  @US-015
  Scenario: get_tokens for unknown project returns JSON-RPC error
    When I POST "/mcp" with bearer token "test-secret" and body:
      """
      {"jsonrpc":"2.0","id":3,"method":"get_tokens","params":{"projectId":"unknown"}}
      """
    Then the response status is 200
    And the MCP response contains an error

  # ---------------------------------------------------------------------------
  # @US-024 — get_design_system MCP tool
  # ---------------------------------------------------------------------------

  @US-024
  Scenario: get_design_system returns tokens object and components array
    Given a project "base" exists in the registry
    When I POST "/mcp" with bearer token "test-secret" and body:
      """
      {"jsonrpc":"2.0","id":4,"method":"get_design_system","params":{"projectId":"base"}}
      """
    Then the response status is 200
    And the MCP result has a "tokens" property
    And the MCP result has a "components" property

  @US-024
  Scenario: get_design_system for unknown project returns JSON-RPC error
    When I POST "/mcp" with bearer token "test-secret" and body:
      """
      {"jsonrpc":"2.0","id":5,"method":"get_design_system","params":{"projectId":"unknown"}}
      """
    Then the response status is 200
    And the MCP response contains an error

  # ---------------------------------------------------------------------------
  # @US-025 — get_component_spec MCP tool
  # ---------------------------------------------------------------------------

  @US-025
  Scenario: get_component_spec returns resolved spec
    Given a project "base" exists in the registry
    And a component "btn" exists in project "base"
    When I POST "/mcp" with bearer token "test-secret" and body:
      """
      {"jsonrpc":"2.0","id":6,"method":"get_component_spec","params":{"projectId":"base","componentId":"btn"}}
      """
    Then the response status is 200
    And the MCP result has an "id" property

  @US-025
  Scenario: get_component_spec for unknown component returns JSON-RPC error
    Given a project "base" exists in the registry
    When I POST "/mcp" with bearer token "test-secret" and body:
      """
      {"jsonrpc":"2.0","id":7,"method":"get_component_spec","params":{"projectId":"base","componentId":"ghost"}}
      """
    Then the response status is 200
    And the MCP response contains an error
