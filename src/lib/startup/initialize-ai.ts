import { IAIProvider } from "./IAIProvider";

import { OllamaInitializer } from "./initializer/ollama-initializer";

export async function initializeAI() {
  const initializers: IAIProvider[] = [
    // Add your AI provider initializers here
    new OllamaInitializer(),
  ];

  // Run all initializers in parallel and handle errors
  console.log(`Initializing ${initializers.length} AI providers ...`);

  await Promise.allSettled(
    initializers.map((initializer) =>
      initializer
        .initializeProviders()
        .then(() => initializer.synchronizeModels())
    )
  ).then((results) => {
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(
          `Initialized ${initializers[index].name} provider succesfully`
        );
      } else if (result.status === "rejected") {
        console.log(
          `Failed to initialized ${initializers[index].name} provider : ${result.reason}`
        );
      }
    });
  });

  console.log("AI providers initialized finished.");
}
