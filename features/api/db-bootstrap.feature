@api
Feature: db-bootstrap

  # ---------------------------------------------------------------------------
  # US-016: DB initialization — WAL + FK + busy_timeout + singleton
  # ---------------------------------------------------------------------------

  @US-016
  Scenario: getDb called twice returns same object reference
    Given I have opened the database
    When I call getDb a second time in the same scenario
    Then the second call returns the same database instance

  @US-016
  Scenario: journal_mode pragma is WAL
    Given I have opened the database
    When I check the journal_mode pragma
    Then the journal_mode is "wal"

  @US-016
  Scenario: foreign_keys pragma is ON
    Given I have opened the database
    When I check the foreign_keys pragma
    Then the foreign_keys value is 1

  @US-016
  Scenario: busy_timeout pragma is 5000
    Given I have opened the database
    When I check the busy_timeout pragma
    Then the busy_timeout value is 5000

  # ---------------------------------------------------------------------------
  # US-017: runMigrations — tracked, idempotent, schema complete
  # ---------------------------------------------------------------------------

  @US-017
  Scenario: migrations table records each applied migration
    Given I have opened the database
    When I query the migrations table
    Then at least one migration row exists
    And each migration row has a version and applied_at

  @US-017
  Scenario: runMigrations called twice does not re-apply migrations
    Given I have opened the database
    When I count migrations before calling runMigrations again
    And I call runMigrations a second time
    Then the migrations count has not increased

  @US-017
  Scenario: expected tables exist after runMigrations
    Given I have opened the database
    When I query sqlite_master for table "projects"
    Then the table exists
    When I query sqlite_master for table "tokens"
    Then the table exists
    When I query sqlite_master for table "component_specs"
    Then the table exists
    When I query sqlite_master for table "token_pairs"
    Then the table exists
    When I query sqlite_master for table "proposals"
    Then the table exists

  @US-017
  Scenario: trigger tokens_semantic_ref_insert exists after runMigrations
    Given I have opened the database
    When I query sqlite_master for trigger "tokens_semantic_ref_insert"
    Then the trigger exists
