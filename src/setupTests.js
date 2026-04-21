import '@testing-library/jest-dom';

// Mock browser APIs
window.alert = jest.fn();
window.scrollTo = jest.fn();

beforeEach(() => {
  console.log("🔵 Starting test...");
});

afterEach(() => {
  console.log("🟢 Test completed");
});