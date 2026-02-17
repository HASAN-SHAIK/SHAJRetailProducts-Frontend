import { render, screen } from '@testing-library/react';
import Orders from '../../pages/Orders';

jest.mock('../../components/OrdersPage/OrdersPage', () => () => <div>Orders Page</div>);

describe('Orders', () => {
  it('renders orders page content', () => {
    render(<Orders userRole="admin" navigate={jest.fn()} />);

    expect(screen.getByText('Orders Page')).toBeInTheDocument();
  });
});
