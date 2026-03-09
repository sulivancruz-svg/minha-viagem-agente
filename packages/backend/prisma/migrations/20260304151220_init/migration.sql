-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "role" TEXT NOT NULL DEFAULT 'AGENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "encryptedEmail" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "optInStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "optInSource" TEXT,
    "optInTimestamp" DATETIME,
    "optInIp" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "dateRange" TEXT NOT NULL,
    "offerText" TEXT NOT NULL,
    "inclusions" TEXT NOT NULL DEFAULT '[]',
    "priceFrom" REAL,
    "ctaText" TEXT NOT NULL,
    "landingUrl" TEXT,
    "mediaAssets" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repliedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadStage" (
    "contactId" TEXT NOT NULL PRIMARY KEY,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeadStage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" DATETIME,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiToken_key" ON "User"("apiToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsappNumber_key" ON "User"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_phoneE164_key" ON "Contact"("phoneE164");

-- CreateIndex
CREATE INDEX "CampaignSend_contactId_idx" ON "CampaignSend"("contactId");

-- CreateIndex
CREATE INDEX "CampaignSend_sentAt_idx" ON "CampaignSend"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSend_campaignId_contactId_key" ON "CampaignSend"("campaignId", "contactId");

-- CreateIndex
CREATE INDEX "ConversationEvent_contactId_idx" ON "ConversationEvent"("contactId");

-- CreateIndex
CREATE INDEX "ConversationEvent_createdAt_idx" ON "ConversationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Task_contactId_idx" ON "Task"("contactId");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");
