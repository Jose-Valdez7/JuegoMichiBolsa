import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { GameEngineService } from '../games/game-engine.service';

@Module({
  providers: [WsGateway, GameEngineService],
  exports: [WsGateway],
})
export class WebsocketModule {}
