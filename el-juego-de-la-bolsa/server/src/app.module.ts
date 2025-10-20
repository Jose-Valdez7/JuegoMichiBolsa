import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { WebsocketModule } from './websocket/websocket.module';
import { GamesModule } from './games/games.module';
import { EventsModule } from './events/events.module';
import { CertificatesModule } from './certificates/certificates.module';
import { CompaniesModule } from './companies/companies.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule, 
    UsersModule, 
    WebsocketModule, 
    GamesModule, 
    EventsModule, 
    CertificatesModule,
    CompaniesModule,
    PortfolioModule,
    TransactionsModule
  ],
})
export class AppModule {}
