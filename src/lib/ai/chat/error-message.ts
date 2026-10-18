const CONNECTION_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT"]);

// Default ports of the services the chat depends on.
const SERVICES: Record<number, string> = {
  6333: "La base vectorielle Qdrant",
  6334: "La base vectorielle Qdrant",
  11434: "Ollama",
  6379: "Redis",
};

const GENERIC = "La génération de la réponse a échoué.";

type ConnectionFailure = { code?: string; address?: string; port?: number; errors?: ConnectionFailure[] };

/** The connection failure in the cause chain of a fetch error (fetch failed ← ECONNREFUSED), if any. */
function connectionFailure(error: unknown): ConnectionFailure | null {
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth++) {
    const failure = current as ConnectionFailure & { cause?: unknown };
    // Node tries IPv6 then IPv4: an AggregateError whose attempts carry the address and port.
    if (failure.code && CONNECTION_CODES.has(failure.code)) return failure.port ? failure : failure.errors?.[0] ?? failure;
    current = failure.cause;
  }

  return null;
}

/**
 * What to tell the user about a failed answer: the unreachable service, else the error message without its
 * internal tags ("[PROVIDER ERROR] [OLLAMA] …"), the provider and pipeline errors being written for the user.
 */
export function userErrorMessage(error: unknown): string {
  const failure = connectionFailure(error);

  if (failure) {
    const service = failure.port ? SERVICES[failure.port] : undefined;

    return service
      ? `${service} n'est pas joignable : vérifiez que le service est démarré.`
      : `Un service n'est pas joignable${failure.address ? ` (${failure.address}${failure.port ? `:${failure.port}` : ""})` : ""} : vérifiez qu'il est démarré.`;
  }

  if (!(error instanceof Error)) return GENERIC;

  const message = error.message.replace(/^(\[[^\]]*\]\s*:?\s*)+/, "").trim();
  return message || GENERIC;
}
