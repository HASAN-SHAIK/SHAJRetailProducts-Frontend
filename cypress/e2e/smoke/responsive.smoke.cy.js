const VIEWPORTS = [
  { name: 'mobile (375x812)', width: 375, height: 812 },
  { name: 'tablet (768x1024)', width: 768, height: 1024 },
  { name: 'desktop (1280x800)', width: 1280, height: 800 },
];

const RESPONSIVE_SCREENS = [
  { name: 'Retail Billing', path: '/billing/retail', primaryAction: '.billing-checkout' },
  { name: 'Wholesale Billing', path: '/billing/wholesale', primaryAction: '.billing-checkout' },
  { name: 'Dashboard', path: '/dashboard', primaryAction: '.nav-toggle, .nav-main-links' },
  { name: 'Sales Orders', path: '/orders/sales', primaryAction: 'table, .billing-empty, .orders-table' },
  { name: 'Inventory Catalog', path: '/inventory/catalog', primaryAction: 'input, table, button' },
];

describe('Smoke - Responsive Layout & Overflow (Unauthenticated)', () => {
  VIEWPORTS.forEach((vp) => {
    it(`renders login without horizontal overflow on ${vp.name}`, () => {
      cy.viewport(vp.width, vp.height);
      cy.visit('/');
      cy.location('pathname', { timeout: 15000 }).should((pathname) => {
        expect(['/', '/login'].some((p) => pathname === p)).to.eq(true);
      });
      cy.get('body').should('be.visible');
      cy.window().then((win) => {
        const scrollWidth = win.document.documentElement.scrollWidth;
        const innerWidth = win.innerWidth;
        expect(scrollWidth).to.be.at.most(innerWidth + 1);
      });
      cy.contains('button', /let's go/i).should('be.visible');
    });
  });
});

describe('Smoke - Responsive Layout & Overflow (Authenticated)', () => {
  beforeEach(() => {
    cy.resetTrackedEntities();
    cy.loginAndOpen('/dashboard');
  });

  afterEach(() => {
    cy.cleanupTrackedEntities();
  });

  VIEWPORTS.forEach((vp) => {
    context(`Viewport: ${vp.name}`, () => {
      beforeEach(() => {
        cy.viewport(vp.width, vp.height);
      });

      RESPONSIVE_SCREENS.forEach((screen) => {
        it(`loads ${screen.name} without horizontal overflow and displays primary controls`, () => {
          cy.visit(screen.path);
          cy.location('pathname', { timeout: 30000 }).should('include', screen.path);
          cy.get('body').should('be.visible');

          // Assert no horizontal overflow
          cy.window().then((win) => {
            const scrollWidth = win.document.documentElement.scrollWidth;
            const innerWidth = win.innerWidth;
            expect(scrollWidth).to.be.at.most(innerWidth + 1);
          });

          // Assert primary action / UI element exists
          if (screen.primaryAction) {
            cy.get(screen.primaryAction).should('exist');
          }

          // On mobile & tablet (< 992px), hamburger button in sticky top bar must be present
          if (vp.width < 992) {
            cy.get('.nav-toggle').should('exist');
          }
        });
      });
    });
  });
});
