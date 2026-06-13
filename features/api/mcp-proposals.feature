@api @mcp
Feature: C-mcp propose_token_override and list_proposals MCP tools (@US-042)

  Background:
    Given the MCP server is running with secret "test-secret"
    And a project "ds-base" exists in the registry

  # ---------------------------------------------------------------------------
  # @US-042 — Propose AI token/component changes via MCP
  # ---------------------------------------------------------------------------

  @US-042
  Scenario: propose_token_override creates a pending proposal with proposalId and status pending
    When I call the MCP method "propose_token_override" with params '{"projectId":"ds-base","key":"color.primary","value":"#0066CC","rationale":"Improves accessibility"}'
    Then the response status is 200
    And the MCP result has a "proposalId" property
    And the MCP result has a "status" property equal to "pending"

  @US-042
  Scenario: list_proposals returns proposals with pending status
    Given a token override proposal exists for project "ds-base" key "color.secondary" value "#FF6600"
    When I call the MCP method "list_proposals" with params '{"projectId":"ds-base"}'
    Then the response status is 200
    And the MCP result is an array
    And the proposals list contains a proposal with status "pending"

  @US-042
  Scenario: pending proposal does not affect resolved token value
    Given token "color.accent" with value "#FF0000" and category "color" exists in project "ds-base"
    And a token override proposal exists for project "ds-base" key "color.accent" value "#00FF00"
    When I call the MCP method "get_tokens" with params '{"projectId":"ds-base"}'
    Then the response status is 200
    And the MCP result is an array
    And the token "color.accent" still resolves to "#FF0000"

  @US-042
  Scenario: submitting duplicate pending proposal returns PROPOSAL_ALREADY_PENDING error
    Given a token override proposal exists for project "ds-base" key "color.border" value "#CCCCCC"
    When I call the MCP method "propose_token_override" with params '{"projectId":"ds-base","key":"color.border","value":"#DDDDDD","rationale":"Second proposal"}'
    Then the response status is 200
    And the MCP response contains an error
    And the MCP error code is "PROPOSAL_ALREADY_PENDING"
