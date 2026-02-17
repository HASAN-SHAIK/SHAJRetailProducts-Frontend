import { render, screen } from '@testing-library/react';
import { __resetMocks, __setLocation } from 'react-router-dom';
import App from '../App';
import api from '../utils/axios';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector) =>
    selector({
      user: { userDetails: { user_name: 'Alice', role: 'admin' } },
    }),
}));

jest.mock('../utils/axios', () => ({
  get: jest.fn(),
}));


jest.mock('../utils/offlineOrders', () => ({
  processOfflineQueue: jest.fn(() => Promise.resolve()),
}));

jest.mock('../store/userSlice', () => ({
  setUserDetails: (payload) => ({ type: 'user/setUserDetails', payload }),
}));

jest.mock('../components/common/Navbar/Navbar', () => (props) => (
  <div>Navbar {props.user_name}</div>
));

jest.mock('../components/common/protectedRoute', () => ({ children }) => (
  <div>{children}</div>
));

jest.mock('../pages/LoginPage', () => () => <div>Login Page</div>);
jest.mock('../pages/Dashboard', () => () => <div>Dashboard Page</div>);
jest.mock('../pages/Orders', () => () => <div>Orders Page</div>);
jest.mock('../components/ProductsPage/ProductsPage', () => () => <div>Products Page</div>);
jest.mock('../pages/Transactions', () => () => <div>Transactions Page</div>);
jest.mock('../pages/CreateOrderPage', () => () => <div>Create Order Page</div>);
jest.mock('../pages/Logout', () => () => <div>Logout Page</div>);

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetMocks();
    api.get.mockResolvedValue({ data: { user: { id: 1 } } });
    delete window.__serverOffline;
  });

  it('renders navbar for authenticated users on protected routes', () => {
    __setLocation('/dashboard');

    render(<App />);

    expect(screen.getByText('Navbar Alice')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('shows server offline banner when backend is marked offline', () => {
    __setLocation('/orders');
    window.__serverOffline = true;

    render(<App />);

    expect(screen.getByText('Server is Offline')).toBeInTheDocument();
  });
});
