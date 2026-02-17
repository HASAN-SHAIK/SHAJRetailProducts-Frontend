import { render, screen } from '@testing-library/react';
import Dashboard from '../../pages/Dashboard';
import { ThemeContext } from '../../ThemeContext';

jest.mock('../../components/Dashboard/DashboardOverview/DashboardOverview', () => () => (
  <div>Dashboard Overview</div>
));

describe('Dashboard', () => {
  it('renders dashboard overview', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: jest.fn() }}>
        <Dashboard navigate={jest.fn()} />
      </ThemeContext.Provider>
    );

    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
  });
});
