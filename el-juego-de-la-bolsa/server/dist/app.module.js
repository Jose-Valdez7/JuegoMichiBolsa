"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const prisma_module_1 = require("./prisma/prisma.module");
const websocket_module_1 = require("./websocket/websocket.module");
const games_module_1 = require("./games/games.module");
const events_module_1 = require("./events/events.module");
const certificates_module_1 = require("./certificates/certificates.module");
const companies_module_1 = require("./companies/companies.module");
const portfolio_module_1 = require("./portfolio/portfolio.module");
const transactions_module_1 = require("./transactions/transactions.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            websocket_module_1.WebsocketModule,
            games_module_1.GamesModule,
            events_module_1.EventsModule,
            certificates_module_1.CertificatesModule,
            companies_module_1.CompaniesModule,
            portfolio_module_1.PortfolioModule,
            transactions_module_1.TransactionsModule
        ],
    })
], AppModule);
