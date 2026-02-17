import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __navigateMock, __resetMocks } from 'react-router-dom';
import Login from '../../components/Login/Login';
import api from '../../utils/axios';

const mockDispatch = jest.fn();

jest.mock('../../utils/axios', () => ({
  post: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector) =>
    selector({
      user: { userDetails: null },
    }),
}));

jest.mock('../../store/userSlice', () => ({
  setUserDetails: (payload) => ({ type: 'user/setUserDetails', payload }),
}));

jest.mock('../../utils/device', () => ({
  getDeviceId: () => 'device-123',
}));

describe('Login component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetMocks();
  });

  it('renders the login form', () => {
    render(<Login />);

    expect(screen.getByPlaceholderText(/admin@example\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /let's go/i })).toBeInTheDocument();
  });

  it('submits credentials, stores token, dispatches user, and navigates', async () => {
    api.post.mockResolvedValue({
      data: { token: 'token-123', user: { id: 1, name: 'Admin' } },
    });
    const setItemSpy = jest.spyOn(window.localStorage.__proto__, 'setItem');

    render(<Login />);

    await userEvent.type(screen.getByPlaceholderText(/admin@example\.com/i), 'admin@example.com');
    await userEvent.type(screen.getByPlaceholderText('••••••'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /let's go/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/login', {
      device_id: 'device-123',
      email: 'admin@example.com',
      password: 'secret',
    }));

    expect(setItemSpy).toHaveBeenCalledWith('auth_token', 'token-123');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'user/setUserDetails',
      payload: { id: 1, name: 'Admin' },
    });
    expect(__navigateMock).toHaveBeenCalledWith('/dashboard');

    setItemSpy.mockRestore();
  });

  it('shows error when login fails', async () => {
    api.post.mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } },
    });

    render(<Login />);

    await userEvent.type(screen.getByPlaceholderText(/admin@example\.com/i), 'admin@example.com');
    await userEvent.type(screen.getByPlaceholderText('••••••'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /let's go/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
