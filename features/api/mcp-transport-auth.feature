@api @mcp
Feature: C-mcp Transport Authentication (@US-026)

  Background:
    Given the MCP server is running with secret "test-secret-123"

  @US-026
  Scenario: Health endpoint returns 200 without auth
    When I GET "/health" without auth
    Then the response status is 200
    And the response body has "status" equal to "ok"

  @US-026
  Scenario: POST /mcp without auth returns 401 MISSING_AUTH_HEADER
    When I POST "/mcp" without auth with body '{"jsonrpc":"2.0","id":1,"method":"list_projects","params":{}}'
    Then the response status is 401
    And the response error code is "MISSING_AUTH_HEADER"

  @US-026
  Scenario: POST /mcp with Basic auth returns 401 INVALID_AUTH_SCHEME
    When I POST "/mcp" with Authorization header "Basic dXNlcjpwYXNz" and body '{"jsonrpc":"2.0","id":2,"method":"list_projects","params":{}}'
    Then the response status is 401
    And the response error code is "INVALID_AUTH_SCHEME"

  @US-026
  Scenario: POST /mcp with wrong bearer token returns 401 INVALID_TOKEN
    When I POST "/mcp" with bearer token "wrong-token" and body:
      """
      {"jsonrpc":"2.0","id":3,"method":"list_projects","params":{}}
      """
    Then the response status is 401
    And the response error code is "INVALID_TOKEN"

  @US-026
  Scenario: POST /mcp with empty bearer token returns 401 INVALID_TOKEN
    When I POST "/mcp" with Authorization header "Bearer " and body '{"jsonrpc":"2.0","id":4,"method":"list_projects","params":{}}'
    Then the response status is 401
    And the response error code is "INVALID_TOKEN"

  @US-026
  Scenario: POST /mcp with correct bearer returns 200
    When I POST "/mcp" with bearer token "test-secret-123" and body:
      """
      {"jsonrpc":"2.0","id":5,"method":"list_projects","params":{}}
      """
    Then the response status is 200
    And the MCP result is an array
