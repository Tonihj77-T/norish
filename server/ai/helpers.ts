import { MeasurementSystem } from "@/types/dto/recipe";

export function normalizeIngredient(i: any, system: MeasurementSystem) {
  return {
    ingredientId: null,
    ingredientName: String(i.ingredientName || "").trim(),
    order: i.order ?? 0,
    amount: i.amount == null ? null : Number(i.amount),
    unit: i.unit ? String(i.unit).trim() : null,
    systemUsed: system,
  };
}

export function normalizeStep(s: any, system: MeasurementSystem) {
  return {
    step: String(s.step || "").trim(),
    order: s.order ?? 0,
    systemUsed: system,
  };
}
