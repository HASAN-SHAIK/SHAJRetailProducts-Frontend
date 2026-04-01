describe("Products Page – End-to-End Tests", () => {
  beforeEach(() => {
    cy.login();
    cy.visit("/products");
  });

  it("Page loads", () => {
    cy.contains(/product/i).should("exist");
  });

  it("Has buttons", () => {
    cy.get("button").should("have.length.greaterThan", 0);
  });
});