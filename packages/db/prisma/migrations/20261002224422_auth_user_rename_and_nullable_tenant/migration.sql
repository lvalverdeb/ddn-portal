-- AlterTable
ALTER TABLE "portal_users" ADD COLUMN     "email_verified" TIMESTAMP(3),
ADD COLUMN     "image" TEXT,
ALTER COLUMN "tenant_id" DROP NOT NULL;
