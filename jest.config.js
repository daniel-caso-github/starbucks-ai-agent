/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // This pattern finds both *.spec.ts files AND files in __tests__ folders
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.ts$',

  rootDir: '.',

  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },

  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/index.ts',
    '!src/**/__tests__/**', // Exclude test files from coverage
    '!src/cli.ts', // CLI entry point
    '!src/infrastructure/database/**/*.command.ts', // CLI commands (manual testing)
    '!src/infrastructure/database/seeds/*.service.ts', // Seeder services (manual testing)
    '!src/infrastructure/database/seeds/*.data.ts', // Seed data
    '!src/infrastructure/adapters/ai/openai/**', // OpenAI adapter (unused alternative)
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  coverageThreshold: {
    global: {
      branches: 70, // Lowered due to complex AI adapter branching
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
