describe("🔐 Login Flow", () => {
  it("should login", () => {
    cy.visit("/login");

    cy.get('input[type="email"], input').first().type("test@example.com");
    cy.get('input[type="password"]').type("password");

    cy.get("button").click();

    cy.url().should("include", "/dashboard");
  });
});