const fs = require('fs');
const path = require('path');

describe('OrdersPage return modal detail fallback', () => {
  const source = fs.readFileSync(path.join(__dirname, 'OrdersPage.js'), 'utf8');

  test('passes the clicked order row into the return modal loader', () => {
    expect(source).toContain('openReturnModal(event, order.id, order)');
    expect(source).toContain('openReturnModal(event, drawerOrder?.id, drawerOrder)');
  });

  test('uses loaded order row items if full detail lookup fails', () => {
    expect(source).toContain('const clickedOrderItems = buildReturnItems(clickedOrder || {})');
    expect(source).toContain('orderData = clickedOrderFallback');
  });
});
