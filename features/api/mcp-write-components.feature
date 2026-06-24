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

  # ---------------------------------------------------------------------------
  # @regression-child-owned-component — a component created directly on a CHILD
  # project must be readable (get_component_spec) and must appear in that child's
  # generate_showcase, shown before inherited parent components.
  # Regression for: child-owned components missing from generate_showcase.
  # ---------------------------------------------------------------------------

  @regression-child-owned-component
  Scenario: Component created on a child project is readable and shown in its showcase
    Given a child project "comp-child" with parentId "comp-proj" exists
    When I call the MCP write method "create_component" with JSON params:
      """
      {"projectId":"comp-child","id":"childbtn","name":"ChildButton","variants":["solid","ghost"]}
      """
    Then the response status is 200
    And the MCP result field "name" equals "ChildButton"
    When I POST "/mcp" with bearer token "test-secret" and body:
      """
      {"jsonrpc":"2.0","id":1,"method":"get_component_spec","params":{"projectId":"comp-child","componentId":"childbtn"}}
      """
    Then the response status is 200
    And the MCP result has an "id" property
    When I call the MCP write method "generate_showcase" with JSON params:
      """
      {"projectId":"comp-child"}
      """
    Then the response status is 200
    And the MCP result HTML should contain "ChildButton"

  # ---------------------------------------------------------------------------
  # @regression-child-owned-update — updating a CHILD-OWNED component must persist
  # structured fields. updateSpec/deleteSpec previously only matched root base
  # specs (findBaseSpec), so update returned COMPONENT_NOT_FOUND and the fields
  # passed (variants/states/props) were silently never written.
  # Regression for: "props/variants/states empty after update_component".
  # ---------------------------------------------------------------------------

  @regression-child-owned-update
  Scenario: Updating a child-owned component persists structured fields
    Given a child project "upd-child" with parentId "comp-proj" exists
    When I call the MCP write method "create_component" with JSON params:
      """
      {"projectId":"upd-child","id":"ubtn","name":"UpdBtn"}
      """
    Then the response status is 200
    And the MCP result field "version" should be 0
    When I call the MCP write method "update_component" with JSON params:
      """
      {"projectId":"upd-child","componentId":"ubtn","version":0,"variants":["solid","outline","ghost"],"states":["hover"]}
      """
    Then the response status is 200
    And the MCP result field "version" should be 1
    When I call the MCP write method "generate_showcase" with JSON params:
      """
      {"projectId":"upd-child"}
      """
    Then the response status is 200
    And the MCP result HTML should contain "outline"
    When I call the MCP write method "delete_component" with JSON params:
      """
      {"projectId":"upd-child","componentId":"ubtn"}
      """
    Then the response status is 200
    And the MCP result has success true

  # ---------------------------------------------------------------------------
  # @regression-structured-field-object-shape — variants/states/props accept an
  # object map (e.g. {primary:{description}}), not only an array of strings. The
  # read path previously coerced any non-array to [] (silent data loss), so an
  # object value was stored but returned empty. Both shapes must round-trip and
  # render in the showcase. Regression for the exact reporter payload.
  # ---------------------------------------------------------------------------

  @regression-structured-field-object-shape
  Scenario: Component variants accept an object map and round-trip
    Given a project "shape-proj" exists in the registry
    When I call the MCP write method "create_component" with JSON params:
      """
      {"projectId":"shape-proj","id":"button","name":"Button"}
      """
    Then the response status is 200
    When I call the MCP write method "update_component" with JSON params:
      """
      {"projectId":"shape-proj","componentId":"button","version":0,"variants":{"primary":{"description":"test"}}}
      """
    Then the response status is 200
    When I POST "/mcp" with bearer token "test-secret" and body:
      """
      {"jsonrpc":"2.0","id":1,"method":"get_component_spec","params":{"projectId":"shape-proj","componentId":"button"}}
      """
    Then the response status is 200
    And the MCP result has a "variants" property
    When I call the MCP write method "generate_showcase" with JSON params:
      """
      {"projectId":"shape-proj"}
      """
    Then the response status is 200
    And the MCP result HTML should contain "primary"
