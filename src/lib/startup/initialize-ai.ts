import { AIInitializer } from "./AIInitializer";

import { OllamaLocalInitializer } from "./initializer/ollama-local/ollama-local-initializer";
import { RemoteProvidersInitializer } from "./initializer/remote-providers-initializer";

// The indexing worker only needs the registry: the models are synchronized by the app.
export async function initializeAI({ synchronizeModels = true } = {}) {
  const initializers: AIInitializer[] = [
    // Add your AI provider initializers here
    new OllamaLocalInitializer(),
    new RemoteProvidersInitializer(),
  ];

  // Run all initializers in parallel and handle errors
  console.log(`Initializing ${initializers.length} AI providers ...`);

  await Promise.allSettled(
    initializers.map((initializer) =>
      initializer
        .initializeProvider()
        .then(() => (synchronizeModels ? initializer.synchronizeModels() : undefined))
    )
  ).then((results) => {
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(
          `Initialized ${initializers[index].name} succesfully`
        );
      } else if (result.status === "rejected") {
        console.log(
          `Failed to initialized ${initializers[index].name} : ${result.reason}`
        );
      }
    });
  });

  console.log("AI providers initialized finished.");
}
