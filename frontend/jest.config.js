/**
 * Unit tests for the pure TypeScript in app/, features/, src/lib and
 * src/components/**.
 *
 * Deliberately scoped to logic that does not import react-native: component
 * rendering would need the jest-expo preset plus mocks for expo-router, the
 * Redux store, and the native modules, which is a much larger setup than the
 * logic under test justifies today. `roots` used to be just src/, which put
 * every screen and every RTK Query slice - most of the app's own code -
 * structurally outside this config's reach even for pure, react-native-free
 * logic inside them (a slice's query-string builder, a screen's date-key
 * validation). Widening it doesn't run any of that yet; it just makes it
 * possible to add a __tests__ file next to that logic without a config
 * change to find it.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/app", "<rootDir>/features", "<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  clearMocks: true,
};
