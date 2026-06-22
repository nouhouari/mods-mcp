@api @mcp @US-P3-003
Feature: Component Management via MCP Write Tools

  Background:
    Given the MCP server is running with secret "test-secret"
    And a project "comp-proj" exists in the registry

  # ---------------------------------------------------------------------------
  # @US-P3-003-create-component — happy path
  # ---------------------------------------------------------------------------

  @US-P3-003-create-component
  Scenario: Create a component via MCP write tool
    When I call the MCP write method "create_component" with JSON params:
      """
      {"projectId":"comp-proj","id":"btn","name":"Button","description":"A primary button component"}
      """
    Then the response status is 200
    And the MCP result field "id" equals "btn"
    And the MCP result field "name" equals "Button"

  # ---------------------------------------------------------------------------
  # @US-P3-003-get-component-after-create — read back via get_component_spec
  # ---------------------------------------------------------------------------

  @US-P3-003-get-component-after-create
  Scenario: Get a component spec after creating it via MCP
    Given a MCP component "card" named "Card" in project "comp-proj"
    When I POST "/mcp" with bearer token "test-secret" and body:
      """
      {"jsonrpc":"2.0","id":1,"method":"get_component_spec","params":{"projectId":"comp-proj","componentId":"card"}}
      """
    Then the response status is 200
    And the MCP result has an "id" property

  # ---------------------------------------------------------------------------
  # @US-P3-003-update-component — description update with version
  # ---------------------------------------------------------------------------

  @US-P3-003-update-component
  Scenario: Update a component description via MCP write tool
    Given a MCP component "input" named "Input" in project "comp-proj"
    When I call the MCP write method "get_component_spec_raw" via mcp for project "comp-proj" component "input"
    When I call the MCP write method "update_component" with the stored component version for project "comp-proj" component "input" and description "Updated input component description"
    Then the response status is 200
    And the MCP result field "description" equals "Updated input component description"

  # ---------------------------------------------------------------------------
  # @US-P3-003-delete-component — deletion returns success
  # ---------------------------------------------------------------------------

  @US-P3-003-delete-component
  Scenario: Delete a component via MCP write tool
    Given a MCP component "icon" named "Icon" in project "comp-proj"
    When I call the MCP write method "delete_component" with JSON params:
      """
      {"projectId":"comp-proj","componentId":"icon"}
      """
    Then the response status is 200
    And the MCP result has success true
