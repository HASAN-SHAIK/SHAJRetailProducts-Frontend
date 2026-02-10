describe('Dashboard E2E', () => {
  it('loads dashboard data and key sections', () => {
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
      cy.contains(label)
        .should('be.visible')
        .parent()
        .find('p')
        .should('not.be.empty');
    });

    cy.contains('Profit Trend').should('be.visible');
    cy.contains('button', 'Last 30 Days').should('be.visible');
    cy.contains('button', 'Last 365 Days').should('be.visible');

    cy.get('.profit-graph-body')
      .find('canvas, .profit-empty')
      .should('exist');

    cy.get('.tables-section').should('exist');
  });
});
