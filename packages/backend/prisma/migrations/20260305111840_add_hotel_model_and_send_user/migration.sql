-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "stars" INTEGER,
    "description" TEXT,
    "highlights" TEXT NOT NULL DEFAULT '[]',
    "priceFrom" REAL,
    "images" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hotel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "dateRange" TEXT NOT NULL,
    "offerText" TEXT NOT NULL,
    "inclusions" TEXT NOT NULL DEFAULT '[]',
    "hotels" TEXT NOT NULL DEFAULT '[]',
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
INSERT INTO "new_Campaign" ("createdAt", "createdById", "ctaText", "dateRange", "destination", "id", "inclusions", "isActive", "landingUrl", "mediaAssets", "name", "offerText", "priceFrom", "updatedAt") SELECT "createdAt", "createdById", "ctaText", "dateRange", "destination", "id", "inclusions", "isActive", "landingUrl", "mediaAssets", "name", "offerText", "priceFrom", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE TABLE "new_CampaignSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT,
    "hotelId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repliedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CampaignSend" ("campaignId", "contactId", "createdAt", "id", "notes", "repliedAt", "sentAt", "status", "updatedAt") SELECT "campaignId", "contactId", "createdAt", "id", "notes", "repliedAt", "sentAt", "status", "updatedAt" FROM "CampaignSend";
DROP TABLE "CampaignSend";
ALTER TABLE "new_CampaignSend" RENAME TO "CampaignSend";
CREATE INDEX "CampaignSend_contactId_idx" ON "CampaignSend"("contactId");
CREATE INDEX "CampaignSend_sentAt_idx" ON "CampaignSend"("sentAt");
CREATE INDEX "CampaignSend_userId_idx" ON "CampaignSend"("userId");
CREATE UNIQUE INDEX "CampaignSend_campaignId_contactId_key" ON "CampaignSend"("campaignId", "contactId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
