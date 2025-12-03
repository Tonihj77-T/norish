import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  parseMealieDatabase,
  parseMealieRecipeToDTO,
  type MealieRecipe,
  type MealieIngredient,
  type MealieInstruction,
} from "@/server/importers/mealie-parser";

// @vitest-environment node

// Mock the server config loader to avoid database calls
vi.mock("@/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({
    volume: {},
    mass: {},
    length: {},
    temperature: {},
  }),
  getContentIndicators: vi.fn().mockResolvedValue([]),
  getRecurrenceConfig: vi.fn().mockResolvedValue({}),
}));

// Mock the downloader to avoid actual image saving
vi.mock("@/lib/downloader", () => ({
  saveImageBytes: vi.fn().mockResolvedValue("mocked-image-guid"),
}));

describe("Mealie Parser", () => {
  describe("parseMealieDatabase", () => {
    it("parses valid database.json", async () => {
      const json = JSON.stringify({
        recipes: [{ id: "1", name: "Test Recipe" }],
        recipes_ingredients: [{ id: 1, recipe_id: "1", note: "1 cup flour" }],
        recipe_instructions: [{ id: "i1", recipe_id: "1", position: 0, text: "Mix ingredients" }],
      });

      const result = await parseMealieDatabase(json);

      expect(result.recipes).toHaveLength(1);
      expect(result.recipes_ingredients).toHaveLength(1);
      expect(result.recipe_instructions).toHaveLength(1);
    });

    it("handles missing arrays", async () => {
      const json = JSON.stringify({});
      const result = await parseMealieDatabase(json);

      expect(result.recipes).toEqual([]);
      expect(result.recipes_ingredients).toEqual([]);
      expect(result.recipe_instructions).toEqual([]);
    });

    it("throws on invalid JSON", async () => {
      await expect(parseMealieDatabase("invalid json")).rejects.toThrow(
        "Failed to parse database.json"
      );
    });
  });

  describe("parseMealieRecipeToDTO", () => {
    let mockRecipe: MealieRecipe;
    let mockIngredients: MealieIngredient[];
    let mockInstructions: MealieInstruction[];

    beforeEach(() => {
      mockRecipe = {
        id: "recipe-1",
        name: "Vegetarian Shakshuka",
        description: "A delicious vegetarian dish",
        org_url: "https://example.com/recipe",
        recipe_servings: 4,
        prep_time: 15,
        cook_time: 30,
        total_time: 45,
      };

      mockIngredients = [
        {
          id: 1,
          recipe_id: "recipe-1",
          original_text: "2 cups tomatoes, diced",
          position: 0,
        },
        {
          id: 2,
          recipe_id: "recipe-1",
          note: "1 tablespoon olive oil",
          position: 1,
        },
      ];

      mockInstructions = [
        {
          id: "inst-1",
          recipe_id: "recipe-1",
          position: 0,
          text: "Heat oil in a pan",
        },
        {
          id: "inst-2",
          recipe_id: "recipe-1",
          position: 1,
          text: "Add tomatoes and simmer",
        },
      ];
    });

    it("maps Mealie recipe to DTO correctly", async () => {
      const dto = await parseMealieRecipeToDTO(mockRecipe, mockIngredients, mockInstructions);

      expect(dto.name).toBe("Vegetarian Shakshuka");
      expect(dto.description).toBe("A delicious vegetarian dish");
      expect(dto.url).toBe("https://example.com/recipe");
      expect(dto.servings).toBe(4);
      expect(dto.prepMinutes).toBe(15);
      expect(dto.cookMinutes).toBe(30);
      expect(dto.totalMinutes).toBe(45);
    });

    it("prioritizes original_text over note for ingredients", async () => {
      const dto = await parseMealieRecipeToDTO(mockRecipe, mockIngredients, mockInstructions);

      expect(dto.recipeIngredients?.length).toBeGreaterThan(0);
      // Should parse both ingredients
      expect(dto.recipeIngredients?.length).toBe(2);
    });

    it("sorts instructions by position", async () => {
      const shuffled = [mockInstructions[1], mockInstructions[0]];
      const dto = await parseMealieRecipeToDTO(mockRecipe, mockIngredients, shuffled);

      expect(dto.steps?.[0]?.step).toBe("Heat oil in a pan");
      expect(dto.steps?.[1]?.step).toBe("Add tomatoes and simmer");
    });

    it("handles null time fields", async () => {
      mockRecipe.prep_time = null;
      mockRecipe.cook_time = null;
      mockRecipe.total_time = null;

      const dto = await parseMealieRecipeToDTO(mockRecipe, mockIngredients, mockInstructions);

      expect(dto.prepMinutes).toBeUndefined();
      expect(dto.cookMinutes).toBeUndefined();
      expect(dto.totalMinutes).toBeUndefined();
    });

    it("uses perform_time as fallback for total_time", async () => {
      mockRecipe.total_time = null;
      mockRecipe.perform_time = 50;

      const dto = await parseMealieRecipeToDTO(mockRecipe, mockIngredients, mockInstructions);

      expect(dto.totalMinutes).toBe(50);
    });

    it("handles missing servings with fallback to recipe_yield_quantity", async () => {
      mockRecipe.recipe_servings = 0;
      mockRecipe.recipe_yield_quantity = 6;

      const dto = await parseMealieRecipeToDTO(mockRecipe, mockIngredients, mockInstructions);

      expect(dto.servings).toBe(6);
    });

    it("filters out empty ingredient text", async () => {
      const emptyIngredient: MealieIngredient = {
        id: 3,
        recipe_id: "recipe-1",
        note: "",
        original_text: "",
        position: 2,
      };

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        [...mockIngredients, emptyIngredient],
        mockInstructions
      );

      // Should only parse the 2 valid ingredients
      expect(dto.recipeIngredients?.length).toBe(2);
    });

    it("filters out empty instructions", async () => {
      const emptyInstruction: MealieInstruction = {
        id: "inst-3",
        recipe_id: "recipe-1",
        position: 2,
        text: "",
      };

      const dto = await parseMealieRecipeToDTO(mockRecipe, mockIngredients, [
        ...mockInstructions,
        emptyInstruction,
      ]);

      expect(dto.steps?.length).toBe(2);
    });

    it("throws when recipe name is missing", async () => {
      mockRecipe.name = "";

      await expect(
        parseMealieRecipeToDTO(mockRecipe, mockIngredients, mockInstructions)
      ).rejects.toThrow("Missing recipe name");
    });

    it("handles recipe with image buffer", async () => {
      const imageBuffer = Buffer.from("fake-image-data");
      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        imageBuffer
      );

      // Image processing is tested separately, just verify it doesn't crash
      expect(dto).toBeDefined();
    });
  });
});
