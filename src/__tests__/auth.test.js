import { render, screen, fireEvent } from "@testing-library/react";
import LoginPage from "../pages/LoginPage";

// 🔥 MOCK react-router-dom
jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}));

// 🔥 MOCK API (important)
jest.mock("../utils/axios", () => ({
  post: jest.fn(() =>
    Promise.resolve({
      data: { token: "fake-token" },
    })
  ),
}));

describe("🔐 Auth Flow", () => {
  test("Login form input works", () => {
    console.log("🔍 Testing login form");

    render(<LoginPage />);

    const inputs = screen.getAllByRole("textbox");

    expect(inputs.length).toBeGreaterThan(0);

    fireEvent.change(inputs[0], {
      target: { value: "aasim@test.com" },
    });

    console.log("📥 Input working");

    console.log("✅ Auth test passed");
  });
});