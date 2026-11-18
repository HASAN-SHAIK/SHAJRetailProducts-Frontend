import fs from 'fs';
import path from 'path';

describe('Area 4 Orders Page Responsive Policy', () => {
  test('OrdersPage.css wraps controls and search input on screens below 992px', () => {
    const ordersCss = fs.readFileSync(
      path.resolve(__dirname, 'OrdersPage.css'),
      'utf8'
    );

    expect(ordersCss).toContain('@media (max-width: 992px)');
    expect(ordersCss).toContain('flex-wrap: wrap;');
    expect(ordersCss).toContain('search-input');
    expect(ordersCss).toContain('width: 100%;');
  });

  test('OrdersPage.css provides responsive table scrolling and 44px touch targets on mobile', () => {
    const ordersCss = fs.readFileSync(
      path.resolve(__dirname, 'OrdersPage.css'),
      'utf8'
    );

    expect(ordersCss).toContain('@media (max-width: 768px)');
    expect(ordersCss).toContain('orders-table-wrapper');
    expect(ordersCss).toContain('overflow-x: auto;');
    expect(ordersCss).toContain('min-height: 44px;');
    expect(ordersCss).toContain('touch-action: manipulation;');
  });

  test('EditOrderModal.css adapts to mobile screens without fixed 50% width', () => {
    const modalCss = fs.readFileSync(
      path.resolve(__dirname, 'EditOrderModal/EditOrderModal.css'),
      'utf8'
    );

    expect(modalCss).toContain('@media (max-width: 768px)');
    expect(modalCss).toContain('width: 95% !important;');
    expect(modalCss).toContain('max-height: 90vh !important;');
  });
});
