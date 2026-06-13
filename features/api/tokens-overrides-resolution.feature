@api
Feature: tokens-overrides-resolution

  @US-011
  Scenario: Set a project override and resolve shows override value
    Given a base project 'base' with token 'color-primary' value '#FF0000'
    And a child project 'brand' with parentId 'base'
    When I call setOverride for project 'brand' key 'color-primary' value '#00FF00' version 0
    And I call resolveTokens for project 'brand'
    Then the resolved token 'color-primary' has value '#00FF00' and source 'override'

  @US-011
  Scenario: Delete override reverts to base value
    Given a child project 'brand' with an override for 'color-primary' value '#00FF00'
    When I call deleteOverride for project 'brand' key 'color-primary'
    And I call resolveTokens for project 'brand'
    Then the resolved token 'color-primary' has source 'base'

  @US-012
  Scenario: Non-overridden tokens inherit base value with source=base
    Given a base project 'base' with token 'spacing-md' value '8px'
    And a child project 'brand' with parentId 'base' and no overrides
    When I call resolveTokens for project 'brand'
    Then the resolved token 'spacing-md' has value '8px' and source 'base'

  @US-011
  Scenario: Overrides from one project do not bleed into another project
    Given a base project 'base' with token 'color-primary' value '#FF0000'
    And projects 'brand-a' and 'brand-b' both inheriting from 'base'
    And 'brand-a' has an override for 'color-primary' set to '#AAAAAA'
    When I call resolveTokens for project 'brand-b'
    Then the resolved token 'color-primary' has source 'base' and value '#FF0000'

  @US-012
  Scenario: resolveTokens filtered by category returns only that category
    Given a child project 'brand' with base tokens in 'color' and 'spacing' categories
    When I call resolveTokens for project 'brand' with category 'color'
    Then all returned tokens have category 'color'

  @US-012
  Scenario: Two consecutive resolveTokens calls return identical results
    Given a base project 'base' with tokens and a child 'brand' with overrides
    When I call resolveTokens for project 'brand' twice without any mutations between calls
    Then both results are identical
