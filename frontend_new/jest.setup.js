/**
 * Jest setup file — forces React development mode so act() works in tests.
 *
 * In Jest 30 + React 18, the production build of React throws when act()
 * is called outside of a development environment. This setup file ensures
 * the React development build is loaded by setting the NODE_ENV to 'development'
 * before any tests run.
 */

// Force development mode for React act() support
process.env.NODE_ENV = 'development'

// Import jest-dom matchers (toBeInTheDocument, etc.)
require('@testing-library/jest-dom')
