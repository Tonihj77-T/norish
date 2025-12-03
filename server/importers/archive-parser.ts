import JSZip from "jszip";

import { parseMelaArchive, parseMelaRecipeToDTO } from "./mela-parser";
import {
  parseMealieArchive,
  parseMealieRecipeToDTO,
  extractMealieRecipeImage,
} from "./mealie-parser";
import { extractTandoorRecipes, parseTandoorRecipeToDTO } from "./tandoor-parser";

import { RecipeDashboardDTO } from "@/types";
import { createRecipeWithRefs, getRecipeFull, findExistingRecipe } from "@/server/db";

export enum ArchiveFormat {
  MELA = "mela",
  MEALIE = "mealie",
  TANDOOR = "tandoor",
  UNKNOWN = "unknown",
}

export type ImportResult = {
  imported: RecipeDashboardDTO[];
  errors: Array<{ file: string; error: string }>; // keep going on partial failures
  skipped: number; // duplicates
};

/**
 * Detect archive format by inspecting contents
 * - Mealie: contains database.json
 * - Mela: contains .melarecipe files
 * - Tandoor: contains nested .zip files with recipe.json inside
 */
export async function detectArchiveFormat(zip: JSZip): Promise<ArchiveFormat> {
  // Check for Mealie format (database.json)
  const databaseFile = zip.file("database.json");

  if (databaseFile) {
    return ArchiveFormat.MEALIE;
  }

  // Check for Mela format (.melarecipe files)
  const melaFiles = zip.file(/\.melarecipe$/i);

  if (melaFiles.length > 0) {
    return ArchiveFormat.MELA;
  }

  // Check for Tandoor format (nested .zip files containing recipe.json)
  const nestedZips = zip.file(/\.zip$/i);

  if (nestedZips.length > 0) {
    // Try to load first nested zip and check for recipe.json
    try {
      const firstZipBuffer = await nestedZips[0].async("arraybuffer");
      const nestedZip = await JSZip.loadAsync(firstZipBuffer);
      const recipeFile = nestedZip.file("recipe.json");

      if (recipeFile) {
        return ArchiveFormat.TANDOOR;
      }
    } catch {
      // Not a valid Tandoor format
    }
  }

  return ArchiveFormat.UNKNOWN;
}

/**
 * Calculate dynamic batch size based on total recipe count
 * - <100 recipes: batch size 10
 * - 100-500 recipes: batch size 25
 * - >500 recipes: batch size 50
 */
export function calculateBatchSize(total: number): number {
  if (total < 100) return 10;
  if (total <= 500) return 25;

  return 50;
}

/**
 * Import Mela archive (.melarecipes format)
 */
async function importMelaRecipes(
  zip: JSZip,
  userId: string | undefined,
  userIds: string[],
  onProgress?: (
    current: number,
    recipe?: RecipeDashboardDTO,
    error?: { file: string; error: string }
  ) => void
): Promise<ImportResult> {
  const melaRecipes = await parseMelaArchive(zip);
  const imported: RecipeDashboardDTO[] = [];
  const errors: Array<{ file: string; error: string }> = [];
  let skipped = 0;

  for (let i = 0; i < melaRecipes.length; i++) {
    const melaRecipe = melaRecipes[i];
    const fileName = `recipe_${i + 1}.melarecipe`;

    try {
      const dto = await parseMelaRecipeToDTO(melaRecipe);

      // Check for duplicates
      const existingId = await findExistingRecipe(userIds, dto.url, dto.name);

      if (existingId) {
        skipped++;
        onProgress?.(i + 1, undefined, undefined);
        continue;
      }

      const id = crypto.randomUUID();
      const created = await createRecipeWithRefs(id, userId, dto);
      const recipe = await getRecipeFull(created as string);

      if (recipe) {
        imported.push(recipe as RecipeDashboardDTO);
        onProgress?.(i + 1, recipe as RecipeDashboardDTO);
      }
    } catch (e: any) {
      const error = { file: fileName, error: String(e?.message || e) };

      errors.push(error);
      onProgress?.(i + 1, undefined, error);
    }
  }

  return { imported, errors, skipped };
}

/**
 * Import Mealie archive (.zip with database.json)
 */
