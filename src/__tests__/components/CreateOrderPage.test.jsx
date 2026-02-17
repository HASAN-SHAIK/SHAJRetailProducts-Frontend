import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, __navigateMock, __resetMocks } from 'react-router-dom';
import CreateOrderPage from '../../pages/CreateOrderPage';

const mockDispatch = jest.fn();
const mockShowPopup = jest.fn();
const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
const mockApiPut = jest.fn();
const mockEnqueueOffline = jest.fn();

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector) =>
    selector({
      user: { userDetails: { id: 7, role: 'admin' } },
      order: { orderDetails: null },
    }),
}));

jest.mock('../../utils/axios', () => ({
  get: (...args) => mockApiGet(...args),
  post: (...args) => mockApiPost(...args),
  put: (...args) => mockApiPut(...args),
}));

jest.mock('../../components/common/PopUp/PopupProvider', () => ({
  usePopup: () => ({ showPopup: mockShowPopup }),
}));

jest.mock('../../utils/offlineOrders', () => ({
  enqueueOfflineOrder: (...args) => mockEnqueueOffline(...args),
}));

jest.mock('../../utils/offlineProducts', () => ({
  saveProductsCache: jest.fn(),
  searchCachedProducts: jest.fn(() => []),
}));

jest.mock('../../utils/offlineCategories', () => ({
  loadCategoriesCache: jest.fn(() => []),
  saveCategoriesCache: jest.fn(),
}));

const renderPage = async () => {
  render(
    <MemoryRouter>
      <CreateOrderPage />
    </MemoryRouter>
  );

  await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/orders/getcategories'));
};

describe('CreateOrderPage (component)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetMocks();
    mockApiGet.mockImplementation((url) => {
      if (url === '/orders/getcategories') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/products') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('renders transaction type options', async () => {
    await renderPage();

    expect(screen.getByText('sale')).toBeInTheDocument();
    expect(screen.getByText('purchase')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
  });

  it('shows payment options and add product button for sale', async () => {
    await renderPage();

    await userEvent.click(screen.getByLabelText('sale'));

    expect(screen.getByText('Payment Method:')).toBeInTheDocument();
    expect(screen.getByText('cash')).toBeInTheDocument();
    expect(screen.getByText('online')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
  });

  it('adds a product row for sale', async () => {
    await renderPage();

    await userEvent.click(screen.getByLabelText('sale'));
    await userEvent.click(screen.getByRole('button', { name: /add product/i }));

    expect(screen.getByPlaceholderText('Search Product')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Quantity (pcs)')).toBeInTheDocument();
  });

  it('validates missing transaction type on submit', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: /create order/i }));

    expect(mockShowPopup).toHaveBeenCalledWith('Select transaction type', 'Validation');
  });

  it('validates missing payment method for personal transaction', async () => {
    await renderPage();

    await userEvent.click(screen.getByLabelText('personal'));
    await userEvent.click(screen.getByRole('button', { name: /create order/i }));

    expect(mockShowPopup).toHaveBeenCalledWith('Select payment method', 'Validation');
  });

  it('enqueues offline order when offline', async () => {
    const originalOnline = navigator.onLine;
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });

    await renderPage();

    await userEvent.click(screen.getByLabelText('personal'));
    await userEvent.click(screen.getByText('cash'));
    await userEvent.type(screen.getByRole('spinbutton'), '250');

    await userEvent.click(screen.getByRole('button', { name: /create order/i }));

    expect(mockEnqueueOffline).toHaveBeenCalled();
    expect(mockShowPopup).toHaveBeenCalledWith(
      'Offline: Order saved and will sync when you are online.',
      'Offline'
    );
    expect(__navigateMock).toHaveBeenCalledWith('/orders');

    Object.defineProperty(window.navigator, 'onLine', { value: originalOnline, configurable: true });
  });
});
