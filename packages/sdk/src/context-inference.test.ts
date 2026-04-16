import { describe, expect, it } from "vitest";
import { inferContextFromUrl } from "./context-inference.js";

describe("inferContextFromUrl", () => {
  it("returns addtocart for cart URLs", () => {
    expect(inferContextFromUrl("https://shop.test/cart")).toBe("addtocart");
  });

  it("returns checkout for checkout URLs", () => {
    expect(inferContextFromUrl("https://shop.test/checkout/start")).toBe("checkout");
  });

  it("returns arrival for non-cart URLs", () => {
    expect(inferContextFromUrl("https://shop.test/products/widget")).toBe("arrival");
  });

  it("returns arrival for malformed URLs", () => {
    expect(inferContextFromUrl("not a valid url")).toBe("arrival");
  });

  it("does not match cart as substring of other segments", () => {
    expect(inferContextFromUrl("https://shop.test/cartoon")).toBe("arrival");
    expect(inferContextFromUrl("https://shop.test/go-kart/items")).toBe("arrival");
  });

  it("returns checkout for /checkout/cart (checkout takes precedence)", () => {
    expect(inferContextFromUrl("https://shop.test/checkout/cart")).toBe("checkout");
  });
});
