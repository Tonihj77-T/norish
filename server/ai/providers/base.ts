export interface AIProvider {
  name: string;

  generateStructuredOutput<T>(
    prompt: string,
    schema: any,
    systemMessage?: string
  ): Promise<T | null>;
}
