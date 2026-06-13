@api
Feature: tokens-primitive-crud

  @US-009
  Scenario: Create and retrieve a primitive color token
    Given a base project 'base' exists
    When I call createToken with projectId 'base', key 'color-primary', category 'color', value '#FF0000'
    Then the returned token has key 'color-primary' and value '#FF0000'
    And listTokens for project 'base' includes the token 'color-primary'

  @US-009
  Scenario: Invalid category returns INVALID_CATEGORY
    Given a base project 'base' exists
    When I call createToken with category 'unknown' for project 'base'
    Then a TokensError is thrown with code 'INVALID_CATEGORY'

  @US-009
  Scenario: Duplicate key in same project and category returns DUPLICATE_TOKEN_KEY
    Given a base project 'base' exists with token 'color-primary' in category 'color'
    When I call createToken with the same key 'color-primary' and category 'color' for project 'base'
    Then a TokensError is thrown with code 'DUPLICATE_TOKEN_KEY'

  @US-009
  Scenario: Filter tokens by category returns only matching tokens
    Given a base project 'base' with tokens in 'color' and 'spacing' categories
    When I call listTokens for project 'base' with category 'color'
    Then all returned tokens have category 'color'

  @US-013
  Scenario: Update token value with OCC
    Given a base project 'base' with token 'color-primary' at version 0
    When I call updateToken for 'base' key 'color-primary' with value '#0000FF' and version 0
    Then the returned token has value '#0000FF' and version 1

  @US-013
  Scenario: OCC conflict returns CONFLICT
    Given a base project 'base' with token 'color-primary' at version 0
    When I call updateToken for 'base' key 'color-primary' with version 99 (stale)
    Then a TokensError is thrown with code 'CONFLICT'

  @US-009
  Scenario: Delete a token
    Given a base project 'base' with token 'spacing-md' at version 0
    When I call deleteToken for project 'base' key 'spacing-md' version 0
    Then calling getToken for 'base' key 'spacing-md' throws TOKEN_NOT_FOUND
