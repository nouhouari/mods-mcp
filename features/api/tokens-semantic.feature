@api
Feature: tokens-semantic

  @US-010
  Scenario: Create a semantic token referencing a primitive
    Given a base project 'base' with primitive token 'color-blue-500' value '#3B82F6'
    When I call createToken with key 'color-primary', isSemantic true, semanticRef 'color-blue-500' for project 'base'
    Then the returned token has isSemantic true and semanticRef 'color-blue-500'

  @US-010
  Scenario: Circular reference A to B to A is rejected
    Given a base project 'base' with semantic token 'B' referencing primitive 'A'
    When I call createToken with key 'A' as semantic, semanticRef 'B' for project 'base'
    Then a TokensError is thrown with code 'CIRCULAR_REFERENCE'

  @US-010
  Scenario: Delete primitive referenced by semantic returns TOKEN_REFERENCED_BY_SEMANTIC
    Given a base project 'base' with primitive 'color-blue' and semantic 'color-primary' referencing 'color-blue'
    When I call deleteToken for project 'base' key 'color-blue' version 0
    Then a TokensError is thrown with code 'TOKEN_REFERENCED_BY_SEMANTIC'

  @US-010
  Scenario: Semantic chain of depth 5 succeeds
    Given a base project 'base' with a semantic reference chain of depth 5
    When I call resolveTokens for project 'base'
    Then all tokens in the chain are returned without error
