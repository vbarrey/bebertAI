export interface AIInitializer {
    name: string;

    /**
     * Init provider DB and runtime (registry).
     */
    initializeProvider() : Promise<void>;

    /**
     * Fetch provider API to init availables models
     */
    synchronizeModels() : Promise<void>;
}