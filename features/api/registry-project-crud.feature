@api
Feature: registry-project-crud

  @US-001
  Scenario: Create a project with a unique id
    Given no project with id 'base' exists
    When I call createProject with id 'base' and name 'Base Design System'
    Then the returned project has id 'base', name 'Base Design System', parentId null
    And a subsequent listProjects includes the project with id 'base'

  @US-001
  Scenario: Duplicate project id returns DUPLICATE_PROJECT_ID
    Given a project with id 'base' exists
    When I call createProject with id 'base' and name 'Dup'
    Then a RegistryError is thrown with code 'DUPLICATE_PROJECT_ID'

  @US-002
  Scenario: Get an existing project by id
    Given a project with id 'p1' exists
    When I call getProject with id 'p1'
    Then the returned project has id 'p1'

  @US-002
  Scenario: Get a non-existent project throws PROJECT_NOT_FOUND
    When I call getProject with id 'ghost'
    Then a RegistryError is thrown with code 'PROJECT_NOT_FOUND'

  @US-003
  Scenario: List all projects returns ordered array
    Given projects with ids 'a', 'b', 'c' exist
    When I call listProjects
    Then the result contains 3 projects
    And listProjects returns an empty array when no projects exist

  @US-004
  Scenario: Update a project name
    Given a project with id 'p1' exists
    When I call updateProject with id 'p1' and name 'New Name'
    Then the returned project has name 'New Name'
    And a subsequent getProject for 'p1' returns name 'New Name'

  @US-005
  Scenario: Delete a leaf project
    Given a project with id 'leaf' exists
    When I call deleteProject with id 'leaf'
    Then the project 'leaf' no longer appears in listProjects

  @US-005
  Scenario: Delete base project with children throws BASE_HAS_CHILDREN
    Given a base project 'base' and child project 'child' with parentId 'base' exist
    When I call deleteProject with id 'base'
    Then a RegistryError is thrown with code 'BASE_HAS_CHILDREN'

  @US-005
  Scenario: Delete project with tokens throws PROJECT_HAS_TOKENS
    Given a project with id 'p1' exists and has tokens attached
    When I call deleteProject with id 'p1'
    Then a RegistryError is thrown with code 'PROJECT_HAS_TOKENS'
