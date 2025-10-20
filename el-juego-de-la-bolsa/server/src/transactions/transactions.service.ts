import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async getByUserId(userId: number) {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: {
        company: {
          select: {
            symbol: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limitar a las últimas 50 transacciones
    });
  }

  async create(data: {
    userId: number;
    companyId: number;
    type: 'BUY' | 'SELL';
    quantity: number;
    priceAtMoment: number;
    roundId?: number;
  }) {
    return this.prisma.transaction.create({
      data,
      include: {
        company: {
          select: {
            symbol: true,
            name: true
          }
        }
      }
    });
  }
}
