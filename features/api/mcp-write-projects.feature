@api @mcp @US-P3-001
Feature: Project Management via MCP Write Tools

  Background:
    Given the MCP server is running with secret "test-secret"

  # ---------------------------------------------------------------------------
  # @US-P3-001-create-project — happy path
  # ---------------------------------------------------------------------------

  @US-P3-001-create-project
  Scenario: Create a project via MCP write tool
    When I call the MCP write method "create_project" with JSON params:
      """
      {"id":"ds-main","name":"Main DS"}
      """
    Then the response status is 200
    And the MCP result field "id" equals "ds-main"
    And the MCP result field "name" equals "Main DS"

  # ---------------------------------------------------------------------------
  # @US-P3-001-create-project-with-parent — parent inheritance
  # ---------------------------------------------------------------------------

  @US-P3-001-create-project-with-parent
  Scenario: Create a project with a parent project via MCP
    Given a project "base-ds" exists in the registry
    When I call the MCP write method "create_project" with JSON params:
      """
      {"id":"child-ds","name":"Child DS","parentId":"base-ds"}
      """
    Then the response status is 200
    And the MCP result field "id" equals "child-ds"
    And the MCP result field "parentId" equals "base-ds"

  # ---------------------------------------------------------------------------
  # @US-P3-001-update-project — name update
  # ---------------------------------------------------------------------------

  @US-P3-001-update-project
  Scenario: Update a project name via MCP write tool
    Given a project "proj-upd" exists in the registry
    When I call the MCP write method "update_project" with JSON params:
      """
      {"projectId":"proj-upd","name":"Updated Name"}
      """
    Then the response status is 200
    And the MCP result field "name" equals "Updated Name"

  # ---------------------------------------------------------------------------
  # @US-P3-001-delete-project — delete then verify gone
  # ---------------------------------------------------------------------------

  @US-P3-001-delete-project
  Scenario: Delete a project via MCP write tool
    Given a project "proj-del-mcp" exists in the registry
    When I call the MCP write method "delete_project" with JSON params:
      """
      {"projectId":"proj-del-mcp"}
      """
    Then the response status is 200
    And the MCP result has success true
    When I call the MCP write method "get_design_system" with JSON params:
      """
      {"projectId":"proj-del-mcp"}
      """
    Then the MCP response contains an error

  # ---------------------------------------------------------------------------
  # @US-P3-001-duplicate-id — conflict guard
  # ---------------------------------------------------------------------------

  @US-P3-001-duplicate-id
  Scenario: Creating a project with a duplicate id returns an error with DUPLICATE code
    Given a project "proj-dup-mcp" exists in the registry
    When I call the MCP write method "create_project" with JSON params:
      """
      {"id":"proj-dup-mcp","name":"Duplicate"}
      """
    Then the response status is 200
    And the MCP error code should include "DUPLICATE"
