module.exports = {
  // File extensions to consider for testing
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  // Regular expression pattern to match test files
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // Files to collect coverage from
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  // Output directory for coverage reports
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
  },

  // Setup files to run before each test
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
  // Paths to ignore when looking for tests
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  clearMocks: true,
  collectCoverage: false,
};
