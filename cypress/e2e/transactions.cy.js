describe('Transactions Page E2E (Real Backend)', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/transactions');
    cy.url().should('include', '/transactions');
  });

  it('loads the transactions page and key sections', () => {
    cy.get('.transactions-page').should('exist');

    cy.contains('Total Transactions').should('be.visible');
    cy.contains('Success Rate').should('be.visible');

    cy.get('table').should('exist');
    cy.contains('th', 'OrderId').should('be.visible');
    cy.contains('th', 'User').should('be.visible');
    cy.contains('th', 'Amount(Mode)').should('be.visible');
    cy.contains('th', 'Type').should('be.visible');
    cy.contains('th', 'Status').should('be.visible');
    cy.contains('th', 'Date').should('be.visible');
  });

  it('shows loading spinner during initial fetch if present', () => {
    cy.get('body').then(($body) => {
      if ($body.find('.spinner-style').length) {
        cy.get('.spinner-style').should('be.visible');
      }
    });
  });

  it('renders transactions rows or empty state', () => {
    cy.get('table tbody').then(($tbody) => {
      if ($tbody.text().includes('No Transactions')) {
        cy.contains('No Transactions').should('be.visible');
      } else {
        cy.get('table tbody tr').should('have.length.at.least', 1);
      }
    });
  });
});
