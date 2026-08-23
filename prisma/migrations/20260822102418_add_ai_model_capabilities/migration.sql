-- CreateTable
CREATE TABLE "AIModelCapability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_AIModelToAIModelCapability" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AIModelToAIModelCapability_A_fkey" FOREIGN KEY ("A") REFERENCES "AIModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_AIModelToAIModelCapability_B_fkey" FOREIGN KEY ("B") REFERENCES "AIModelCapability" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AIModelCapability_name_key" ON "AIModelCapability"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_AIModelToAIModelCapability_AB_unique" ON "_AIModelToAIModelCapability"("A", "B");

-- CreateIndex
CREATE INDEX "_AIModelToAIModelCapability_B_index" ON "_AIModelToAIModelCapability"("B");
