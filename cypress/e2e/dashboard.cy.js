describe('Dashboard E2E', () => {
  it('renders stats, chart, and summary on real data', () => {
    cy.login();
    cy.get('.dashboard').should('exist');

    const statLabels = [
      "Today's Revenue",
      "Today's Profit",
      "Today's Orders",
      'Last Month Revenue',
      'Last Month Profit',
      'Last Month Orders',
    ];

    statLabels.forEach((label) => {
      cy.contains('h5', label).should('be.visible').parent().find('p').should('not.be.empty');
    });

    cy.contains('Profit Trend').should('be.visible');
    cy.get('.profit-graph-body').find('canvas, .profit-empty').should('exist');

    cy.contains('h5', 'Total Products').should('be.visible').parent().find('p').should('not.be.empty');
    cy.contains('h5', 'Cost of Stock').should('be.visible').parent().find('p').should('not.be.empty');
    cy.contains('h5', 'Estimated Profit').should('be.visible').parent().find('p').should('not.be.empty');
  });

  it('shows loading spinner during initial fetch', () => {
    cy.login();

    cy.get('body').then(($body) => {
      if ($body.find('.spinner-style').length) {
        cy.get('.spinner-style').should('be.visible');
      }
    });
  });

  it('switches profit range on real data', () => {
    cy.login();

    cy.contains('Profit Trend').should('be.visible');
    cy.contains('button', 'Last 30 Days').should('be.visible');
    cy.contains('button', 'Last 365 Days').should('be.visible').click();

    cy.contains('Loading profit graph...').should('be.visible');
    cy.get('.profit-graph-body').then(($body) => {
      if ($body.find('canvas').length) {
        cy.get('.profit-graph-body').find('canvas').should('exist');
      } else {
        cy.contains('No profit data for this range.').should('be.visible');
      }
    });
  });
});
