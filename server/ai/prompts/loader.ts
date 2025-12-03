import { readFileSync } from "fs";
import { join } from "path";

const PROMPTS_DIR = join(process.cwd(), "server", "ai", "prompts");

export function loadPrompt(name: string): string {
  const filePath = join(PROMPTS_DIR, `${name}.txt`);

  return readFileSync(filePath, "utf-8");
}

export function fillPrompt(template: string, vars: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}
