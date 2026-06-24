@api @mcp @US-P3-002
Feature: Token Management via MCP Write Tools

  Background:
    Given the MCP server is running with secret "test-secret"
    And a project "tok-proj" exists in the registry

  # ---------------------------------------------------------------------------
  # @US-P3-002-create-token — happy path
  # ---------------------------------------------------------------------------

  @US-P3-002-create-token
  Scenario: Create a token via MCP write tool
    When I call the MCP write method "create_token" with JSON params:
      """
      {"projectId":"tok-proj","key":"color.primary","category":"color","value":"#3B82F6"}
      """
    Then the response status is 200
    And the MCP result field "key" equals "color.primary"
    And the MCP result field "value" equals "#3B82F6"
    And the MCP result field "category" equals "color"

  # ---------------------------------------------------------------------------
  # @US-P3-002-list-tokens — list after create
  # ---------------------------------------------------------------------------

  @US-P3-002-list-tokens
  Scenario: List tokens for a project via MCP write tool
    Given a MCP token "spacing.sm" with category "spacing" and value "4px" in project "tok-proj"
    And a MCP token "spacing.md" with category "spacing" and value "8px" in project "tok-proj"
    When I call the MCP write method "list_tokens" with JSON params:
      """
      {"projectId":"tok-proj"}
      """
    Then the response status is 200
    And the MCP result is an array

  # ---------------------------------------------------------------------------
  # @US-P3-002-get-token — single token fetch
  # ---------------------------------------------------------------------------

  @US-P3-002-get-token
  Scenario: Get a single token via MCP write tool
    Given a MCP token "color.accent" with category "color" and value "#F59E0B" in project "tok-proj"
    When I call the MCP write method "get_token" with JSON params:
      """
      {"projectId":"tok-proj","key":"color.accent"}
      """
    Then the response status is 200
    And the MCP result field "value" equals "#F59E0B"

  # ---------------------------------------------------------------------------
  # @US-P3-002-update-token — optimistic-concurrency token update
  # ---------------------------------------------------------------------------

  @US-P3-002-update-token
  Scenario: Update a token value via MCP using version from get_token
    Given a MCP token "color.bg" with category "color" and value "#FFFFFF" in project "tok-proj"
    When I call the MCP write method "get_token" with JSON params:
      """
      {"projectId":"tok-proj","key":"color.bg"}
      """
    Then the response status is 200
    When I call the MCP write method "update_token" with the stored version for project "tok-proj" key "color.bg" and value "#F0F0F0"
    Then the response status is 200
    And the MCP result field "value" equals "#F0F0F0"

  # ---------------------------------------------------------------------------
  # @US-P3-002-delete-token — token deletion with version
  # ---------------------------------------------------------------------------

  @US-P3-002-delete-token
  Scenario: Delete a token via MCP using version from get_token
    Given a MCP token "font.size.base" with category "typography" and value "16px" in project "tok-proj"
    When I call the MCP write method "get_token" with JSON params:
      """
      {"projectId":"tok-proj","key":"font.size.base"}
      """
    Then the response status is 200
    When I call the MCP write method "delete_token" with the stored version for project "tok-proj" key "font.size.base"
    Then the response status is 200
    And the MCP result has success true

  # ---------------------------------------------------------------------------
  # @US-P3-002-token-not-found — missing token returns error
  # ---------------------------------------------------------------------------

  @US-P3-002-token-not-found
  Scenario: Getting a non-existent token returns TOKEN_NOT_FOUND error
    When I call the MCP write method "get_token" with JSON params:
      """
      {"projectId":"tok-proj","key":"no.such.token"}
      """
    Then the response status is 200
    And the MCP error code should include "TOKEN_NOT_FOUND"

  # ---------------------------------------------------------------------------
  # @regression-token-categories — border / motion / other were advertised by the
  # tool schema and rendered by the showcase but rejected by the app validator
  # and the DB CHECK constraint. All nine canonical categories must be accepted.
  # ---------------------------------------------------------------------------

  @regression-token-categories
  Scenario Outline: Create tokens for every canonical category
    When I call the MCP write method "create_token" with JSON params:
      """
      {"projectId":"tok-proj","key":"k.<category>","category":"<category>","value":"4px"}
      """
    Then the response status is 200
    And the MCP result field "category" equals "<category>"

    Examples:
      | category   |
      | color      |
      | typography |
      | spacing    |
      | radius     |
      | shadow     |
      | breakpoint |
      | border     |
      | motion     |
      | other      |
