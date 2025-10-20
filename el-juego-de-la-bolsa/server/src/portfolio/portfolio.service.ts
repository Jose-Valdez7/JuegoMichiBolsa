import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async getByUserId(userId: number) {
    let portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: {
        positions: {
          include: {
            company: true
          }
        }
      }
    });

    if (!portfolio) {
      portfolio = await this.prisma.portfolio.create({
        data: { userId },
        include: {
          positions: {
            include: {
              company: true
            }
          }
        }
      });
    }

    return portfolio;
  }

  async updateCashBalance(userId: number, amount: number) {
    return this.prisma.portfolio.update({
      where: { userId },
      data: {
        cashBalance: {
          increment: amount
        }
      }
    });
  }

  async updatePosition(userId: number, companyId: number, quantityChange: number) {
    const portfolio = await this.getByUserId(userId);
    
    const existingPosition = await this.prisma.position.findUnique({
      where: {
        portfolioId_companyId: {
          portfolioId: portfolio.id,
          companyId
        }
      }
    });

    if (existingPosition) {
      const newQuantity = existingPosition.quantity + quantityChange;
      
      if (newQuantity <= 0) {
        await this.prisma.position.delete({
          where: { id: existingPosition.id }
        });
      } else {
        await this.prisma.position.update({
          where: { id: existingPosition.id },
          data: { quantity: newQuantity }
        });
      }
    } else if (quantityChange > 0) {
      await this.prisma.position.create({
        data: {
          portfolioId: portfolio.id,
          companyId,
          quantity: quantityChange
        }
      });
    }
  }
}
