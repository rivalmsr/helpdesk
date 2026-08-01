-- AlterTable
ALTER TABLE "ticket" ALTER COLUMN "subject" SET DATA TYPE VARCHAR(200);

-- AlterTable
ALTER TABLE "ticket_message" ALTER COLUMN "body" SET DATA TYPE VARCHAR(50000);

