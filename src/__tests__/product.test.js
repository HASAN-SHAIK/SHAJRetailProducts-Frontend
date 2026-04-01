import axios from "axios";

jest.mock("axios");

describe("📦 Product APIs", () => {
  test("Fetch products", async () => {
    const mockData = [{ id: 1, name: "Item" }];

    axios.get.mockResolvedValue({ data: mockData });

    const res = await axios.get("/api/products");

    console.log("📦 Products:", res.data);

    expect(res.data.length).toBeGreaterThan(0);
  });

  test("API failure handled", async () => {
    axios.get.mockRejectedValue({ response: { status: 500 } });

    try {
      await axios.get("/api/products");
    } catch (err) {
      console.log("⚠️ API failed:", err.response.status);
      expect(err.response.status).toBe(500);
    }
  });
});// JavaScript source code
