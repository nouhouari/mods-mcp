@api
Feature: components-overrides

  Background:
    Given a base project 'base-project' exists
    And a child project 'child-project' with parentId 'base-project' exists
    And a component spec 'btn' named 'Button' exists in project 'base-project'

  @US-022
  Scenario: setOverride with valid fields returns ResolvedComponentSpec with overridden values
    When I call setOverride for project 'child-project' component 'btn' with variants '["primary","ghost"]'
    Then the returned resolved spec has variants '["primary","ghost"]'

  @US-022
  Scenario: After setOverride getSpec returns the overridden field values
    Given an override exists for project 'child-project' component 'btn' with variants '["primary","ghost"]'
    When I call getSpec for project 'child-project' and component 'btn'
    Then the returned resolved spec has variants '["primary","ghost"]'

  @US-022
  Scenario: setOverride with invalid field throws INVALID_OVERRIDE_FIELD with field property set
    When I call setOverride for project 'child-project' component 'btn' with invalid field 'name'
    Then a ComponentsError is thrown with code 'INVALID_OVERRIDE_FIELD'
    And the error has field 'name'

  @US-022
  Scenario: Base spec is unchanged after child project sets an override
    Given an override exists for project 'child-project' component 'btn' with variants '["primary","ghost"]'
    When I call getSpec for project 'base-project' and component 'btn'
    Then the returned spec has empty arrays and version 0

  @US-022
  Scenario: deleteOverride reverts getSpec to base values
    Given an override exists for project 'child-project' component 'btn' with variants '["primary","ghost"]'
    When I call deleteOverride for project 'child-project' component 'btn'
    And I call getSpec for project 'child-project' and component 'btn'
    Then the returned spec has empty arrays and version 0

  @US-022
  Scenario: deleteOverride is idempotent when no override exists
    When I call deleteOverride for project 'child-project' component 'btn'
    Then no error is thrown

  @US-023
  Scenario: With no project override all _sources fields are 'base'
    When I call getSpec for project 'child-project' and component 'btn'
    Then the resolved spec has all _sources as 'base'

  @US-023
  Scenario: After variants override _sources.variants is 'override' and _sources.name is 'base'
    Given an override exists for project 'child-project' component 'btn' with variants '["primary","ghost"]'
    When I call getSpec for project 'child-project' and component 'btn'
    Then the resolved spec _sources.variants is 'override'
    And the resolved spec _sources.name is 'base'

  @US-023
  Scenario: Overriding array field replaces base array entirely with no element-level merge
    Given a component spec 'card' named 'Card' with variants '["size","color"]' exists in project 'base-project'
    And an override exists for project 'child-project' component 'card' with variants '["radius"]'
    When I call getSpec for project 'child-project' and component 'card'
    Then the returned resolved spec has variants '["radius"]'
    And the returned resolved spec does not contain base variant 'size'

  @US-023
  Scenario: Non-overridden fields fall through to base value unchanged
    Given an override exists for project 'child-project' component 'btn' with variants '["primary","ghost"]'
    When I call getSpec for project 'child-project' and component 'btn'
    Then the returned resolved spec has name 'Button'
