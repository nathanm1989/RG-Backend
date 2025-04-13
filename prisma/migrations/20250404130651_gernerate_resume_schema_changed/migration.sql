/*
  Warnings:

  - You are about to drop the column `path` on the `GeneratedResume` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `GeneratedResume` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `GeneratedResume` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GeneratedResume" DROP COLUMN "path",
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedResume_name_key" ON "GeneratedResume"("name");
