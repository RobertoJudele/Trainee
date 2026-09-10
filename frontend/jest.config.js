/**
 * Unit tests for the pure TypeScript in src/lib and src/components/**.
 *
 * Deliberately scoped to logic that does not import react-native: component
 * rendering would need the jest-expo preset plus mocks for expo-router, the
 * Redux store, and the native modules, which is a much larger setup than the
 * logic under test justifies today.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  clearMocks: true,
};
