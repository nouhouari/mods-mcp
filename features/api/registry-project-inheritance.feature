@api
Feature: registry-project-inheritance

  @US-008
  Scenario: Create a child project pointing to a base
    Given a base project 'base' exists
    When I call createProject with id 'child' and parentId 'base'
    Then the returned project has parentId 'base'
    And isBase('child') returns false
    And isBase('base') returns true

  @US-006
  Scenario: Grandchild creation is rejected with MAX_INHERITANCE_DEPTH
    Given a base project 'base' and child project 'child' with parentId 'base' exist
    When I call createProject with id 'grandchild' and parentId 'child'
    Then a RegistryError is thrown with code 'MAX_INHERITANCE_DEPTH'

  @US-007
  Scenario: isBase returns true for base and false for child
    Given a base project 'base' and child project 'child' with parentId 'base' exist
    When I call isBase with id 'base'
    Then the result is true
    When I call isBase with id 'child'
    Then the result is false

  @US-007
  Scenario: isBase throws PROJECT_NOT_FOUND for unknown project
    When I call isBase with id 'ghost'
    Then a RegistryError is thrown with code 'PROJECT_NOT_FOUND'

  @US-008
  Scenario: Project isolation: override in child does not affect base
    Given a base project 'base' and child project 'child' with parentId 'base' exist
    And the child 'child' has a token override for key 'color-primary'
    When I resolve tokens for project 'base'
    Then the result does not contain an override for 'color-primary' scoped to 'base'
