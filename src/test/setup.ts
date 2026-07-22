import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest doesn't expose `afterEach` as a global unless `test.globals` is
// set, and this test file imports it explicitly from 'vitest' instead —
// so @testing-library/react's own auto-cleanup detection (which only
// checks for a global `afterEach`) never registers. Without this, the
// DOM from one test's render() is still mounted when the next test
// runs, so queries like getByText see duplicate nodes across tests.
afterEach(() => {
  cleanup();
});
