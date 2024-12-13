// jest.config.js
module.exports = {
  rootDir: '../',
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  globals: {
    'ts-jest': {
      tsconfig: '../src/__tests__/tsconfig.json', // Use the test-specific tsconfig
    },
  },
  testMatch: ['**/?(*.)+(test).+(ts)'],
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
}
