import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

function DummyComponent() {
  return (
    <div>
      <button onClick={() => alert("clicked")}>Click Me</button>
      <input placeholder="Enter name" />
    </div>
  );
}

describe("UI Tests", () => {
  test("🟢 Button click test", () => {
    console.log("🔘 Testing button click");

    render(<DummyComponent />);

    const button = screen.getByText("Click Me");
    fireEvent.click(button);

    console.log("✅ Button clicked successfully");

    expect(button).toBeInTheDocument();
  });

  test("🟢 Input field test", () => {
    console.log("⌨️ Testing input field");

    render(<DummyComponent />);

    const input = screen.getByPlaceholderText("Enter name");
    fireEvent.change(input, { target: { value: "Aasim" } });

    console.log("📥 Input value:", input.value);

    expect(input.value).toBe("Aasim");
  });
});// JavaScript source code
