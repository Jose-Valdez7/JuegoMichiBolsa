import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/portfolio')
export class PortfolioController {
  constructor(private portfolio: PortfolioService) {}

  @Get()
  async getPortfolio(@Request() req: any) {
    return this.portfolio.getByUserId(req.user.userId);
  }
}
