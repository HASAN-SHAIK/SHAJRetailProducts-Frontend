describe("Basic App Flow", () => {
  it("App loads", () => {
    cy.visit("/");

    cy.get("body").should("exist");

    cy.get("button").should("have.length.greaterThan", 0);

    cy.log("✅ Basic app test passed");
  });
});