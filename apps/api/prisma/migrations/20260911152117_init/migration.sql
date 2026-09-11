-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "calendarDisplay" TEXT NOT NULL DEFAULT 'both',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CalendarAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "scopeJson" TEXT NOT NULL DEFAULT '[]',
    "targetCalendarId" TEXT,
    "lastSyncedAt" DATETIME,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startAt" TEXT NOT NULL,
    "endAt" TEXT NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "timeZone" TEXT NOT NULL,
    "color" TEXT,
    "attendeesJson" TEXT,
    "remindersJson" TEXT,
    "recurrenceJson" TEXT,
    "recurrenceParentId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "providerEventId" TEXT,
    "providerCalendarId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentEventId" TEXT NOT NULL,
    "occurrenceDate" DATETIME NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventInstance_parentEventId_fkey" FOREIGN KEY ("parentEventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventInstance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CalendarAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerContactId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CalendarAccount_userId_idx" ON "CalendarAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarAccount_userId_provider_providerAccountId_key" ON "CalendarAccount"("userId", "provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "Event_ownerId_idx" ON "Event"("ownerId");

-- CreateIndex
CREATE INDEX "EventInstance_accountId_idx" ON "EventInstance"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "EventInstance_parentEventId_occurrenceDate_provider_key" ON "EventInstance"("parentEventId", "occurrenceDate", "provider");

-- CreateIndex
CREATE INDEX "Contact_ownerId_idx" ON "Contact"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ownerId_provider_providerContactId_key" ON "Contact"("ownerId", "provider", "providerContactId");
