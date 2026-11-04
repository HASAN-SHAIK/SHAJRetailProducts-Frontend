const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'CustomerList.jsx'), 'utf8');

// Phase 2 / Stage 1: the POS customer list is restored (it was a RetailHub redirect).
describe('POS customer list screen', () => {
  test('is a real screen, not a redirect stub', () => {
    expect(source).not.toContain('<Navigate');
    expect(source).not.toContain('to="/billing/retail"');
  });

  test('reads customers through the repository facade with search', () => {
    expect(source).toContain("from '../../services/local'");
    expect(source).toContain('searchCustomers(');
  });

  test('renders loading, empty, error and offline states', () => {
    expect(source).toContain('Loading customers...');
    expect(source).toContain('No customers found.');
    expect(source).toContain('No customers match your search.');
    expect(source).toContain('Could not load customers');
    expect(source).toContain('Offline: showing customers saved on this device');
  });

  test('links to create, view and edit routes', () => {
    expect(source).toContain("navigate('/customers/new')");
    expect(source).toContain('navigate(`/customers/${customer.id}`)');
    expect(source).toContain('navigate(`/customers/${customer.id}/edit`)');
  });

  test('shows financial columns as read-only text with no inputs for them', () => {
    expect(source).toContain('formatInr(customer.current_balance)');
    expect(source).toContain('formatInr(customer.credit_limit)');
    expect(source).not.toMatch(/<input[^>]*(credit_limit|current_balance)/);
  });
});
