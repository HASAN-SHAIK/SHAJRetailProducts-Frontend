import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrdersPage from '../../components/OrdersPage/OrdersPage';
import api from '../../utils/axios';

const mockDispatch = jest.fn();
const mockShowPopup = jest.fn();

jest.mock('../../utils/axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

jest.mock('../../components/common/PopUp/PopupProvider', () => ({
  usePopup: () => ({ showPopup: mockShowPopup }),
}));

jest.mock('../../components/common/LoadingSpinner/LoadingSpinner', () => () => (
  <div>Loading Spinner</div>
));

jest.mock('../../store/orderSlice', () => ({
  setOrderDetails: (payload) => ({ type: 'order/setOrderDetails', payload }),
}));

jest.mock('../../utils/offlineOrders', () => ({
  getOfflineOrderQueue: jest.fn(() => []),
  processOfflineQueue: jest.fn(() =>
    Promise.resolve({ processed: 1, failed: 0, remaining: 0 })
  ),
}));

const baseOrder = {
  id: 1,
  items: [
    { product_name: 'Apple', quantity: 2, selling_price: 10, is_weight_based: 0 },
  ],
  total_price: 20,
  username: 'Bob',
  order_status: 'pending',
  order_date: '2026-02-14T10:00:00Z',
  type: 'sale',
  payment: 'cash',
};

describe('OrdersPage', () => {
  beforeAll(() => {
    if (!global.URL.createObjectURL) {
      global.URL.createObjectURL = jest.fn(() => 'blob:mock');
    }
    if (!global.URL.revokeObjectURL) {
      global.URL.revokeObjectURL = jest.fn();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner while fetching orders', () => {
    api.get.mockReturnValue(new Promise(() => {}));

    render(<OrdersPage userRole="admin" navigate={jest.fn()} />);

    expect(screen.getByText('Loading Spinner')).toBeInTheDocument();
  });

  it('renders orders and admin actions when data loads', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/orders') return Promise.resolve({ data: { orders: [baseOrder] } });
      return Promise.resolve({ data: {} });
    });

    render(<OrdersPage userRole="admin" navigate={jest.fn()} />);

    expect(await screen.findByText('Apple - Qty: 2 pcs')).toBeInTheDocument();
    expect(screen.getByText('Mark as Paid')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('shows empty state when no orders are found', async () => {
    api.get.mockResolvedValue({ data: { orders: [] } });

    render(<OrdersPage userRole="admin" navigate={jest.fn()} />);

    expect(await screen.findByText('No orders found.')).toBeInTheDocument();
  });

  it('dispatches order details and navigates on edit click', async () => {
    const navigate = jest.fn();
    api.get.mockResolvedValue({ data: { orders: [baseOrder] } });

    render(<OrdersPage userRole="admin" navigate={navigate} />);

    const editButton = await screen.findByRole('button', { name: /edit/i });
    await userEvent.click(editButton);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'order/setOrderDetails',
      payload: baseOrder,
    });
    expect(navigate).toHaveBeenCalledWith('/neworder');
  });

  it('shows offline warning when syncing while offline', async () => {
    api.get.mockResolvedValue({ data: { orders: [baseOrder] } });
    const originalOnline = navigator.onLine;
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });

    render(<OrdersPage userRole="admin" navigate={jest.fn()} />);

    const syncButton = await screen.findByRole('button', { name: /sync offline/i });
    await userEvent.click(syncButton);

    expect(mockShowPopup).toHaveBeenCalledWith(
      'You are offline. Connect to the internet and try again.',
      'Offline'
    );

    Object.defineProperty(window.navigator, 'onLine', { value: originalOnline, configurable: true });
  });

  it('downloads GST receipt and shows success popup', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/orders') return Promise.resolve({ data: { orders: [baseOrder] } });
      if (url === '/shop-details/me') {
        return Promise.resolve({
          data: { shop_details: { shop_name: 'Test Shop' } },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(<OrdersPage userRole="admin" navigate={jest.fn()} />);

    const downloadButton = await screen.findByRole('button', { name: /download/i });
    await userEvent.click(downloadButton);

    await waitFor(() =>
      expect(mockShowPopup).toHaveBeenCalledWith('GST receipt downloaded', 'Success')
    );
  });
});
