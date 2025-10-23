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
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ws_gateway_1 = require("../websocket/ws.gateway");
function rand(min, max) {
    return Math.random() * (max - min) + min;
}
let EventsService = class EventsService {
    constructor(prisma, ws) {
        this.prisma = prisma;
        this.ws = ws;
    }
    async triggerRandomEvent() {
        const types = ['BOOM', 'CRASH', 'SPLIT', 'REVERSE_SPLIT'];
        const type = types[Math.floor(Math.random() * types.length)];
        const companies = await this.prisma.company.findMany();
        let multiplier = 1;
        if (type === 'BOOM')
            multiplier = 1 + rand(0.1, 0.25);
        if (type === 'CRASH')
            multiplier = 1 - rand(0.1, 0.25);
        for (const c of companies) {
            let newPrice = c.currentPrice;
            if (type === 'BOOM' || type === 'CRASH')
                newPrice = +(c.currentPrice * multiplier).toFixed(2);
            if (type === 'SPLIT')
                newPrice = +(c.currentPrice / 2).toFixed(2);
            if (type === 'REVERSE_SPLIT')
                newPrice = +(c.currentPrice * 2).toFixed(2);
            await this.prisma.company.update({ where: { id: c.id }, data: { currentPrice: newPrice } });
        }
        const round = await this.prisma.round.findFirst({ orderBy: { index: 'desc' } });
        if (!round)
            return { type, applied: true };
        const ev = await this.prisma.event.create({ data: { type: type, payload: {}, roundId: round.id } });
        this.ws.emitEvent({ type, eventId: ev.id });
        return { type, eventId: ev.id };
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, ws_gateway_1.WsGateway])
], EventsService);
