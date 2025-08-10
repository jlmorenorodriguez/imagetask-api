/**
 * E2E test setup file for Jest
 * This file runs before all E2E tests to configure the testing environment
 */

// Set longer timeout for E2E tests (they usually take more time)
jest.setTimeout(30000);

// Suppress console logs in tests unless there's an error
const originalConsole = global.console;

beforeEach(() => {
  // You can uncomment these lines if you want to suppress logs
  // global.console = {
  //   ...originalConsole,
  //   log: jest.fn(),
  //   warn: jest.fn(),
  //   error: originalConsole.error, // Keep errors visible
  // };
});

afterEach(() => {
  global.console = originalConsole;
});

// Global E2E test utilities
global.e2eTestUtils = {
  /**
   * Wait for a specified amount of time
   * @param ms - Milliseconds to wait
   */
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Generate a random string for testing
   * @param length - Length of the string
   */
  generateRandomString: (length: number = 10) => {
    return Math.random()
      .toString(36)
      .substring(2, 2 + length);
  },

  /**
   * Generate test image data
   */
  generateTestImageBuffer: () => {
    // Simple 1x1 pixel PNG in base64
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAGvnfOAAAAABJRU5ErkJggg==';
    return Buffer.from(base64, 'base64');
  },

  /**
   * Create a test image file path
   */
  createTestImagePath: (filename: string = 'test-image.jpg') => {
    return `/tmp/${filename}`;
  },

  /**
   * Create valid task payload for testing
   */
  createValidTaskPayload: () => ({
    originalPath: 'https://example.com/test-image.jpg',
  }),

  /**
   * Create invalid task payloads for testing validation
   */
  createInvalidTaskPayloads: () => ({
    empty: {},
    nullPath: { originalPath: null },
    emptyPath: { originalPath: '' },
    invalidUrl: { originalPath: 'not-a-valid-url' },
    nonStringPath: { originalPath: 123 },
  }),
};
