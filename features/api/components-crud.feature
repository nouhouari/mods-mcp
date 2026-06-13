@api
Feature: components-crud

  Background:
    Given a base project 'base-project' exists

  @US-018
  Scenario: Create component spec returns defaults for array fields and version 0
    When I call createSpec with id 'btn', projectId 'base-project', name 'Button'
    Then the returned spec has id 'btn', projectId 'base-project', name 'Button'
    And the returned spec has empty arrays and version 0

  @US-018
  Scenario: getSpec returns the same spec with all fields correctly deserialized
    Given a component spec 'btn' named 'Button' exists in project 'base-project'
    When I call getSpec for project 'base-project' and component 'btn'
    Then the returned spec has id 'btn', projectId 'base-project', name 'Button'
    And the returned spec has empty arrays and version 0

  @US-018
  Scenario: Duplicate component id in same project throws DUPLICATE_COMPONENT_ID
    Given a component spec 'btn' named 'Button' exists in project 'base-project'
    When I call createSpec with id 'btn', projectId 'base-project', name 'Button Duplicate'
    Then a ComponentsError is thrown with code 'DUPLICATE_COMPONENT_ID'

  @US-018
  Scenario: createSpec with non-existent projectId throws PROJECT_NOT_FOUND
    When I call createSpec with id 'btn', projectId 'no-such-project', name 'Button'
    Then a ComponentsError is thrown with code 'PROJECT_NOT_FOUND'

  @US-019
  Scenario: listSpecs returns empty array when no components exist
    When I call listSpecs for project 'base-project'
    Then the result is an empty array

  @US-019
  Scenario: listSpecs returns all specs after multiple createSpec calls
    Given component specs 'btn', 'input', 'card' exist in project 'base-project'
    When I call listSpecs for project 'base-project'
    Then the result contains 3 specs

  @US-019
  Scenario: Each listSpecs entry includes all required fields
    Given a component spec 'btn' named 'Button' exists in project 'base-project'
    When I call listSpecs for project 'base-project'
    Then every returned spec has id, name, projectId, props, variants, states, usageRules, accessibilityNotes, and version

  @US-019
  Scenario: listSpecs with non-existent projectId throws PROJECT_NOT_FOUND
    When I call listSpecs for project 'ghost-project'
    Then a ComponentsError is thrown with code 'PROJECT_NOT_FOUND'

  @US-020
  Scenario: updateSpec with matching version increments version by 1
    Given a component spec 'btn' named 'Button' exists in project 'base-project'
    When I call updateSpec for project 'base-project' component 'btn' with name 'Button v2' and version 0
    Then the returned spec has name 'Button v2' and version 1

  @US-020
  Scenario: updateSpec with stale version throws CONFLICT
    Given a component spec 'btn' named 'Button' exists in project 'base-project'
    When I call updateSpec for project 'base-project' component 'btn' with name 'X' and version 99
    Then a ComponentsError is thrown with code 'CONFLICT'

  @US-020
  Scenario: updateSpec on non-existent component throws COMPONENT_NOT_FOUND
    When I call updateSpec for project 'base-project' component 'ghost-btn' with name 'X' and version 0
    Then a ComponentsError is thrown with code 'COMPONENT_NOT_FOUND'

  @US-020
  Scenario: updateSpec on non-existent projectId throws PROJECT_NOT_FOUND
    When I call updateSpec for project 'no-such-project' component 'btn' with name 'X' and version 0
    Then a ComponentsError is thrown with code 'PROJECT_NOT_FOUND'

  @US-021
  Scenario: deleteSpec removes the component; subsequent getSpec throws COMPONENT_NOT_FOUND
    Given a component spec 'btn' named 'Button' exists in project 'base-project'
    When I call deleteSpec for project 'base-project' component 'btn'
    Then calling getSpec for project 'base-project' component 'btn' throws COMPONENT_NOT_FOUND

  @US-021
  Scenario: deleteSpec cascades overrides and component no longer appears in listSpecs
    Given a base project 'base-project' has component 'btn' with a child project override
    When I call deleteSpec for project 'base-project' component 'btn'
    Then calling listSpecs for project 'base-project' does not include 'btn'

  @US-021
  Scenario: deleteSpec on non-existent componentId throws COMPONENT_NOT_FOUND
    When I call deleteSpec for project 'base-project' component 'ghost-btn'
    Then a ComponentsError is thrown with code 'COMPONENT_NOT_FOUND'

  @US-021
  Scenario: deleteSpec on non-existent projectId throws PROJECT_NOT_FOUND
    When I call deleteSpec for project 'no-such-project' component 'btn'
    Then a ComponentsError is thrown with code 'PROJECT_NOT_FOUND'
