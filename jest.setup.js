require('@testing-library/jest-dom');

// Polyfills for Node.js environment in Jest
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock fetch if not available
if (!global.fetch) {
    global.fetch = jest.fn();
} 