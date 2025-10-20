import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private events: EventsService) {}

  @Get('random')
  async random() {
    return this.events.triggerRandomEvent();
  }
}
