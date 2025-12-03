import { describe, it, expect } from "vitest";
import JSZip from "jszip";

import {
  detectArchiveFormat,
  calculateBatchSize,
  ArchiveFormat,
} from "@/server/importers/archive-parser";

// @vitest-environment node

describe("Archive Parser", () => {
  describe("detectArchiveFormat", () => {
    it("detects Mealie format (database.json present)", async () => {
      const zip = new JSZip();

      zip.file("database.json", JSON.stringify({ recipes: [] }));

      const format = await detectArchiveFormat(zip);

      expect(format).toBe(ArchiveFormat.MEALIE);
    });

    it("detects Mela format (.melarecipe files present)", async () => {
      const zip = new JSZip();

      zip.file("recipe1.melarecipe", JSON.stringify({ title: "Recipe 1" }));
      zip.file("recipe2.melarecipe", JSON.stringify({ title: "Recipe 2" }));

      const format = await detectArchiveFormat(zip);

      expect(format).toBe(ArchiveFormat.MELA);
    });

    it("prioritizes Mealie over Mela when both exist", async () => {
      const zip = new JSZip();

      zip.file("database.json", JSON.stringify({ recipes: [] }));
      zip.file("recipe.melarecipe", JSON.stringify({ title: "Recipe" }));

      const format = await detectArchiveFormat(zip);

      expect(format).toBe(ArchiveFormat.MEALIE);
    });

    it("returns UNKNOWN for empty archive", async () => {
      const zip = new JSZip();
      const format = await detectArchiveFormat(zip);

      expect(format).toBe(ArchiveFormat.UNKNOWN);
    });

    it("returns UNKNOWN for archive with unrelated files", async () => {
      const zip = new JSZip();

      zip.file("readme.txt", "Some text");
      zip.file("image.jpg", "fake image data");

      const format = await detectArchiveFormat(zip);

      expect(format).toBe(ArchiveFormat.UNKNOWN);
    });

    it("detects Mela with case-insensitive extension", async () => {
      const zip = new JSZip();

      zip.file("recipe.MELARECIPE", JSON.stringify({ title: "Recipe" }));

      const format = await detectArchiveFormat(zip);

      expect(format).toBe(ArchiveFormat.MELA);
    });

    it("detects Tandoor format (nested .zip files with recipe.json)", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("recipe.json", JSON.stringify({ name: "Test Recipe", steps: [] }));

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("recipe_1.zip", nestedZipBuffer);

      const format = await detectArchiveFormat(mainZip);

      expect(format).toBe(ArchiveFormat.TANDOOR);
    });

    it("prioritizes Mealie over Tandoor when both exist", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("recipe.json", JSON.stringify({ name: "Test Recipe", steps: [] }));

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("database.json", JSON.stringify({ recipes: [] }));
      mainZip.file("recipe_1.zip", nestedZipBuffer);

      const format = await detectArchiveFormat(mainZip);

      expect(format).toBe(ArchiveFormat.MEALIE);
    });

    it("returns UNKNOWN for nested zip without recipe.json", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("wrong-file.txt", "not a recipe");

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("not_a_recipe.zip", nestedZipBuffer);

      const format = await detectArchiveFormat(mainZip);

      expect(format).toBe(ArchiveFormat.UNKNOWN);
    });
  });

  describe("calculateBatchSize", () => {
    it("returns 10 for <100 recipes", () => {
      expect(calculateBatchSize(1)).toBe(10);
      expect(calculateBatchSize(50)).toBe(10);
      expect(calculateBatchSize(99)).toBe(10);
    });

    it("returns 25 for 100-500 recipes", () => {
      expect(calculateBatchSize(100)).toBe(25);
      expect(calculateBatchSize(250)).toBe(25);
      expect(calculateBatchSize(500)).toBe(25);
    });

    it("returns 50 for >500 recipes", () => {
      expect(calculateBatchSize(501)).toBe(50);
      expect(calculateBatchSize(1000)).toBe(50);
      expect(calculateBatchSize(5000)).toBe(50);
    });

    it("handles edge cases", () => {
      expect(calculateBatchSize(0)).toBe(10);
      expect(calculateBatchSize(100)).toBe(25);
      expect(calculateBatchSize(500)).toBe(25);
      expect(calculateBatchSize(501)).toBe(50);
    });
  });
});
