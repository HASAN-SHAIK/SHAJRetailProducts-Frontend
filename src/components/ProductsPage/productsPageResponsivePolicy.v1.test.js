import fs from 'fs';
import path from 'path';

describe('Area 5 Inventory Page Responsive Policy', () => {
  test('ProductsPage.css stacks controls and search input on screens below 768px', () => {
    const productsCss = fs.readFileSync(
      path.resolve(__dirname, 'ProductsPage.css'),
      'utf8'
    );

    expect(productsCss).toContain('@media (max-width: 768px)');
    expect(productsCss).toContain('flex-direction: column;');
    expect(productsCss).toContain('align-items: stretch;');
    expect(productsCss).toContain('width: 100% !important;');
  });

  test('ProductsPage.css provides responsive table scrolling and 44px touch targets', () => {
    const productsCss = fs.readFileSync(
      path.resolve(__dirname, 'ProductsPage.css'),
      'utf8'
    );

    expect(productsCss).toContain('products-table-wrapper');
    expect(productsCss).toContain('overflow-x: auto;');
    expect(productsCss).toContain('min-height: 44px;');
    expect(productsCss).toContain('touch-action: manipulation;');
  });

  test('AddProductModalComponent.css provides responsive modal sizing for mobile', () => {
    const modalCss = fs.readFileSync(
      path.resolve(__dirname, 'AddModalComponent/AddProductModalComponent.css'),
      'utf8'
    );

    expect(modalCss).toContain('@media (max-width: 768px)');
    expect(modalCss).toContain('width: 94vw !important;');
    expect(modalCss).toContain('max-height: 90vh;');
  });

  test('Customers.css (shared by Suppliers) provides single column form grids and table scrolling', () => {
    const customersCss = fs.readFileSync(
      path.resolve(__dirname, '../../pages/customers/Customers.css'),
      'utf8'
    );

    expect(customersCss).toContain('@media (max-width: 768px)');
    expect(customersCss).toContain('grid-template-columns: 1fr;');
    expect(customersCss).toContain('overflow-x: auto;');
  });
});
