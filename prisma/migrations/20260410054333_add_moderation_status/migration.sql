-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('APPROVED', 'PENDING_REVIEW', 'BLOCKED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateIndex
CREATE INDEX "Post_moderationStatus_idx" ON "Post"("moderationStatus");
