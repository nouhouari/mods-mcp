@api @mcp @US-P4-001
Feature: Design System Visual Showcase
  As a ui-ux AI agent
  I want to call generate_showcase via MCP
  So I can get a self-contained HTML preview of a project's design system

  Background:
    Given the MCP server is running with secret "test-secret"
    And the database is empty

  # ---------------------------------------------------------------------------
  # @US-P4-001-basic — happy path: project with tokens and components
  # ---------------------------------------------------------------------------

  @US-P4-001-basic
  Scenario: Generate showcase for a project with tokens and components
    Given a project "showcase-ds" exists in the registry
    And a MCP token "color.primary" with category "color" and value "#3B82F6" in project "showcase-ds"
    And a MCP component "btn" named "Button" in project "showcase-ds"
    When I call the MCP write method "generate_showcase" with JSON params:
      """
      {"projectId": "showcase-ds"}
      """
    Then the response status is 200
    And the MCP result field "html" should be a non-empty string
    And the MCP result field "tokenCount" should be 1
    And the MCP result field "componentCount" should be 1

  # ---------------------------------------------------------------------------
  # @US-P4-001-css-vars — generated HTML embeds CSS custom properties for tokens
  # ---------------------------------------------------------------------------

  @US-P4-001-css-vars
  Scenario: Generated HTML contains CSS custom property for color token
    Given a project "css-ds" exists in the registry
    And a MCP token "color.brand" with category "color" and value "#FF5733" in project "css-ds"
    When I call the MCP write method "generate_showcase" with JSON params:
      """
      {"projectId": "css-ds"}
      """
    Then the response status is 200
    And the MCP result HTML should contain "--token-color-brand"
    And the MCP result HTML should contain "#FF5733"

  # ---------------------------------------------------------------------------
  # @US-P4-001-component-names — generated HTML lists component names
  # ---------------------------------------------------------------------------

  @US-P4-001-component-names
  Scenario: Generated HTML contains component names
    Given a project "comp-ds" exists in the registry
    And a MCP component "my-btn" named "PrimaryButton" in project "comp-ds"
    When I call the MCP write method "generate_showcase" with JSON params:
      """
      {"projectId": "comp-ds"}
      """
    Then the response status is 200
    And the MCP result HTML should contain "PrimaryButton"

  # ---------------------------------------------------------------------------
  # @US-P4-001-counts — tokenCount, componentCount, patternCount match reality
  # ---------------------------------------------------------------------------

  @US-P4-001-counts
  Scenario: tokenCount and componentCount match registered items
    Given a project "count-ds" exists in the registry
    And a MCP token "color.a" with category "color" and value "#aaa" in project "count-ds"
    And a MCP token "color.b" with category "color" and value "#bbb" in project "count-ds"
    And a MCP component "c1" named "Card" in project "count-ds"
    When I call the MCP write method "generate_showcase" with JSON params:
      """
      {"projectId": "count-ds"}
      """
    Then the response status is 200
    And the MCP result field "tokenCount" should be 2
    And the MCP result field "componentCount" should be 1
    And the MCP result field "patternCount" should be 0

  # ---------------------------------------------------------------------------
  # @US-P4-001-empty — empty project returns valid HTML with zero counts
  # ---------------------------------------------------------------------------

  @US-P4-001-empty
  Scenario: Generate showcase for an empty project returns valid HTML with zero counts
    Given a project "empty-ds" exists in the registry
    When I call the MCP write method "generate_showcase" with JSON params:
      """
      {"projectId": "empty-ds"}
      """
    Then the response status is 200
    And the MCP result field "html" should be a non-empty string
    And the MCP result field "tokenCount" should be 0
    And the MCP result field "componentCount" should be 0
    And the MCP result field "patternCount" should be 0

  # ---------------------------------------------------------------------------
  # @US-P4-001-not-found — non-existent project returns PROJECT_NOT_FOUND error
  # ---------------------------------------------------------------------------

  @US-P4-001-not-found
  Scenario: Return error when project does not exist
    When I call the MCP write method "generate_showcase" with JSON params:
      """
      {"projectId": "ghost-project"}
      """
    Then the MCP error code should include "PROJECT_NOT_FOUND"
