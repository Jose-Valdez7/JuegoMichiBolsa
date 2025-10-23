import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WsGateway } from '../websocket/ws.gateway';

type TransactionInput = {
  userId: number;
  companyId: number;
  type: 'BUY' | 'SELL';
  quantity: number;
};

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService, private ws: WsGateway) {}

  async startGame() {
    const existingGame = await this.prisma.game.findFirst({ where: { active: true } });
    if (existingGame) {
      this.ws.emitTicker({ gameId: existingGame.id, active: true });
      return { gameId: existingGame.id };
    }

    const createdGame = await this.prisma.game.create({ data: { code: `G-${Date.now()}`, active: true } });
    const now = new Date();
    const rounds = Array.from({ length: 5 }).map((_, i) => ({
      index: i + 1,
      startsAt: new Date(now.getTime() + i * 60000),
      endsAt: new Date(now.getTime() + (i + 1) * 60000),
      gameId: createdGame.id,
    }));
    for (const r of rounds) await this.prisma.round.create({ data: r });

    this.ws.emitTicker({ gameId: createdGame.id, active: true });
    return { gameId: createdGame.id };
  }

  async currentNews() {
    const round = await this.prisma.round.findFirst({ orderBy: { index: 'desc' }, include: { news: true } });
    return round?.news ?? [];
  }

  async executeTransaction(input: TransactionInput) {
    const company = await this.prisma.company.findUnique({ where: { id: input.companyId } });
    if (!company) throw new Error('Company not found');
    const price = company.currentPrice;
    const tx = await this.prisma.transaction.create({
      data: {
        userId: input.userId,
        companyId: input.companyId,
        type: input.type,
        quantity: input.quantity,
        priceAtMoment: price,
      },
    });
    this.ws.server.emit('transaction', tx);
    return { ok: true, txId: tx.id };
  }

  async roundState() {
    const rounds = await this.prisma.round.findMany({ include: { event: true } });
    return rounds;
  }

  async results() {
    const latestResults = this.ws.getLatestResults();
    if (latestResults && latestResults.length > 0) {
      return latestResults;
    }

    const portfolios = await this.prisma.portfolio.findMany({ include: { user: true } });
    type RankingEntry = { userId: number; name: string; totalValue: number };
    const ranking: RankingEntry[] = portfolios
      .map((p: typeof portfolios[number]) => ({
        userId: p.userId,
        name: p.user.name,
        totalValue: p.totalValue + p.cashBalance,
      }))
      .sort((a: RankingEntry, b: RankingEntry) => b.totalValue - a.totalValue);
    this.ws.emitRanking(ranking);
    return ranking;
  }
}
