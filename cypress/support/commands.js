Cypress.Commands.add("login", () => {
  const email = Cypress.env("email");
  const password = Cypress.env("password");

  if (!email || !password) {
    throw new Error(
      "❌ Missing credentials. Set CYPRESS_EMAIL and CYPRESS_PASSWORD"
    );
  }

  cy.visit("/login");

  cy.log("🔐 Logging in...");

  // Flexible selectors (important)
  cy.get('input[type="email"], input[placeholder*="Email" i]')
    .first()
    .type(email);

  cy.get('input[type="password"]').type(password);

  cy.get("button")
    .contains(/login|sign in/i)
    .click();

  cy.url().should("include", "/dashboard");

  cy.log("✅ Login success");
});
