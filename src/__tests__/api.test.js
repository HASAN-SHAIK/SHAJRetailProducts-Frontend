import axios from "axios";
import MockAdapter from "axios-mock-adapter";

const mock = new MockAdapter(axios);

describe("API Tests", () => {
  test("✅ GET /products API works", async () => {
    console.log("🔍 Testing GET /products API");

    mock.onGet("/api/products").reply(200, [{ id: 1, name: "Item" }]);

    const res = await axios.get("/api/products");

    console.log("📦 Response:", res.data);

    expect(res.status).toBe(200);
    expect(res.data.length).toBe(1);
  });

  test("❌ API failure case", async () => {
    console.log("🔍 Testing API failure");

    mock.onGet("/api/error").reply(500);

    try {
      await axios.get("/api/error");
    } catch (err) {
      console.log("⚠️ Error captured:", err.response.status);
      expect(err.response.status).toBe(500);
    }
  });
});// JavaScript source code
