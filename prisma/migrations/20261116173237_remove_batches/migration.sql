/*
  Warnings:

  - The values [BATCH] on the enum `AssignmentTargetType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `batchId` on the `Assignment` table. All the data in the column will be lost.
  - You are about to drop the column `batchId` on the `StudentProfile` table. All the data in the column will be lost.
  - You are about to drop the `Batch` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AssignmentTargetType_new" AS ENUM ('STUDENT');
ALTER TABLE "Assignment" ALTER COLUMN "targetType" TYPE "AssignmentTargetType_new" USING ("targetType"::text::"AssignmentTargetType_new");
ALTER TYPE "AssignmentTargetType" RENAME TO "AssignmentTargetType_old";
ALTER TYPE "AssignmentTargetType_new" RENAME TO "AssignmentTargetType";
DROP TYPE "public"."AssignmentTargetType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_batchId_fkey";

-- DropForeignKey
ALTER TABLE "StudentProfile" DROP CONSTRAINT "StudentProfile_batchId_fkey";

-- DropIndex
DROP INDEX "Assignment_batchId_idx";

-- DropIndex
DROP INDEX "StudentProfile_batchId_idx";

-- AlterTable
ALTER TABLE "Assignment" DROP COLUMN "batchId";

-- AlterTable
ALTER TABLE "StudentProfile" DROP COLUMN "batchId";

-- DropTable
DROP TABLE "Batch";

-- DropEnum
DROP TYPE "BatchStatus";
