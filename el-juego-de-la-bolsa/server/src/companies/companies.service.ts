import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.company.findMany({
      orderBy: { symbol: 'asc' }
    });
  }

  async updatePrice(companyId: number, newPrice: number) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { currentPrice: newPrice }
    });
  }
}
