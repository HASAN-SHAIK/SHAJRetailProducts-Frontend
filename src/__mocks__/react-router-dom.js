const React = require('react');

const navigateMock = jest.fn();
const locationMock = { pathname: '/' };

const setLocation = (pathname) => {
  locationMock.pathname = pathname;
};

const resetMocks = () => {
  navigateMock.mockClear();
  locationMock.pathname = '/';
};

module.exports = {
  __esModule: true,
  MemoryRouter: ({ children }) => React.createElement('div', null, children),
  BrowserRouter: ({ children }) => React.createElement('div', null, children),
  Routes: ({ children }) => React.createElement('div', null, children),
  Route: ({ element }) => element || null,
  Navigate: ({ to }) => React.createElement('div', null, `Navigate ${to}`),
  useNavigate: () => navigateMock,
  useLocation: () => locationMock,
  Link: ({ children }) => React.createElement('div', null, children),
  __navigateMock: navigateMock,
  __setLocation: setLocation,
  __resetMocks: resetMocks,
};