async function importMealieRecipes(
  zip: JSZip,
  userId: string | undefined,
  userIds: string[],
  onProgress?: (
    current: number,
    recipe?: RecipeDashboardDTO,
    error?: { file: string; error: string }
  ) => void
): Promise<ImportResult> {
  const { recipes, database } = await parseMealieArchive(zip);
  const imported: RecipeDashboardDTO[] = [];
  const errors: Array<{ file: string; error: string }> = [];
  let skipped = 0;

  for (let i = 0; i < recipes.length; i++) {
    const mealieRecipe = recipes[i];
    const fileName = `recipe_${mealieRecipe.name || mealieRecipe.id}`;

    try {
      // Extract ingredients and instructions for this recipe
      const ingredients = database.recipes_ingredients.filter(
        (ing) => ing.recipe_id === mealieRecipe.id
      );
      const instructions = database.recipe_instructions.filter(
        (inst) => inst.recipe_id === mealieRecipe.id
      );

      // Extract image
      const imageBuffer = await extractMealieRecipeImage(zip, mealieRecipe.id);

      // Parse to DTO
      const dto = await parseMealieRecipeToDTO(
        mealieRecipe,
        ingredients,
        instructions,
        imageBuffer
      );

      // Check for duplicates
      const existingId = await findExistingRecipe(userIds, dto.url, dto.name);

      if (existingId) {
        skipped++;
        onProgress?.(i + 1, undefined, undefined);
        continue;
      }

      const id = crypto.randomUUID();
      const created = await createRecipeWithRefs(id, userId, dto);
      const recipe = await getRecipeFull(created as string);

      if (recipe) {
        imported.push(recipe as RecipeDashboardDTO);
        onProgress?.(i + 1, recipe as RecipeDashboardDTO);
      }
    } catch (e: any) {
      const error = { file: fileName, error: String(e?.message || e) };

      errors.push(error);
      onProgress?.(i + 1, undefined, error);
    }
  }

  return { imported, errors, skipped };
}

/**
 * Import Tandoor archive
 */
async function importTandoorRecipes(
  zip: JSZip,
  userId: string | undefined,
  userIds: string[],
  onProgress?: (
    current: number,
    recipe?: RecipeDashboardDTO,
    error?: { file: string; error: string }
  ) => void
): Promise<ImportResult> {
  const tandoorRecipes = await extractTandoorRecipes(zip);
  const imported: RecipeDashboardDTO[] = [];
  const errors: Array<{ file: string; error: string }> = [];
  let skipped = 0;

  for (let i = 0; i < tandoorRecipes.length; i++) {
    const { recipe, image, fileName } = tandoorRecipes[i];

    try {
      const dto = await parseTandoorRecipeToDTO(recipe, image);

      // Check for duplicates
      const existingId = await findExistingRecipe(userIds, dto.url, dto.name);

      if (existingId) {
        skipped++;
        onProgress?.(i + 1, undefined, undefined);
        continue;
      }

      const id = crypto.randomUUID();
      const created = await createRecipeWithRefs(id, userId, dto);
      const fullRecipe = await getRecipeFull(created as string);

      if (fullRecipe) {
        imported.push(fullRecipe as RecipeDashboardDTO);
        onProgress?.(i + 1, fullRecipe as RecipeDashboardDTO);
      }
    } catch (e: any) {
      const error = { file: fileName, error: String(e?.message || e) };

      errors.push(error);
      onProgress?.(i + 1, undefined, error);
    }
  }

  return { imported, errors, skipped };
}

/**
 * Import archive (auto-detects Mela, Mealie, or Tandoor format)
 */
export async function importArchive(
  userId: string | undefined,
  userIds: string[],
  zipBytes: Buffer,
  onProgress?: (
    current: number,
    recipe?: RecipeDashboardDTO,
    error?: { file: string; error: string }
  ) => void
): Promise<ImportResult> {
  const arrayBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength
  ) as ArrayBuffer;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const format = await detectArchiveFormat(zip);

  if (format === ArchiveFormat.UNKNOWN) {
    throw new Error(
      "Unknown archive format. Expected .melarecipes, Mealie .zip, or Tandoor .zip export"
    );
  }

  if (format === ArchiveFormat.MELA) {
    return importMelaRecipes(zip, userId, userIds, onProgress);
  } else if (format === ArchiveFormat.MEALIE) {
    return importMealieRecipes(zip, userId, userIds, onProgress);
  } else {
    return importTandoorRecipes(zip, userId, userIds, onProgress);
  }
}
