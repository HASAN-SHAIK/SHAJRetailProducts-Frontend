// cypress/e2e/createOrder.cy.js

describe('Create Order Page Functionalities', () => {

  beforeEach(() => {
    cy.visit('https://inventorymanagement-frontend-qa.onrender.com/');
    cy.get('input[type="email"]').type('admin@example.com');
    cy.get('input[type="password"]').type('admin');
    cy.get('button').contains(`Let's Go`).click();
    cy.wait(10000); // Wait for the login to complete
    cy.url().should('include', '/dashboard');
    cy.contains('New Order').click();
  });

  const waitForOrdersPage = () => {
    cy.url({ timeout: 10000 }).should('include', '/orders');
  };
  it('Create Purchase Order - All Fields Filled', () => {
    cy.get('input[value="purchase"]').click();
    cy.contains('Add Product').click();
    cy.get('input[placeholder="product name"]').first().type('New Product');
    cy.get('input[placeholder="company"]').first().type('New Company');
    cy.get('input[placeholder="quantity"]').first().type('10');
    cy.get('input[placeholder="Purchase Price"]').first().type('50');
    cy.get('input[placeholder="selling price"]').first().type('60');
    cy.get('input[list="categories-list"]').first().type('Electronics');
    cy.get('input[placeholder="time for delivery"]').first().type('2');
    cy.get('input[value="online"]').click();
    cy.contains('Create Order').click();
    waitForOrdersPage();
  });
  it('Create Sale Order - All Fields Filled', () => {
    cy.get('input[value="sale"]').click();
    cy.contains('Add Product').click();
    cy.get('input[placeholder="Search Product"]').first().type('lap');
    cy.wait(1000);
    cy.get('.list-group-item-action').first().click();
    cy.get('[data-testid="sale-quantity-input"]').first().type('2');
    cy.contains('Add Product').click();
    cy.get('input[placeholder="Search Product"]').last().type('phone');
    cy.wait(1000);
    cy.get('.list-group-item-action').first().click();
    cy.get('[data-testid="sale-quantity-input"]').last().type('1');
    cy.get('input[value="cash"]').click();
    cy.contains('Create Order').click();
    waitForOrdersPage();
  });

  it('Create Sale Order - Missing Fields', () => {
    cy.get('input[value="sale"]').click();
    cy.get('input[value="cash"]').click();
    cy.contains('Create Order').click();
    cy.contains('Select product and quantity').should('exist');
  });

  it('Create Sale Order - Weight Based Product Allows Decimals', () => {
    cy.intercept('GET', '**/products/search?name=apples*', {
      statusCode: 200,
      body: {
        products: [
          {
            id: 1001,
            name: 'Apples',
            company: 'Farm Fresh',
            selling_price: 50,
            stock_quantity: 5,
            is_weight_based: 1,
          },
        ],
      },
    });

    cy.get('input[value="sale"]').click();
    cy.contains('Add Product').click();
    cy.get('input[placeholder="Search Product"]').first().type('apples');
    cy.wait(500);
    cy.get('.list-group-item-action').first().click();
    cy.contains('Use decimal for kg, e.g., 1.25').should('exist');
    cy.get('[data-testid="sale-quantity-input"]').first().clear().type('1.25');
    cy.get('[data-testid="sale-quantity-input"]').first().should('have.value', '1.25');
    cy.get('[data-testid="sale-quantity-input"]').first().clear().type('6');
    cy.contains('Entered weight exceeds stock').should('exist');
    cy.get('.close-button').click();
  });

  it('Create Sale Order - Piece Product Rejects Decimals', () => {
    cy.intercept('GET', '**/products/search?name=bolt*', {
      statusCode: 200,
      body: {
        products: [
          {
            id: 1002,
            name: 'Bolt',
            company: 'Hardware',
            selling_price: 10,
            stock_quantity: 100,
            is_weight_based: 0,
          },
        ],
      },
    });

    cy.get('input[value="sale"]').click();
    cy.contains('Add Product').click();
    cy.get('input[placeholder="Search Product"]').first().type('bolt');
    cy.wait(500);
    cy.get('.list-group-item-action').first().click();
    cy.get('[data-testid="sale-quantity-input"]').first().clear().type('1.5');
    cy.contains('Invalid input for piece item').should('exist');
    cy.get('.close-button').click();
  });



  it('Create Purchase Order - Missing Fields', () => {
    cy.get('input[value="purchase"]').click();
    cy.contains('Add Product').click();
    cy.get('input[placeholder="product name"]').first().type('New Product');
    cy.get('input[value="online"]').click();
    cy.contains('Create Order').click();
    cy.contains('Fill all product details').should('exist');
  });

  it('Create Personal Order - All Fields Filled', () => {
    cy.get('input[value="personal"]').click();
    cy.get('input[value="online"]').click();
    cy.get('input[type="number"]').type('500');
    cy.contains('Create Order').click();
    waitForOrdersPage();
  });

  it('Create Personal Order - Missing Fields', () => {
    cy.get('input[value="personal"]').click();
    cy.get('input[value="online"]').click();
    cy.contains('Create Order').click();
    cy.contains('Enter amount for personal transaction').should('exist');
  });

  it('Delete Newly Created Order', () => {
    cy.contains('Orders').click();
    cy.wait(3000);
    cy.get('table tbody tr').first().within(() => {
      cy.get('button').contains('Delete').click();
    });
    cy.on('window:confirm', () => true);
    cy.wait(500);
  });
      it('Make Payment disables Delete Button', () => {
        cy.contains('Orders').click();
        cy.wait(3000);

        // Assuming you have a test order at the top
        cy.contains('Done').first().click();
        cy.wait(1000); // wait for backend processing

        // Check if the Delete button is disabled after payment
        cy.get('button').contains('Delete').first().should('be.disabled');
    });
});

