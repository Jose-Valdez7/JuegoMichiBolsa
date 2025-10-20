import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('game')
export class GamesController {
  constructor(private games: GamesService) {}

  @Get('start')
  async start() {
    return this.games.startGame();
  }

  @Get('news')
  async news() {
    return this.games.currentNews();
  }

  @Post('transaction')
  async transaction(@Body() body: { userId: number; companyId: number; type: TransactionType; quantity: number }) {
    return this.games.executeTransaction(body);
  }

  @Get('rounds')
  async rounds() {
    return this.games.roundState();
  }

  @Get('results')
  async results() {
    return this.games.results();
  }
}
