import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductsPage from '../../components/ProductsPage/ProductsPage';
import api from '../../utils/axios';

const mockShowPopup = jest.fn();
const mockNavigate = jest.fn();
let mockUserRole = 'admin';

jest.mock('../../utils/axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: (selector) =>
    selector({
      user: { userDetails: { role: mockUserRole } },
    }),
}));

jest.mock('../../components/common/PopUp/PopupProvider', () => ({
  usePopup: () => ({ showPopup: mockShowPopup }),
}));

jest.mock('../../components/common/LoadingSpinner/LoadingSpinner', () => () => (
  <div>Loading Spinner</div>
));

jest.mock('../../components/common/TableComponent/TableComponent', () => () => (
  <div>Table Rendered</div>
));

jest.mock('../../components/ProductsPage/AddModalComponent/AddProductModalComponent', () => (props) => (
  <div>Product Modal {props.title}</div>
));

jest.mock('bootstrap', () => ({
  Modal: class {
    show() {}
    static getInstance() {
      return { hide: jest.fn() };
    }
  },
}));

jest.mock('../../utils/offlineProducts', () => ({
  saveProductsCache: jest.fn(),
}));

describe('ProductsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRole = 'admin';
  });

  it('shows loading spinner while fetching products', () => {
    api.get.mockReturnValue(new Promise(() => {}));

    render(<ProductsPage navigate={mockNavigate} />);

    expect(screen.getByText('Loading Spinner')).toBeInTheDocument();
  });

  it('renders filters, table, and admin controls when loaded', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/products') {
        return Promise.resolve({
          data: [{ id: 1, name: 'Chips', company: 'ABC', category: 'Snacks' }],
        });
      }
      if (url === '/orders/getcategories') {
        return Promise.resolve({ data: { data: [{ category: 'Snacks' }] } });
      }
      return Promise.resolve({ data: [] });
    });

    render(<ProductsPage navigate={mockNavigate} />);

    expect(await screen.findByText('Table Rendered')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
    expect(screen.getByText('Product Modal Add Product')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Snacks' })).toBeInTheDocument();
  });

  it('hides admin controls for non-admin users', async () => {
    mockUserRole = 'staff';
    api.get.mockImplementation((url) => {
      if (url === '/products') return Promise.resolve({ data: [] });
      if (url === '/orders/getcategories') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: [] });
    });

    render(<ProductsPage navigate={mockNavigate} />);

    expect(await screen.findByText('Table Rendered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add product/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Product Modal/i)).not.toBeInTheDocument();
  });

  it('navigates to logout on invalid token when loading products', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/products') {
        return Promise.reject({ response: { status: 401, data: { message: 'Invalid Token' } } });
      }
      if (url === '/orders/getcategories') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: [] });
    });

    render(<ProductsPage navigate={mockNavigate} />);

    await waitFor(() =>
      expect(mockShowPopup).toHaveBeenCalledWith('Token Expired Please Login Again!', 'Session')
    );
    expect(mockNavigate).toHaveBeenCalledWith('/logout');
  });

  it('opens add product modal when admin clicks button', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/products') return Promise.resolve({ data: [] });
      if (url === '/orders/getcategories') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: [] });
    });

    render(<ProductsPage navigate={mockNavigate} />);

    const addButton = await screen.findByRole('button', { name: /add product/i });
    await userEvent.click(addButton);

    expect(screen.getByText('Product Modal Add Product')).toBeInTheDocument();
  });
});
