-- Create Enums
CREATE TYPE "Role" AS ENUM ('PLAYER', 'ADMIN');
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL');
CREATE TYPE "NewsType" AS ENUM ('POSITIVE', 'NEGATIVE', 'SURPRISE');
CREATE TYPE "EventType" AS ENUM ('BOOM', 'CRASH', 'SPLIT', 'REVERSE_SPLIT');

-- Create Tables
CREATE TABLE "User" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Company" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "actionsTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Company_symbol_key" ON "Company"("symbol");

CREATE TABLE "News" (
    "id" SERIAL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" "NewsType" NOT NULL,
    "effect" TEXT NOT NULL,
    "roundId" INTEGER
);

CREATE TABLE "Transaction" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceAtMoment" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roundId" INTEGER
);

CREATE TABLE "Portfolio" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "cashBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "Portfolio_userId_key" ON "Portfolio"("userId");

CREATE TABLE "Position" (
    "id" SERIAL PRIMARY KEY,
    "portfolioId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "Position_portfolioId_companyId_key" ON "Position"("portfolioId", "companyId");

CREATE TABLE "Game" (
    "id" SERIAL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rounds" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX "Game_code_key" ON "Game"("code");

CREATE TABLE "Round" (
    "id" SERIAL PRIMARY KEY,
    "gameId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "Round_gameId_index_key" ON "Round"("gameId", "index");

CREATE TABLE "RoundPrice" (
    "id" SERIAL PRIMARY KEY,
    "roundId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL
);

CREATE UNIQUE INDEX "RoundPrice_roundId_companyId_key" ON "RoundPrice"("roundId", "companyId");

CREATE TABLE "Event" (
    "id" SERIAL PRIMARY KEY,
    "type" "EventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "roundId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Event_roundId_key" ON "Event"("roundId");

CREATE TABLE "_NewsCompanies" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "_NewsCompanies_AB_unique" ON "_NewsCompanies"("A", "B");
CREATE INDEX "_NewsCompanies_B_index" ON "_NewsCompanies"("B");

-- Foreign Keys
ALTER TABLE "News"
    ADD CONSTRAINT "News_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "Round"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "Round"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Portfolio"
    ADD CONSTRAINT "Portfolio_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Position"
    ADD CONSTRAINT "Position_portfolioId_fkey"
    FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Position"
    ADD CONSTRAINT "Position_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Round"
    ADD CONSTRAINT "Round_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "Game"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoundPrice"
    ADD CONSTRAINT "RoundPrice_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "Round"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoundPrice"
    ADD CONSTRAINT "RoundPrice_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Event"
    ADD CONSTRAINT "Event_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "Round"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "_NewsCompanies"
    ADD CONSTRAINT "_NewsCompanies_A_fkey"
    FOREIGN KEY ("A") REFERENCES "News"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_NewsCompanies"
    ADD CONSTRAINT "_NewsCompanies_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
