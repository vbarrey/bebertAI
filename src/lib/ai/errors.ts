export class ProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(`[PROVIDER ERROR] ${message}`, options);
    this.name = "ProviderError";
    }
}
