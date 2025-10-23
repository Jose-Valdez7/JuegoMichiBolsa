"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PortfolioService = class PortfolioService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getByUserId(userId) {
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
    async updateCashBalance(userId, amount) {
        return this.prisma.portfolio.update({
            where: { userId },
            data: {
                cashBalance: {
                    increment: amount
                }
            }
        });
    }
    async updatePosition(userId, companyId, quantityChange) {
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
            }
            else {
                await this.prisma.position.update({
                    where: { id: existingPosition.id },
                    data: { quantity: newQuantity }
                });
            }
        }
        else if (quantityChange > 0) {
            await this.prisma.position.create({
                data: {
                    portfolioId: portfolio.id,
                    companyId,
                    quantity: quantityChange
                }
            });
        }
    }
};
exports.PortfolioService = PortfolioService;
exports.PortfolioService = PortfolioService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PortfolioService);
