@api @mcp
Feature: C-mcp Validate MCP Tools

  Background:
    Given the MCP server is running with secret "test-secret-123"

  @US-027
  Scenario: validate_color_pair black on white passes
    When I POST "/mcp" with bearer token "test-secret-123" and body:
      """
      {"jsonrpc":"2.0","id":1,"method":"validate_color_pair","params":{"fg":"#000000","bg":"#FFFFFF","context":"normal"}}
      """
    Then the response status is 200
    And the contrast result passes
    And the response body has "result.ratio" equal to float 21.0

  @US-027
  Scenario: validate_color_pair #777777 on white normal fails
    When I POST "/mcp" with bearer token "test-secret-123" and body:
      """
      {"jsonrpc":"2.0","id":2,"method":"validate_color_pair","params":{"fg":"#777777","bg":"#FFFFFF","context":"normal"}}
      """
    Then the response status is 200
    And the contrast result fails

  @US-027
  Scenario: validate_color_pair #777777 on white large passes
    When I POST "/mcp" with bearer token "test-secret-123" and body:
      """
      {"jsonrpc":"2.0","id":3,"method":"validate_color_pair","params":{"fg":"#777777","bg":"#FFFFFF","context":"large"}}
      """
    Then the response status is 200
    And the contrast result passes

  @US-027
  Scenario: validate_color_pair with invalid color returns JSON-RPC error
    When I POST "/mcp" with bearer token "test-secret-123" and body:
      """
      {"jsonrpc":"2.0","id":4,"method":"validate_color_pair","params":{"fg":"notacolor","bg":"#FFFFFF","context":"normal"}}
      """
    Then the response status is 200
    And the MCP response contains an error

  @US-028
  Scenario: validate_token_pair with valid tokens returns result
    Given a project "ds-base" exists in the registry
    And token "color.fg" with value "#000000" and category "color" exists in project "ds-base"
    And token "color.bg" with value "#FFFFFF" and category "color" exists in project "ds-base"
    When I POST "/mcp" with bearer token "test-secret-123" and body:
      """
      {"jsonrpc":"2.0","id":5,"method":"validate_token_pair","params":{"projectId":"ds-base","fgKey":"color.fg","bgKey":"color.bg","context":"normal"}}
      """
    Then the response status is 200
    And the MCP result has a "passes" property

  @US-028
  Scenario: validate_token_pair with missing project returns JSON-RPC error
    When I POST "/mcp" with bearer token "test-secret-123" and body:
      """
      {"jsonrpc":"2.0","id":6,"method":"validate_token_pair","params":{"projectId":"ghost","fgKey":"fg","bgKey":"bg","context":"normal"}}
      """
    Then the response status is 200
    And the MCP response contains an error

  @US-029
  Scenario: validate_snippet with valid HTML returns result
    When I POST "/mcp" with bearer token "test-secret-123" and body:
      """
      {"jsonrpc":"2.0","id":7,"method":"validate_snippet","params":{"content":"<p style=\"color:#000000; background-color:#FFFFFF\">Hello</p>"}}
      """
    Then the response status is 200
    And the MCP result has a "passes" property

  @US-029
  Scenario: validate_snippet with contrast violation returns passes false
    When I POST "/mcp" with bearer token "test-secret-123" and body:
      """
      {"jsonrpc":"2.0","id":8,"method":"validate_snippet","params":{"content":"<p style=\"color:#777777; background-color:#FFFFFF\">Hello</p>"}}
      """
    Then the response status is 200
    And the contrast result fails
