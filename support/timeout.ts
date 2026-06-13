import { setDefaultTimeout } from '@cucumber/cucumber';

// Cucumber's default step timeout is 5_000 ms — too short for any step that
// drives a real browser, mobile app, desktop app, or HTTP request. Bump to 30s
// here; individual steps can still override via { timeout: N } when needed.
setDefaultTimeout(30_000);
