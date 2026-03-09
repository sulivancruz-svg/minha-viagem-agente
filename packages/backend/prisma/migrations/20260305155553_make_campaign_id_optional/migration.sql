-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT,
    "contactId" TEXT NOT NULL,
    "userId" TEXT,
    "hotelId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repliedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CampaignSend" ("campaignId", "contactId", "createdAt", "hotelId", "id", "notes", "repliedAt", "sentAt", "status", "updatedAt", "userId") SELECT "campaignId", "contactId", "createdAt", "hotelId", "id", "notes", "repliedAt", "sentAt", "status", "updatedAt", "userId" FROM "CampaignSend";
DROP TABLE "CampaignSend";
ALTER TABLE "new_CampaignSend" RENAME TO "CampaignSend";
CREATE INDEX "CampaignSend_contactId_idx" ON "CampaignSend"("contactId");
CREATE INDEX "CampaignSend_sentAt_idx" ON "CampaignSend"("sentAt");
CREATE INDEX "CampaignSend_userId_idx" ON "CampaignSend"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
