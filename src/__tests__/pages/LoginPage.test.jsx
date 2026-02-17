import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage';

jest.mock('../../utils/axios', () => ({}));

jest.mock('../../components/Login/Login', () => () => <div>Login Component</div>);

describe('LoginPage', () => {
  it('renders login component', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Login Component')).toBeInTheDocument();
  });
});
