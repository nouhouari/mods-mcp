# mpds-mcp

E2E test project using [Conductor](https://github.com/nouhouari/conductor).

## Platforms

- api

## Setup

```bash
npm install
npx playwright install chromium
```

## Running Tests

```bash
npm test              # all scenarios
npm run test:dry-run  # validate step definitions
npm run test:api      # API scenarios only
```

## Reports

```bash
npm run report       # generate Allure HTML report
npm run report:open  # open the report in browser
```

## Project Layout

```
features/           Gherkin .feature files, grouped by platform
step-definitions/   TypeScript step definitions
pages/              Page objects (extend BasePage)
flows/mobile/       Maestro YAML flows (if using mobile)
reports/            Test output and screenshots
```

## Configuration

Copy `.env.example` to `.env` and set the values for your environment.
See [Conductor User Guide](https://github.com/nouhouari/conductor/blob/main/docs/USER_GUIDE.md) for full documentation.
