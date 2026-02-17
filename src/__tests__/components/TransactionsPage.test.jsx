import { render, screen, waitFor } from '@testing-library/react';
import TransactionsPage from '../../components/TransactionPage/TransactionsPage';
import api from '../../utils/axios';

const mockShowPopup = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../utils/axios', () => ({
  get: jest.fn(),
}));

jest.mock('../../components/common/PopUp/PopupProvider', () => ({
  usePopup: () => ({ showPopup: mockShowPopup }),
}));

jest.mock('../../components/common/LoadingSpinner/LoadingSpinner', () => () => (
  <div>Loading Spinner</div>
));

jest.mock('../../components/common/InfoCard/InfoCard', () => ({ title, value }) => (
  <div>
    {title}: {String(value)}
  </div>
));

jest.mock('../../components/common/BadgeStatus/BadgeStatus', () => ({ status }) => (
  <span>{status}</span>
));

jest.mock('../../components/common/HighlightedTable/HighLightedTable', () => ({ title }) => (
  <div>{title}</div>
));

describe('TransactionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner while fetching data', () => {
    api.get.mockReturnValue(new Promise(() => {}));

    render(<TransactionsPage navigate={mockNavigate} />);

    expect(screen.getByText('Loading Spinner')).toBeInTheDocument();
  });

  it('renders summary cards and highlighted table when data loads', async () => {
    api.get.mockResolvedValue({
      data: {
        total_income: 1000,
        total_cash: 600,
        total_online: 400,
        transactions: [
          {
            order_id: 1,
            user: 'Sam',
            total_price: 250,
            payment_mode: 'cash',
            transaction_type: 'sale',
            order_status: 'completed',
            transaction_date: '2026-02-14T10:00:00Z',
          },
        ],
      },
    });

    render(<TransactionsPage navigate={mockNavigate} />);

    expect(await screen.findByText('Total Revenue: 1000')).toBeInTheDocument();
    expect(screen.getByText('Total Cash: 600')).toBeInTheDocument();
    expect(screen.getByText('Total Online: 400')).toBeInTheDocument();
    expect(screen.getByText('Total Transactions: 1')).toBeInTheDocument();
    expect(screen.getByText('Success Rate: 100%')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('navigates to logout on invalid token', async () => {
    api.get.mockRejectedValue({
      response: { status: 401, data: { message: 'Invalid Token' } },
    });

    render(<TransactionsPage navigate={mockNavigate} />);

    await waitFor(() =>
      expect(mockShowPopup).toHaveBeenCalledWith('Token Expired Please Login Again!', 'Session')
    );
    expect(mockNavigate).toHaveBeenCalledWith('/logout');
  });
});
