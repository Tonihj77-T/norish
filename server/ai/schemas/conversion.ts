/**
 * Schema for unit conversion between metric and US measurement systems.
 */
export const conversionSchema = {
  name: "recipe_conversion",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ingredients: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            ingredientName: { type: "string" },
            amount: { anyOf: [{ type: "number" }, { type: "null" }] },
            unit: { anyOf: [{ type: "string" }, { type: "null" }] },
            systemUsed: { enum: ["metric", "us"] },
            order: { type: "number" },
          },
          required: ["ingredientName", "amount", "unit", "systemUsed", "order"],
        },
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            step: { type: "string" },
            systemUsed: { enum: ["metric", "us"] },
            order: { type: "number" },
          },
          required: ["step", "systemUsed", "order"],
        },
      },
    },
    required: ["ingredients", "steps"],
  },
  strict: true,
} as const;
