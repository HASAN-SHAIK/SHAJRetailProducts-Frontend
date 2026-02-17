import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardOverview from '../../components/Dashboard/DashboardOverview/DashboardOverview';
import api from '../../utils/axios';

const mockShowPopup = jest.fn();

jest.mock('../../utils/axios', () => ({
  get: jest.fn(),
}));

jest.mock('../../components/common/PopUp/PopupProvider', () => ({
  usePopup: () => ({ showPopup: mockShowPopup }),
}));

jest.mock('../../components/common/LoadingSpinner/LoadingSpinner', () => () => (
  <div>Loading Spinner</div>
));

jest.mock('../../components/common/StatBox/StatBox', () => ({ label, value }) => (
  <div>
    {label}: {String(value)}
  </div>
));

jest.mock('../../components/common/TableComponent/TableComponent', () => ({ title }) => (
  <div>{title}</div>
));

jest.mock('react-chartjs-2', () => ({
  Line: () => <div>Profit Chart</div>,
}));

jest.mock('chart.js', () => ({
  Chart: { register: jest.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
}));

const baseDaily = { total_revenue: 1200, profit: 300, total_orders: 10 };
const baseMonthly = {
  total_revenue: 24000,
  totalProfit: 4500,
  total_orders: 220,
  bestSellingProducts: [{ Name: 'A' }],
  profitByProduct: [{ Name: 'B' }],
};
const baseInventory = {
  total_stock: 50,
  low_stock_products: [{ ProductId: 1 }],
  out_of_stock_products: [{ ProductId: 2 }],
  total_inventory_value: 6000,
  total_inventory_actual_value: 4500,
  estimatedProfit: 1500,
};

describe('DashboardOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner while dashboard data is loading', () => {
    api.get.mockReturnValue(new Promise(() => {}));

    render(<DashboardOverview navigate={jest.fn()} />);

    expect(screen.getByText('Loading Spinner')).toBeInTheDocument();
  });

  it('renders stats, tables, and profit chart for successful data', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/reports/daily') return Promise.resolve({ data: baseDaily });
      if (url === '/reports/sales') return Promise.resolve({ data: baseMonthly });
      if (url === '/reports/inventory') return Promise.resolve({ data: baseInventory });
      if (url.startsWith('/reports/profit-graph')) {
        return Promise.resolve({ data: { labels: ['Mon'], data: [100] } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<DashboardOverview navigate={jest.fn()} />);

    expect(await screen.findByText("Today's Revenue: 1200")).toBeInTheDocument();
    expect(screen.getByText("Today's Profit: 300")).toBeInTheDocument();
    expect(screen.getByText("Today's Orders: 10")).toBeInTheDocument();
    expect(screen.getByText('Last Month Revenue: 24000')).toBeInTheDocument();
    expect(screen.getByText('Last Month Profit: 4500')).toBeInTheDocument();
    expect(screen.getByText('Last Month Orders: 220')).toBeInTheDocument();

    expect(screen.getByText('Most Selling Products')).toBeInTheDocument();
    expect(screen.getByText('Most Profitable Products')).toBeInTheDocument();
    expect(screen.getByText('Out of Stock Products')).toBeInTheDocument();
    expect(screen.getByText('Low on Stock')).toBeInTheDocument();

    expect(screen.getByText('Profit Chart')).toBeInTheDocument();
    expect(screen.getByText('Total Products: 50')).toBeInTheDocument();
  });

  it('shows empty state when profit data is empty', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/reports/daily') return Promise.resolve({ data: baseDaily });
      if (url === '/reports/sales') return Promise.resolve({ data: baseMonthly });
      if (url === '/reports/inventory') return Promise.resolve({ data: baseInventory });
      if (url.startsWith('/reports/profit-graph')) {
        return Promise.resolve({ data: { labels: ['Mon'], data: [0] } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<DashboardOverview navigate={jest.fn()} />);

    expect(await screen.findByText('No profit data for this range.')).toBeInTheDocument();
  });

  it('requests profit graph data when range changes', async () => {
    const calls = [];
    api.get.mockImplementation((url) => {
      calls.push(url);
      if (url === '/reports/daily') return Promise.resolve({ data: baseDaily });
      if (url === '/reports/sales') return Promise.resolve({ data: baseMonthly });
      if (url === '/reports/inventory') return Promise.resolve({ data: baseInventory });
      if (url.startsWith('/reports/profit-graph')) {
        return Promise.resolve({ data: { labels: ['Mon'], data: [100] } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<DashboardOverview navigate={jest.fn()} />);

    await screen.findByText("Today's Revenue: 1200");

    await userEvent.click(screen.getByRole('button', { name: /last 365 days/i }));

    await waitFor(() =>
      expect(calls).toContain('/reports/profit-graph?range=365')
    );
  });

  it('navigates to login on invalid token response', async () => {
    const navigate = jest.fn();
    api.get.mockImplementation((url) => {
      if (url === '/reports/daily') {
        return Promise.reject({ response: { status: 401, data: { message: 'Invalid Token' } } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<DashboardOverview navigate={navigate} />);

    await waitFor(() => expect(mockShowPopup).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
