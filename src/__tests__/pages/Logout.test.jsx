import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, __navigateMock, __resetMocks } from 'react-router-dom';
import Logout from '../../pages/Logout';

const mockDispatch = jest.fn();
const mockShowPopup = jest.fn();
const mockApiPost = jest.fn(() => Promise.resolve({}));

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

jest.mock('../../components/common/PopUp/PopupProvider', () => ({
  usePopup: () => ({ showPopup: mockShowPopup }),
}));

jest.mock('../../utils/axios', () => ({
  post: (...args) => mockApiPost(...args),
}));

jest.mock('js-cookie', () => ({ remove: jest.fn() }));

jest.mock('../../components/common/LoadingSpinner/LoadingSpinner', () => () => (
  <div>Loading Spinner</div>
));

describe('Logout', () => {
  beforeEach(() => {
    __resetMocks();
  });

  it('renders logging out message and navigates to login', async () => {
    render(
      <MemoryRouter>
        <Logout />
      </MemoryRouter>
    );

    expect(screen.getByText('Logging you out...')).toBeInTheDocument();

    await waitFor(() => expect(__navigateMock).toHaveBeenCalledWith('/'));
  });
});
