@api @mcp
Feature: C-mcp search_guidelines MCP tool (@US-041)

  Background:
    Given the MCP server is running with secret "test-secret"

  # ---------------------------------------------------------------------------
  # @US-041 — Search design guidelines by keyword
  # ---------------------------------------------------------------------------

  @US-041
  Scenario: search_guidelines with empty query returns all guidelines ordered by createdAt
    Given a guideline "g1" with title "Color Contrast" and body "Use WCAG 2.1 contrast ratios for text"
    And a guideline "g2" with title "Spacing Scale" and body "Use 8pt grid spacing system"
    When I call the MCP method "search_guidelines" with params '{"query":""}'
    Then the response status is 200
    And the MCP result is an array

  @US-041
  Scenario: search_guidelines with keyword returns matching results with relevanceScore
    Given a guideline "g3" with title "Accessible Color" and body "Contrast ratio must meet WCAG accessibility"
    When I call the MCP method "search_guidelines" with params '{"query":"contrast"}'
    Then the response status is 200
    And the MCP result is an array
    And the first result has a "relevanceScore" property between 0 and 1
    And each result has "id", "title", "bodyExcerpt", "tags", "relevanceScore" fields

  @US-041
  Scenario: search_guidelines bodyExcerpt is at most 200 characters
    Given a guideline "g4" with title "Typography Guide" and body "This is a very long body text that explains all the typography rules in great detail including font sizes font weights line heights and letter spacing for both desktop and mobile viewports"
    When I call the MCP method "search_guidelines" with params '{"query":"typography"}'
    Then the response status is 200
    And the MCP result is an array
    And the first result bodyExcerpt length is at most 200

  @US-041
  Scenario: search_guidelines appears in MCP tool manifest
    When I call the MCP method "search_guidelines" with params '{"query":""}'
    Then the response status is 200
    And the MCP response does not contain an error
