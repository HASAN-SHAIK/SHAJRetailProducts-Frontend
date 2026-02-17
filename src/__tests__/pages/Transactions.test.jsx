import { render, screen } from '@testing-library/react';
import Transactions from '../../pages/Transactions';

jest.mock('../../components/TransactionPage/TransactionsPage', () => () => (
  <div>Transactions Page</div>
));

describe('Transactions', () => {
  it('renders transactions page content', () => {
    render(<Transactions navigate={jest.fn()} />);

    expect(screen.getByText('Transactions Page')).toBeInTheDocument();
  });
});
