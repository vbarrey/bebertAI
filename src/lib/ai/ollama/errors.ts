import { ProviderError } from "../errors";

export class OllamaError extends ProviderError {
  constructor(message: string, options?: ErrorOptions) {
    super(`[OLLAMA] ${message}`, options);
    this.name = "OllamaError";
  }
}

export class OllamaConnectionError extends OllamaError {
  constructor(options?: ErrorOptions) {
    super(`[CONNECTION ERROR] : Failed to connect to Ollama API`, options);
    this.name = "OllamaConnectionError";
  }
}

export class OllamaRequestError extends OllamaError {
  constructor(
    readonly status: number,
    readonly statusText: string,
    options?: ErrorOptions
  ) {
    super(`[REQUEST ERROR] (STATUS ${status}) : ${statusText}`, options);
    this.name = "OllamaRequestError";
  }
}

export class OllamaEmptyBodyResponseError extends OllamaError {
  constructor(options?: ErrorOptions) {
    super(`[BODY RESPONSE ERROR] : The response gives an empty body`, options);
    this.name = "OllamaEmptyBodyResponseError";
  }
}
