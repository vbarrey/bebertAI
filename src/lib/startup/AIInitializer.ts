export interface AIInitializer {
    name: string;

    /**
     * Init provider in DB.
     */
    initializeProvider() : Promise<void>;

    /**
     * Fetch provider API to init availables models
     */
    synchronizeModels() : Promise<void>;
}