-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('general', 'technical', 'refund');

-- CreateEnum
CREATE TYPE "TicketMessageType" AS ENUM ('inbound', 'agent_reply', 'ai_draft');

-- CreateTable
CREATE TABLE "ticket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "category" "TicketCategory" NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_message" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" "TicketMessageType" NOT NULL DEFAULT 'inbound',
    "fromEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_status_idx" ON "ticket"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_message_messageId_key" ON "ticket_message"("messageId");

-- CreateIndex
CREATE INDEX "ticket_message_ticketId_idx" ON "ticket_message"("ticketId");

-- AddForeignKey
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
