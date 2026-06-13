@api @mcp
Feature: C-mcp REST Validate Endpoint

  Background:
    Given the MCP server is running with secret "test-secret-123"

  @US-027
  Scenario: POST /api/validate/color-pair black on white passes
    When I POST "/api/validate/color-pair" with bearer token "test-secret-123" and body:
      """
      {"fg":"#000000","bg":"#FFFFFF","context":"normal"}
      """
    Then the response status is 200
    And the contrast result passes
    And the response body has "ratio" equal to float 21.0

  @US-027
  Scenario: POST /api/validate/color-pair #777777 on white fails
    When I POST "/api/validate/color-pair" with bearer token "test-secret-123" and body:
      """
      {"fg":"#777777","bg":"#FFFFFF","context":"normal"}
      """
    Then the response status is 200
    And the contrast result fails

  @US-027
  Scenario: POST /api/validate/color-pair with invalid color returns 400
    When I POST "/api/validate/color-pair" with bearer token "test-secret-123" and body:
      """
      {"fg":"notacolor","bg":"#FFFFFF","context":"normal"}
      """
    Then the response status is 400
    And the response error code is "INVALID_COLOR_FORMAT"
