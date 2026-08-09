export interface IAIProvider {
    name: string;

    initializeProviders() : Promise<void>;
    synchronizeModels() : Promise<void>;
}