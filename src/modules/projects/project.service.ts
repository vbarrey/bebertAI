import { projectRepository } from "@/repositories/project.repository";

const DEFAULT_PROJECT_NAME = "Nouveau projet";
const MAX_PROJECT_NAME_LENGTH = 80;

function normaliseProjectName(value: string | null | undefined) {
  const compactName = value?.trim().replace(/\s+/g, " ") ?? "";
  return (compactName || DEFAULT_PROJECT_NAME).slice(0, MAX_PROJECT_NAME_LENGTH);
}

export const projectService = {
  create(input?: string | null) {
    return projectRepository.create(normaliseProjectName(input));
  },

  getById(id: string) {
    return projectRepository.findById(id);
  },

  listRecent() {
    return projectRepository.listRecent();
  },

  rename(id: string, input: string | null) {
    return projectRepository.rename(id, normaliseProjectName(input));
  },
};
