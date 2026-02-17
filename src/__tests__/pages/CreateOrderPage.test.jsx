import { render, screen } from '@testing-library/react';
import { MemoryRouter, __navigateMock, __resetMocks } from 'react-router-dom';
import CreateOrderPage from '../../pages/CreateOrderPage';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector) =>
    selector({
      user: { userDetails: { id: 1, role: 'admin' } },
      order: { orderDetails: null },
    }),
}));

jest.mock('../../utils/axios', () => ({
  get: jest.fn((url) => {
    if (url === '/orders/getcategories') {
      return Promise.resolve({ data: { data: [] } });
    }
    if (url === '/products') {
      return Promise.resolve({ data: [] });
    }
    return Promise.resolve({ data: [] });
  }),
  post: jest.fn(),
  put: jest.fn(),
}));

jest.mock('../../components/common/PopUp/PopupProvider', () => ({
  usePopup: () => ({ showPopup: jest.fn() }),
}));

jest.mock('../../utils/offlineOrders', () => ({
  enqueueOfflineOrder: jest.fn(),
}));

jest.mock('../../utils/offlineProducts', () => ({
  saveProductsCache: jest.fn(),
  searchCachedProducts: jest.fn(() => []),
}));

jest.mock('../../utils/offlineCategories', () => ({
  loadCategoriesCache: jest.fn(() => []),
  saveCategoriesCache: jest.fn(),
}));

describe('CreateOrderPage', () => {
  beforeEach(() => {
    __resetMocks();
  });

  it('renders transaction type options', () => {
    render(
      <MemoryRouter>
        <CreateOrderPage />
      </MemoryRouter>
    );

    expect(screen.getByText('sale')).toBeInTheDocument();
    expect(screen.getByText('purchase')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
  });
});
