import '@testing-library/jest-dom';

jest.mock('react-router-dom');

// Prevent real API calls during unit tests. Individual tests can override this mock.
jest.mock('./utils/axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
}));
