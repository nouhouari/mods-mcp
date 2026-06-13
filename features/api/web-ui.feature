@web-ui
Feature: C-webui React SPA

  # ---------------------------------------------------------------------------
  # @US-030 — Project selector
  # ---------------------------------------------------------------------------

  @US-030
  Scenario: Page loads and renders project list with correct data-testids
    Given the web UI module is built
    Then the project selector component exports a valid React component

  @US-030
  Scenario: Selecting a project sets aria-selected and project-item-selected testid
    Given the web UI module is built
    Then it renders data-testid project-item attributes

  @US-030
  Scenario: Empty project list shows empty state
    Given the web UI module is built
    Then it renders empty-projects-state when no projects are loaded

  @US-030
  Scenario: New project button shows form, submitting creates project without full reload
    Given the web UI module is built
    Then it renders a new-project-btn and project-name-input in the create form

  # ---------------------------------------------------------------------------
  # @US-031 — Token browse and override
  # ---------------------------------------------------------------------------

  @US-031
  Scenario: Token list shows rows with correct data-testids
    Given the web UI module is built
    Then it renders token rows with token-row data-testid attributes

  @US-031
  Scenario: data-source attribute is correct for base and override tokens
    Given the web UI module is built
    Then each token row includes a data-source attribute

  @US-031
  Scenario: Color tokens show color swatch
    Given the web UI module is built
    Then color token rows include color-swatch data-testid elements

  @US-031
  Scenario: Click token row reveals value input pre-filled with current value
    Given the web UI module is built
    Then it renders token-value-input when a row is active

  @US-031
  Scenario: Submit override — PUT called, row updates without reload
    Given the web UI module is built
    Then the save button submits the override via PUT

  @US-031
  Scenario: Revert button visible for override token, click reverts to base
    Given the web UI module is built
    Then override token rows include a token-revert data-testid button

  # ---------------------------------------------------------------------------
  # @US-032 — Live preview before save
  # ---------------------------------------------------------------------------

  @US-032
  Scenario: Live preview — valid color shows token-preview after debounce
    Given the web UI module is built
    Then it renders a token-preview element for color tokens

  @US-032
  Scenario: Invalid value shows preview-error and disables save
    Given the web UI module is built
    Then it renders a preview-error element when the color value is invalid

  # ---------------------------------------------------------------------------
  # @US-033 — Filter overrides-only
  # ---------------------------------------------------------------------------

  @US-033
  Scenario: Filter overrides-only hides base tokens, keeps override tokens
    Given the web UI module is built
    Then it renders a filter-overrides-only toggle element
