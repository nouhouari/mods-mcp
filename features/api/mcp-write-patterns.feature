@api @mcp @US-P3-004
Feature: Pattern Library Management via MCP Write Tools

  Background:
    Given the MCP server is running with secret "test-secret"
    And a project "pat-proj" exists in the registry

  # ---------------------------------------------------------------------------
  # @US-P3-004-create-pattern — happy path
  # ---------------------------------------------------------------------------

  @US-P3-004-create-pattern
  Scenario: Create a pattern via MCP write tool
    When I call the MCP write method "create_pattern" with JSON params:
      """
      {"projectId":"pat-proj","id":"button","name":"Button","category":"component","description":"Primary button pattern"}
      """
    Then the response status is 200
    And the MCP result field "id" equals "button"
    And the MCP result field "name" equals "Button"
    And the MCP result field "category" equals "component"

  # ---------------------------------------------------------------------------
  # @US-P3-004-create-variant — variant creation
  # ---------------------------------------------------------------------------

  @US-P3-004-create-variant
  Scenario: Create a pattern variant via MCP write tool
    Given a MCP pattern "card-pat" named "Card" in project "pat-proj"
    When I call the MCP write method "create_variant" with JSON params:
      """
      {"projectId":"pat-proj","patternId":"card-pat","name":"compact","appliesAt":"mobile","description":"Compact card for small screens"}
      """
    Then the response status is 200
    And the MCP result field "name" equals "compact"
    And the MCP result field "appliesAt" equals "mobile"

  # ---------------------------------------------------------------------------
  # @US-P3-004-create-composition-rule — rule creation
  # ---------------------------------------------------------------------------

  @US-P3-004-create-composition-rule
  Scenario: Create a composition rule via MCP write tool
    Given a MCP pattern "container-pat" named "Container" in project "pat-proj"
    And a MCP pattern "header-pat" named "Header" in project "pat-proj"
    When I call the MCP write method "create_composition_rule" with JSON params:
      """
      {"projectId":"pat-proj","patternAId":"container-pat","patternBId":"header-pat","relation":"NESTING_ALLOWED","guidance":"Header must be first child of Container"}
      """
    Then the response status is 200
    And the MCP result field "relation" equals "NESTING_ALLOWED"

  # ---------------------------------------------------------------------------
  # @US-P3-004-create-layout-guideline — guideline creation
  # ---------------------------------------------------------------------------

  @US-P3-004-create-layout-guideline
  Scenario: Create a layout guideline via MCP write tool
    When I call the MCP write method "create_layout_guideline" with JSON params:
      """
      {"projectId":"pat-proj","type":"breakpoints","name":"Mobile breakpoints","description":"Breakpoints for mobile layouts","data":{"sm":640,"md":768,"lg":1024}}
      """
    Then the response status is 200
    And the MCP result field "type" equals "breakpoints"
    And the MCP result field "name" equals "Mobile breakpoints"

  # ---------------------------------------------------------------------------
  # @US-P3-004-update-pattern — description update
  # ---------------------------------------------------------------------------

  @US-P3-004-update-pattern
  Scenario: Update a pattern description via MCP write tool
    Given a MCP pattern "form-pat" named "Form" in project "pat-proj"
    When I call the MCP write method "update_pattern" with JSON params:
      """
      {"projectId":"pat-proj","patternId":"form-pat","description":"Updated form pattern description"}
      """
    Then the response status is 200
    And the MCP result field "description" equals "Updated form pattern description"

  # ---------------------------------------------------------------------------
  # @US-P3-004-delete-pattern — deletion returns success
  # ---------------------------------------------------------------------------

  @US-P3-004-delete-pattern
  Scenario: Delete a pattern via MCP write tool
    Given a MCP pattern "nav-pat" named "Nav" in project "pat-proj"
    When I call the MCP write method "delete_pattern" with JSON params:
      """
      {"projectId":"pat-proj","patternId":"nav-pat"}
      """
    Then the response status is 200
    And the MCP result has success true
