import { AIInitializer } from "./AIInitializer";

import { OllamaInitializer } from "./initializer/ollama/ollama-initializer";

export async function initializeAI() {
  const initializers: AIInitializer[] = [
    // Add your AI provider initializers here
    new OllamaInitializer(),
  ];

  // Run all initializers in parallel and handle errors
  console.log(`Initializing ${initializers.length} AI providers ...`);

  await Promise.allSettled(
    initializers.map((initializer) =>
      initializer
        .initializeProvider()
        .then(() => initializer.synchronizeModels())
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
