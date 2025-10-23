import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('game')
export class GamesController {
  constructor(private games: GamesService) {}

  @UseGuards(JwtAuthGuard)
  @Get('start')
  async start() {
    return this.games.startGame();
  }

  @UseGuards(JwtAuthGuard)
  @Get('news')
  async news() {
    return this.games.currentNews();
  }

  @UseGuards(JwtAuthGuard)
  @Post('transaction')
  async transaction(
    @Body()
    body: {
      userId: number;
      companyId: number;
      type: TransactionType;
      quantity: number;
    },
  ) {
    return this.games.executeTransaction(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rounds')
  async rounds() {
    return this.games.roundState();
  }

  @Get('results')
  async results() {
    return this.games.results();
  }
}
