"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ws_gateway_1 = require("../websocket/ws.gateway");
let GamesService = class GamesService {
    constructor(prisma, ws) {
        this.prisma = prisma;
        this.ws = ws;
    }
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
        for (const r of rounds)
            await this.prisma.round.create({ data: r });
        this.ws.emitTicker({ gameId: createdGame.id, active: true });
        return { gameId: createdGame.id };
    }
    async currentNews() {
        const round = await this.prisma.round.findFirst({ orderBy: { index: 'desc' }, include: { news: true } });
        return round?.news ?? [];
    }
    async executeTransaction(input) {
        const company = await this.prisma.company.findUnique({ where: { id: input.companyId } });
        if (!company)
            throw new Error('Company not found');
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
        const ranking = portfolios
            .map((p) => ({
            userId: p.userId,
            name: p.user.name,
            totalValue: p.totalValue + p.cashBalance,
        }))
            .sort((a, b) => b.totalValue - a.totalValue);
        this.ws.emitRanking(ranking);
        return ranking;
    }
};
exports.GamesService = GamesService;
exports.GamesService = GamesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ws_gateway_1.WsGateway])
], GamesService);
