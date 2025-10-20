import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WsGateway } from '../websocket/ws.gateway';

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService, private ws: WsGateway) {}

  async triggerRandomEvent() {
    const types = ['BOOM', 'CRASH', 'SPLIT', 'REVERSE_SPLIT'] as const;
    const type = types[Math.floor(Math.random() * types.length)];

    const companies = await this.prisma.company.findMany();
    let multiplier = 1;
    if (type === 'BOOM') multiplier = 1 + rand(0.1, 0.25);
    if (type === 'CRASH') multiplier = 1 - rand(0.1, 0.25);

    for (const c of companies) {
      let newPrice = c.currentPrice;
      if (type === 'BOOM' || type === 'CRASH') newPrice = +(c.currentPrice * multiplier).toFixed(2);
      if (type === 'SPLIT') newPrice = +(c.currentPrice / 2).toFixed(2);
      if (type === 'REVERSE_SPLIT') newPrice = +(c.currentPrice * 2).toFixed(2);
      await this.prisma.company.update({ where: { id: c.id }, data: { currentPrice: newPrice } });
    }

    const round = await this.prisma.round.findFirst({ orderBy: { index: 'desc' } });
    if (!round) return { type, applied: true };

    const ev = await this.prisma.event.create({ data: { type: type as any, payload: {}, roundId: round.id } });
    this.ws.emitEvent({ type, eventId: ev.id });
    return { type, eventId: ev.id };
  }
}
