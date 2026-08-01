import Link from "next/link";
import type { Project } from "@prisma/client";
import { FolderOpen, Clock3 } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type ProjectCardProps = {
  project: Project;
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <FolderOpen className="h-5 w-5 text-primary" />

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              {project.updatedAt.toLocaleDateString("fr-FR")}
            </div>
          </div>

          <div>
            <CardTitle className="truncate">
              {project.name}
            </CardTitle>

            <CardDescription className="mt-2 line-clamp-2">
              {project.description ??
                "Aucune description disponible."}
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}