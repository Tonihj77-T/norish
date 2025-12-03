import { describe, it, expect } from "vitest";

import { parseIsoDuration, formatMinutesHM, parseIngredientWithDefaults } from "@/lib/helpers";

describe("parseIsoDuration", () => {
  it("parses hours and minutes", () => {
    expect(parseIsoDuration("PT1H30M")).toBe(90);
  });

  it("parses hours only", () => {
    expect(parseIsoDuration("PT2H")).toBe(120);
  });

  it("parses minutes only", () => {
    expect(parseIsoDuration("PT45M")).toBe(45);
  });

  it("returns undefined for invalid format", () => {
    expect(parseIsoDuration("invalid")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseIsoDuration("")).toBeUndefined();
  });
});

describe("formatMinutesHM", () => {
  it("formats minutes under an hour", () => {
    expect(formatMinutesHM(45)).toBe("45m");
  });

  it("formats exactly one hour", () => {
    expect(formatMinutesHM(60)).toBe("1:00h");
  });

  it("formats hours and minutes", () => {
    expect(formatMinutesHM(90)).toBe("1:30h");
  });

  it("pads minutes with zero", () => {
    expect(formatMinutesHM(65)).toBe("1:05h");
  });

  it("returns undefined for null", () => {
    expect(formatMinutesHM(undefined)).toBeUndefined();
  });

  it("returns undefined for negative", () => {
    expect(formatMinutesHM(-5)).toBeUndefined();
  });
});

describe("parseIngredientWithDefaults", () => {
  it("parses simple ingredient", () => {
    const result = parseIngredientWithDefaults("2 cups flour");

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
    expect(result[0].unitOfMeasure).toBe("cups");
    expect(result[0].description).toBe("flour");
  });

  it("parses ingredient without unit", () => {
    const result = parseIngredientWithDefaults("3 eggs");

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
    expect(result[0].description).toContain("egg");
  });

  it("parses array of ingredients", () => {
    const result = parseIngredientWithDefaults(["1 cup sugar", "2 tbsp butter"]);

    expect(result).toHaveLength(2);
  });

  it("handles empty input", () => {
    const result = parseIngredientWithDefaults("");

    expect(result).toHaveLength(0);
  });

  it("parses with custom units", () => {
    const customUnits = {
      stuk: { short: "st", plural: "stuks", alternates: [] },
    };
    const result = parseIngredientWithDefaults("2 stuk appel", customUnits);

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
  });

  it("handles reordering for better parsing", () => {
    // Test case where unit comes after description
    const customUnits = {
      gram: { short: "g", plural: "grams", alternates: [] },
    };
    const result = parseIngredientWithDefaults("flour 500g", customUnits);

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(500);
  });
});
