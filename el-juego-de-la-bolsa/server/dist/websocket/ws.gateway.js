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
exports.WsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
let WsGateway = class WsGateway {
    constructor() {
        this.gameRooms = new Map();
        this.roomCodes = new Map();
        this.playerSockets = new Map();
        this.playerReconnections = new Map();
        this.playerPortfolios = new Map();
        this.playerFixedIncome = new Map();
        this.companyStocks = new Map();
        this.latestGameResults = null;
        this.roomFixedIncomeOffers = new Map();
        this.debugEnabled = process.env.DEBUG_WS === 'true';
        this.stocksUpdateTimers = new Map();
        this.fixedIncomeOffersUpdateTimers = new Map();
        this.currentPrices = new Map();
        this.fixedIncomeTemplates = [
            {
                id: 'ZAIMELLA',
                issuer: 'ZAIMELLA',
                name: 'ZAIMELLA OBLIGACIONES',
                unitPrice: 50,
                interestRate: 0.075,
                termMonths: 3,
            },
            {
                id: 'PRONACA',
                issuer: 'PRONACA',
                name: 'PRONACA OBLIGACIONES',
                unitPrice: 55,
                interestRate: 0.068,
                termMonths: 4,
            },
            {
                id: 'BANQ',
                issuer: 'BANQ',
                name: 'BANQ BONOS CORPORATIVOS',
                unitPrice: 45,
                interestRate: 0.06,
                termMonths: 2,
            },
            {
                id: 'ALIMENTAR',
                issuer: 'ALIMENTAR',
                name: 'ALIMENTAR CERT. DE DEPÓSITO',
                unitPrice: 40,
                interestRate: 0.052,
                termMonths: 1,
            },
            {
                id: 'INFRA',
                issuer: 'INFRA',
                name: 'INFRA BONOS PROYECTO',
                unitPrice: 60,
                interestRate: 0.082,
                termMonths: 5,
            },
        ];
    }
    dlog(...args) { if (this.debugEnabled)
        console.log(...args); }
    mapPlayerForClient(player) {
        return {
            id: player.id,
            name: player.name,
            isReady: player.isReady,
            characterId: player.characterId,
        };
    }
    mapPlayersForClient(players) {
        return players.map(player => this.mapPlayerForClient(player));
    }
    buildFixedIncomeOffers() {
        return this.fixedIncomeTemplates.map((template) => ({
            ...template,
            remainingUnits: 200,
        }));
    }
    handlePurchaseFixedIncome(client, payload) {
        const { offerId, quantity } = payload || {};
        const roomId = this.playerSockets.get(client.id);
        if (!roomId) {
            client.emit('fixedIncomePurchaseResult', {
                success: false,
                error: 'No estás en una sala de juego',
            });
            return;
        }
        const room = this.gameRooms.get(roomId);
        if (!room || room.currentRound !== 1) {
            client.emit('fixedIncomePurchaseResult', {
                success: false,
                error: 'Las emisiones de renta fija solo están disponibles en la jugada 1',
            });
            return;
        }
        if (!offerId || !quantity || quantity <= 0) {
            client.emit('fixedIncomePurchaseResult', {
                success: false,
                error: 'Solicitud inválida',
            });
            return;
        }
        const offers = this.roomFixedIncomeOffers.get(roomId) ?? [];
        const offer = offers.find((o) => o.id === offerId);
        if (!offer) {
            client.emit('fixedIncomePurchaseResult', {
                success: false,
                error: 'Emisión no encontrada',
            });
            return;
        }
        if (offer.remainingUnits < quantity) {
            client.emit('fixedIncomePurchaseResult', {
                success: false,
                error: 'No hay suficientes títulos disponibles',
            });
            return;
        }
        const roomPortfolios = this.playerPortfolios.get(roomId);
        if (!roomPortfolios) {
            client.emit('fixedIncomePurchaseResult', {
                success: false,
                error: 'Portafolio no encontrado',
            });
            return;
        }
        const playerPortfolio = roomPortfolios.get(client.id);
        if (!playerPortfolio) {
            client.emit('fixedIncomePurchaseResult', {
                success: false,
                error: 'Portafolio no inicializado',
            });
            return;
        }
        const totalCost = offer.unitPrice * quantity;
        if (playerPortfolio.cash < totalCost) {
            client.emit('fixedIncomePurchaseResult', {
                success: false,
                error: 'Fondos insuficientes',
            });
            return;
        }
        playerPortfolio.cash -= totalCost;
        offer.remainingUnits -= quantity;
        const roomHoldings = this.playerFixedIncome.get(roomId);
        const currentHoldings = roomHoldings.get(client.id) ?? [];
        const existingHolding = currentHoldings.find((h) => h.offerId === offer.id && h.remainingMonths === offer.termMonths);
        if (existingHolding) {
            existingHolding.quantity += quantity;
        }
        else {
            currentHoldings.push({
                offerId: offer.id,
                issuer: offer.issuer,
                name: offer.name,
                unitPrice: offer.unitPrice,
                interestRate: offer.interestRate,
                remainingMonths: offer.termMonths,
                quantity,
            });
        }
        roomHoldings.set(client.id, currentHoldings);
        client.emit('fixedIncomePurchaseResult', {
            success: true,
            offer: {
                id: offer.id,
                issuer: offer.issuer,
                name: offer.name,
                unitPrice: offer.unitPrice,
                interestRate: offer.interestRate,
                termMonths: offer.termMonths,
            },
            quantity,
            totalCost,
        });
        const updatedPortfolio = this.getPlayerPortfolio(roomId, client.id);
        if (updatedPortfolio) {
            this.server.to(client.id).emit('portfolioUpdate', updatedPortfolio);
        }
        this.roomFixedIncomeOffers.set(roomId, offers);
        this.scheduleFixedIncomeOffersUpdate(roomId);
    }
    getPlayerFixedIncome(roomId, socketId) {
        const roomHoldings = this.playerFixedIncome.get(roomId);
        if (!roomHoldings) {
            return [];
        }
        return roomHoldings.get(socketId) ?? [];
    }
    processFixedIncomeHoldings(room) {
        const roomHoldings = this.playerFixedIncome.get(room.id);
        if (!roomHoldings)
            return;
        for (const [socketId, holdings] of roomHoldings.entries()) {
            const playerPortfolio = this.playerPortfolios.get(room.id)?.get(socketId);
            if (!playerPortfolio)
                continue;
            const remainingHoldings = [];
            for (const holding of holdings) {
                const updatedHolding = { ...holding, remainingMonths: holding.remainingMonths - 1 };
                if (updatedHolding.remainingMonths <= 0) {
                    const principal = holding.unitPrice * holding.quantity;
                    const interest = principal * holding.interestRate;
                    playerPortfolio.cash += principal + interest;
                    this.server.to(socketId).emit('fixedIncomePayout', {
                        offerId: holding.offerId,
                        issuer: holding.issuer,
                        name: holding.name,
                        principal,
                        interest,
                    });
                }
                else {
                    remainingHoldings.push(updatedHolding);
                }
            }
            roomHoldings.set(socketId, remainingHoldings);
        }
    }
    handleGameTransaction(client, payload) {
        const roomId = this.playerSockets.get(client.id);
        if (!roomId) {
            client.emit('transactionProcessed', { success: false, error: 'No estás en una sala' });
            return;
        }
        const room = this.gameRooms.get(roomId);
        if (!room || room.status !== 'playing') {
            client.emit('transactionProcessed', { success: false, error: 'La partida no está activa' });
            return;
        }
        const { companyId, type, quantity } = payload || {};
        const q = Number(quantity);
        if (!companyId || (type !== 'BUY' && type !== 'SELL') || !q || q <= 0) {
            client.emit('transactionProcessed', { success: false, error: 'Solicitud inválida' });
            return;
        }
        const roomPortfolios = this.playerPortfolios.get(roomId);
        if (!roomPortfolios) {
            client.emit('transactionProcessed', { success: false, error: 'Portafolio no encontrado' });
            return;
        }
        const portfolio = roomPortfolios.get(client.id);
        if (!portfolio) {
            client.emit('transactionProcessed', { success: false, error: 'Portafolio no inicializado' });
            return;
        }
        const price = this.getStockPrice(companyId);
        const companyName = this.getCompanyName(companyId);
        const companySymbol = this.getCompanySymbol(companyId);
        const roomStocks = this.companyStocks.get(roomId) ?? new Map();
        if (!this.companyStocks.has(roomId)) {
            this.companyStocks.set(roomId, roomStocks);
        }
        if (!roomStocks.has(companyId)) {
            roomStocks.set(companyId, 999);
        }
        if (type === 'BUY') {
            const available = roomStocks.get(companyId) ?? 0;
            const totalCost = price * q;
            if (available < q) {
                client.emit('transactionProcessed', { success: false, error: 'No hay suficientes acciones disponibles' });
                return;
            }
            if (portfolio.cash < totalCost) {
                client.emit('transactionProcessed', { success: false, error: 'Fondos insuficientes' });
                return;
            }
            portfolio.cash -= totalCost;
            const currentQty = portfolio.stocks.get(companyId) ?? 0;
            portfolio.stocks.set(companyId, currentQty + q);
            roomStocks.set(companyId, available - q);
            client.emit('transactionProcessed', {
                success: true,
                type,
                companyId,
                companyName,
                companySymbol,
                quantity: q,
                priceAtMoment: price
            });
        }
        else {
            const holdingQty = portfolio.stocks.get(companyId) ?? 0;
            if (holdingQty < q) {
                client.emit('transactionProcessed', { success: false, error: 'No tienes suficientes acciones para vender' });
                return;
            }
            const proceeds = price * q;
            portfolio.cash += proceeds;
            const newQty = holdingQty - q;
            if (newQty > 0) {
                portfolio.stocks.set(companyId, newQty);
            }
            else {
                portfolio.stocks.delete(companyId);
            }
            const available = roomStocks.get(companyId) ?? 0;
            roomStocks.set(companyId, available + q);
            client.emit('transactionProcessed', {
                success: true,
                type,
                companyId,
                companyName,
                companySymbol,
                quantity: q,
                priceAtMoment: price
            });
        }
        const updatedPortfolio = this.getPlayerPortfolio(roomId, client.id);
        if (updatedPortfolio) {
            this.server.to(client.id).emit('portfolioUpdate', updatedPortfolio);
        }
        const stocksPayload = {};
        stocksPayload[companyId] = this.companyStocks.get(roomId)?.get(companyId) ?? 0;
        this.server.to(roomId).emit('stocksUpdate', stocksPayload);
    }
    handleBulkGameTransactions(client, payload) {
        const roomId = this.playerSockets.get(client.id);
        if (!roomId) {
            client.emit('bulkTransactionProcessed', { success: false, error: 'No estás en una sala', results: [], processed: 0, total: 0 });
            return;
        }
        const actions = payload?.actions ?? [];
        if (!Array.isArray(actions) || actions.length === 0) {
            client.emit('bulkTransactionProcessed', { success: false, error: 'No hay órdenes para procesar', results: [], processed: 0, total: 0 });
            return;
        }
        const results = [];
        const changed = {};
        for (const action of actions) {
            const { companyId, type, quantity } = action || {};
            const q = Number(quantity) || 0;
            if (!companyId || (type !== 'BUY' && type !== 'SELL') || q <= 0) {
                results.push({ success: false, type: type, companyId: companyId, quantity: q, error: 'Orden inválida' });
                continue;
            }
            const price = this.getStockPrice(companyId);
            const companyName = this.getCompanyName(companyId);
            const companySymbol = this.getCompanySymbol(companyId);
            const roomPortfolios = this.playerPortfolios.get(roomId);
            const portfolio = roomPortfolios?.get(client.id);
            const roomStocks = this.companyStocks.get(roomId) ?? new Map();
            if (roomPortfolios && portfolio) {
                if (!roomStocks.has(companyId))
                    roomStocks.set(companyId, 999);
                if (!this.companyStocks.has(roomId))
                    this.companyStocks.set(roomId, roomStocks);
                if (type === 'BUY') {
                    const available = roomStocks.get(companyId) ?? 0;
                    const cost = price * q;
                    if (available >= q && portfolio.cash >= cost) {
                        portfolio.cash -= cost;
                        portfolio.stocks.set(companyId, (portfolio.stocks.get(companyId) ?? 0) + q);
                        roomStocks.set(companyId, available - q);
                        changed[companyId] = roomStocks.get(companyId);
                        results.push({ success: true, type, companyId, quantity: q, companyName, companySymbol, priceAtMoment: price });
                    }
                    else {
                        results.push({ success: false, type, companyId, quantity: q, error: available < q ? 'Sin acciones suficientes' : 'Fondos insuficientes', companyName, companySymbol, priceAtMoment: price });
                    }
                }
                else {
                    const holdingQty = portfolio.stocks.get(companyId) ?? 0;
                    if (holdingQty >= q) {
                        portfolio.cash += price * q;
                        const newQty = holdingQty - q;
                        if (newQty > 0)
                            portfolio.stocks.set(companyId, newQty);
                        else
                            portfolio.stocks.delete(companyId);
                        roomStocks.set(companyId, (roomStocks.get(companyId) ?? 0) + q);
                        changed[companyId] = roomStocks.get(companyId);
                        results.push({ success: true, type, companyId, quantity: q, companyName, companySymbol, priceAtMoment: price });
                    }
                    else {
                        results.push({ success: false, type, companyId, quantity: q, error: 'No tienes suficientes acciones', companyName, companySymbol, priceAtMoment: price });
                    }
                }
            }
            else {
                results.push({ success: false, type, companyId, quantity: q, error: 'Portafolio no disponible', companyName, companySymbol, priceAtMoment: price });
            }
        }
        const updatedPortfolio = this.getPlayerPortfolio(roomId, client.id);
        if (updatedPortfolio) {
            this.server.to(client.id).emit('portfolioUpdate', updatedPortfolio);
        }
        if (Object.keys(changed).length > 0) {
            this.server.to(roomId).emit('stocksUpdate', changed);
        }
        const allOk = results.every(r => r.success);
        client.emit('bulkTransactionProcessed', {
            success: allOk,
            results,
            processed: results.length,
            total: actions.length,
            serverProcessingMs: undefined,
            clientTs: payload?.clientTs
        });
    }
    getFixedIncomeValue(roomId, socketId) {
        return this.getPlayerFixedIncome(roomId, socketId).reduce((total, bond) => total + bond.unitPrice * bond.quantity, 0);
    }
    onModuleInit() {
    }
    handleRequestRoundState(client) {
        const roomId = this.playerSockets.get(client.id);
        if (!roomId)
            return;
        const room = this.gameRooms.get(roomId);
        if (!room)
            return;
        const remainingTime = Math.max(0, room.roundTimer);
        const phase = remainingTime <= 60 ? 'trading' : 'news';
        const payload = {
            status: room.status,
            round: room.currentRound,
            timer: remainingTime,
            news: room.currentNews,
            phase,
            fixedIncomeOffers: room.currentRound === 1 ? (this.roomFixedIncomeOffers.get(roomId) ?? []) : [],
            totalElapsedSeconds: room.totalElapsedSeconds,
        };
        client.emit('roundState', payload);
    }
    handleCheckRoomStatus(client) {
        const roomId = this.playerSockets.get(client.id);
        if (!roomId) {
            client.emit('roomStatus', { inRoom: false });
            return;
        }
        const room = this.gameRooms.get(roomId);
        if (!room) {
            this.playerSockets.delete(client.id);
            client.emit('roomStatus', { inRoom: false });
            return;
        }
        client.emit('roomStatus', {
            inRoom: true,
            roomId,
            status: room.status,
            players: room.players.length,
            playersList: this.mapPlayersForClient(room.players),
        });
    }
    handleConnection(client) {
        const reconnectionInfo = this.playerReconnections.get(client.id);
        if (reconnectionInfo) {
            this.handlePlayerReconnection(client, reconnectionInfo);
        }
    }
    handleDisconnect(client) {
        this.handlePlayerDisconnect(client);
    }
    handlePlayerReconnection(client, reconnectionInfo) {
        const room = this.gameRooms.get(reconnectionInfo.roomId);
        if (!room) {
            this.playerReconnections.delete(client.id);
            return;
        }
        const playerIndex = room.players.findIndex(p => p.name === reconnectionInfo.playerName);
        if (playerIndex !== -1) {
            room.players[playerIndex].socketId = client.id;
            this.playerSockets.set(client.id, reconnectionInfo.roomId);
            client.join(reconnectionInfo.roomId);
            client.emit('roomStatus', {
                inRoom: true,
                roomId: reconnectionInfo.roomId,
                status: room.status,
                players: room.players.length,
                playersList: this.mapPlayersForClient(room.players)
            });
            if (room.status === 'playing') {
                this.sendCurrentGameState(client, room);
            }
        }
    }
    sendCurrentGameState(client, room) {
        client.emit('gameStarted');
        if (room.currentRound > 0) {
            const payload = {
                round: room.currentRound,
                news: room.currentNews,
                timer: room.roundTimer,
                fixedIncomeOffers: room.currentRound === 1 ? (this.roomFixedIncomeOffers.get(room.id) ?? []) : [],
                totalElapsedSeconds: room.totalElapsedSeconds
            };
            client.emit('roundStarted', payload);
        }
    }
    initializeGameData(roomId) {
        this.playerPortfolios.set(roomId, new Map());
        this.playerFixedIncome.set(roomId, new Map());
        this.dlog(`Game data initialized for room ${roomId}`);
        const stocks = new Map();
        for (let i = 1; i <= 6; i++) {
            stocks.set(i, 999);
        }
        this.companyStocks.set(roomId, stocks);
        this.dlog(`Available stocks initialized: 999 for each company`);
        this.roomFixedIncomeOffers.set(roomId, []);
    }
    initializePlayerPortfolio(roomId, socketId) {
        if (!this.playerPortfolios.has(roomId)) {
            this.playerPortfolios.set(roomId, new Map());
        }
        const roomPortfolios = this.playerPortfolios.get(roomId);
        if (!roomPortfolios.has(socketId)) {
            roomPortfolios.set(socketId, {
                cash: 10000,
                stocks: new Map()
            });
            this.dlog(`Portfolio initialized for socket ${socketId} in room ${roomId}: $10,000 cash`);
        }
        else {
            const existingPortfolio = roomPortfolios.get(socketId);
            this.dlog(`Portfolio already exists for socket ${socketId} in room ${roomId}: Cash $${existingPortfolio?.cash}, Stocks: ${existingPortfolio?.stocks.size} positions`);
        }
        const roomFixedIncome = this.playerFixedIncome.get(roomId);
        if (roomFixedIncome && !roomFixedIncome.has(socketId)) {
            roomFixedIncome.set(socketId, []);
        }
    }
    handleCreateRoom(client, payload) {
        const { playerName, roomCode, characterId } = payload;
        if (this.roomCodes.has(roomCode)) {
            client.emit('roomError', { message: 'Este código ya está en uso' });
            return;
        }
        const roomId = `room_${Date.now()}`;
        const room = {
            id: roomId,
            code: roomCode,
            players: [],
            status: 'waiting',
            currentRound: 0,
            roundTimer: 0,
            currentNews: null,
            roundStartTime: null,
            createdAt: Date.now(),
            fixedIncomeOffers: [],
            totalElapsedSeconds: 0,
            gameClockInterval: undefined
        };
        const player = {
            id: 1,
            name: playerName,
            socketId: client.id,
            isReady: false,
            characterId: characterId
        };
        room.players.push(player);
        this.gameRooms.set(roomId, room);
        this.roomCodes.set(roomCode, roomId);
        this.playerSockets.set(client.id, roomId);
        this.playerReconnections.set(client.id, { roomId, playerName, characterId });
        client.join(roomId);
        this.initializeGameData(roomId);
        this.initializePlayerPortfolio(roomId, client.id);
        const initialPortfolio = this.getPlayerPortfolio(roomId, client.id);
        if (initialPortfolio) {
            client.emit('portfolioUpdate', initialPortfolio);
        }
        const publicPlayers = this.mapPlayersForClient(room.players);
        this.server.to(roomId).emit('playersUpdate', publicPlayers);
        client.emit('roomCreated', {
            roomCode,
            players: room.players,
            message: 'Sala creada exitosamente. Esperando más jugadores...'
        });
    }
    handleJoinRoom(client, payload) {
        const { playerName, roomCode, characterId } = payload;
        const roomId = this.roomCodes.get(roomCode);
        if (!roomId) {
            client.emit('roomError', { message: 'Código de sala no encontrado' });
            return;
        }
        const room = this.gameRooms.get(roomId);
        if (!room) {
            client.emit('roomError', { message: 'Sala no encontrada' });
            return;
        }
        if (room.players.length >= 5) {
            client.emit('roomError', { message: 'La sala está llena' });
            return;
        }
        if (room.status === 'playing' || room.status === 'finished') {
            client.emit('roomError', { message: 'La partida ya está en curso' });
            return;
        }
        if (characterId !== undefined) {
            const characterTaken = room.players.some(p => p.characterId === characterId);
            if (characterTaken) {
                client.emit('roomError', { message: 'Este personaje ya está seleccionado' });
                return;
            }
        }
        const player = {
            id: room.players.length + 1,
            name: playerName,
            socketId: client.id,
            isReady: false,
            characterId: characterId
        };
        room.players.push(player);
        this.playerSockets.set(client.id, roomId);
        this.playerReconnections.set(client.id, { roomId, playerName, characterId });
        client.join(roomId);
        this.initializePlayerPortfolio(roomId, client.id);
        const initialPortfolio = this.getPlayerPortfolio(roomId, client.id);
        if (initialPortfolio) {
            client.emit('portfolioUpdate', initialPortfolio);
        }
        const publicPlayers = this.mapPlayersForClient(room.players);
        this.server.to(roomId).emit('playerJoined', {
            player: this.mapPlayerForClient(player),
            players: publicPlayers,
            message: `${playerName} se unió a la sala`
        });
        this.server.to(roomId).emit('playersUpdate', publicPlayers);
        if (room.players.length === 5) {
            room.status = 'ready';
            this.startGameCountdown(room);
        }
    }
    createNewRoom() {
        const roomId = `room_${Date.now()}`;
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room = {
            id: roomId,
            code: roomCode,
            players: [],
            status: 'waiting',
            currentRound: 0,
            roundTimer: 0,
            currentNews: null,
            roundStartTime: null,
            createdAt: Date.now(),
            fixedIncomeOffers: [],
            totalElapsedSeconds: 0,
            gameClockInterval: undefined
        };
        this.gameRooms.set(roomId, room);
        this.roomCodes.set(roomCode, roomId);
        return room;
    }
    startGame(room) {
        room.status = 'playing';
        room.currentRound = 1;
        const offers = this.buildFixedIncomeOffers();
        room.fixedIncomeOffers = offers;
        this.roomFixedIncomeOffers.set(room.id, offers);
        this.server.to(room.id).emit('fixedIncomeOffersUpdate', offers);
        for (const player of room.players) {
            const portfolio = this.getPlayerPortfolio(room.id, player.socketId);
            if (portfolio) {
                console.log(`Sending initial portfolio to player ${player.id} (${player.name}): $${portfolio.cash} cash`);
                this.server.to(player.socketId).emit('portfolioUpdate', portfolio);
            }
            else {
                console.log(`ERROR: No portfolio found for player ${player.id} (${player.name})`);
            }
        }
        this.server.to(room.id).emit('gameStarted');
        room.totalElapsedSeconds = 0;
        room.gameClockInterval = setInterval(() => {
            room.totalElapsedSeconds += 1;
            this.server.to(room.id).emit('gameTimer', room.totalElapsedSeconds);
        }, 1000);
        this.startRound(room);
    }
    startRound(room) {
        if (room.roundInterval) {
            clearInterval(room.roundInterval);
        }
        room.roundTimer = 75;
        room.roundStartTime = Date.now();
        if (room.currentRound === 1) {
            const offers = this.roomFixedIncomeOffers.get(room.id) ?? this.buildFixedIncomeOffers();
            room.fixedIncomeOffers = offers;
            this.roomFixedIncomeOffers.set(room.id, offers);
            this.server.to(room.id).emit('fixedIncomeOffersUpdate', offers);
        }
        else {
            room.fixedIncomeOffers = [];
            this.roomFixedIncomeOffers.set(room.id, []);
            this.server.to(room.id).emit('fixedIncomeOffersUpdate', []);
        }
        const news = this.generateRoundNews();
        room.currentNews = news;
        const payload = {
            round: room.currentRound,
            news,
            timer: room.roundTimer,
            fixedIncomeOffers: room.fixedIncomeOffers,
            totalElapsedSeconds: room.totalElapsedSeconds,
        };
        this.server.to(room.id).emit('roundStarted', payload);
        room.roundInterval = setInterval(() => {
            room.roundTimer--;
            this.server.to(room.id).emit('roundTimer', room.roundTimer);
            if (room.roundTimer <= 0) {
                clearInterval(room.roundInterval);
                room.roundInterval = undefined;
                this.endRound(room);
            }
        }, 1000);
    }
    endRound(room) {
        const priceChanges = this.calculatePriceChanges();
        this.updateStockPrices(priceChanges);
        this.processFixedIncomeHoldings(room);
        this.updateAllPortfolios(room.id);
        const payload = {
            round: room.currentRound,
            priceChanges,
        };
        this.server.to(room.id).emit('roundEnded', payload);
        if (room.currentRound < 5) {
            room.currentRound++;
            setTimeout(() => this.startRound(room), 5000);
        }
        else {
            this.endGame(room);
        }
    }
    endGame(room) {
        room.status = 'finished';
        if (room.gameClockInterval) {
            clearInterval(room.gameClockInterval);
            room.gameClockInterval = undefined;
        }
        const results = this.calculateFinalResults(room);
        this.latestGameResults = { roomId: room.id, results };
        this.server.to(room.id).emit('gameFinished', results);
        setTimeout(() => {
            this.gameRooms.delete(room.id);
        }, 30000);
    }
    generateRoundNews() {
        const positiveNews = [
            { type: 'POSITIVE', title: 'Sector tecnológico muestra crecimiento sostenido', effect: 'Incremento en acciones tech' },
            { type: 'POSITIVE', title: 'Nuevas inversiones en energía renovable', effect: 'Alza en sector energético' },
            { type: 'POSITIVE', title: 'Bachilleres se preparan para exámenes universitarios', effect: 'Sector educativo en alza' }
        ];
        const negativeNews = [
            { type: 'NEGATIVE', title: 'Incertidumbre en mercados financieros', effect: 'Caída en sector bancario' },
            { type: 'NEGATIVE', title: 'Construcción del metro afecta el centro de la ciudad', effect: 'Baja en sector construcción' },
            { type: 'NEGATIVE', title: 'Cierre de carreteras por fenómeno del niño', effect: 'Impacto en transporte' }
        ];
        return {
            positive: positiveNews[Math.floor(Math.random() * positiveNews.length)],
            negative: negativeNews[Math.floor(Math.random() * negativeNews.length)]
        };
    }
    calculatePriceChanges() {
        const companyIds = [1, 2, 3, 4, 5, 6];
        const changes = {};
        const specialEvent = this.getSpecialEvent();
        if (specialEvent) {
            return this.applySpecialEvent(companyIds, specialEvent);
        }
        companyIds.forEach((companyId) => {
            const change = (Math.random() - 0.5) * 0.2;
            const oldPrice = this.getStockPrice(companyId);
            const newPrice = oldPrice * (1 + change);
            changes[companyId] = {
                oldPrice,
                newPrice,
                change,
                eventType: 'normal',
            };
            this.dlog(`Price change for company ${companyId}: $${oldPrice.toFixed(2)} → $${newPrice.toFixed(2)} (${(change * 100).toFixed(1)}%)`);
        });
        return changes;
    }
    getSpecialEvent() {
        const random = Math.random();
        if (random < 0.01)
            return 'boom';
        if (random < 0.02)
            return 'crash';
        if (random < 0.03)
            return 'split';
        if (random < 0.04)
            return 'contraplit';
        return null;
    }
    applySpecialEvent(companyIds, eventType) {
        const changes = {};
        companyIds.forEach(companyId => {
            const oldPrice = this.getStockPrice(companyId);
            let newPrice = oldPrice;
            switch (eventType) {
                case 'boom':
                    newPrice = oldPrice * (1 + (Math.random() * 0.1 + 0.15));
                    changes[companyId] = {
                        oldPrice: oldPrice,
                        newPrice: newPrice,
                        change: (newPrice - oldPrice) / oldPrice,
                        eventType: 'boom',
                        message: '🚀 BOOM! Todos los precios suben!'
                    };
                    break;
                case 'crash':
                    newPrice = oldPrice * (1 - (Math.random() * 0.1 + 0.15));
                    changes[companyId] = {
                        oldPrice: oldPrice,
                        newPrice: newPrice,
                        change: (newPrice - oldPrice) / oldPrice,
                        eventType: 'crash',
                        message: '💥 CRASH! Todos los precios bajan!'
                    };
                    break;
                case 'split':
                    newPrice = oldPrice * 0.5;
                    changes[companyId] = {
                        oldPrice: oldPrice,
                        newPrice: newPrice,
                        change: -0.5,
                        eventType: 'split',
                        message: '📈 SPLIT! Precio reducido a la mitad'
                    };
                    break;
                case 'contraplit':
                    newPrice = oldPrice * 2;
                    changes[companyId] = {
                        oldPrice: oldPrice,
                        newPrice: newPrice,
                        change: 1.0,
                        eventType: 'contraplit',
                        message: '📉 CONTRA-SPLIT! Precio duplicado'
                    };
                    break;
            }
        });
        return changes;
    }
    calculateFinalResults(room) {
        const roundToTwo = (value) => Math.round(value * 100) / 100;
        const results = room.players.map(player => {
            const portfolioState = this.getPlayerPortfolio(room.id, player.socketId);
            const rawCash = portfolioState?.cash ?? 0;
            const rawPortfolio = portfolioState?.portfolioValue ?? 0;
            const rawTotal = portfolioState?.totalValue ?? rawCash + rawPortfolio;
            const cash = roundToTwo(rawCash);
            const portfolioValue = roundToTwo(rawPortfolio);
            const totalValue = roundToTwo(rawTotal);
            return {
                playerId: player.id,
                playerName: player.name,
                cash,
                portfolioValue,
                finalValue: totalValue,
                rank: 0
            };
        });
        return results
            .sort((a, b) => b.finalValue - a.finalValue)
            .map((player, index) => ({ ...player, rank: index + 1 }));
    }
    getCompanyName(companyId) {
        const companies = {
            1: 'MichiPapeles',
            2: 'MichiHotel',
            3: 'MichiAgro',
            4: 'MichiTech',
            5: 'MichiFuel',
            6: 'MichiHealth'
        };
        return companies[companyId] ?? `Empresa ${companyId}`;
    }
    getCompanySymbol(companyId) {
        const symbols = {
            1: 'MPA',
            2: 'MHT',
            3: 'MAG',
            4: 'MTC',
            5: 'MFL',
            6: 'MHL'
        };
        return symbols[companyId] ?? `${companyId}`;
    }
    getStockPrice(companyId) {
        if (!this.currentPrices.has(companyId)) {
            const basePrices = {
                1: 80.0,
                2: 100.0,
                3: 70.0,
                4: 90.0,
                5: 110.0,
                6: 85.0,
            };
            this.currentPrices.set(companyId, basePrices[companyId] || 50.0);
        }
        return this.currentPrices.get(companyId) || 50.0;
    }
    updateStockPrices(priceChanges) {
        for (const [companyId, change] of Object.entries(priceChanges)) {
            const payload = change;
            this.currentPrices.set(parseInt(companyId, 10), payload.newPrice);
            this.dlog(`Updated price for company ${companyId}: $${payload.newPrice.toFixed(2)}`);
        }
    }
    getPlayerPortfolio(roomId, socketId) {
        const roomPortfolios = this.playerPortfolios.get(roomId);
        if (!roomPortfolios) {
            this.dlog(`No room portfolios found for room ${roomId}`);
            return null;
        }
        const portfolio = roomPortfolios.get(socketId);
        if (!portfolio) {
            this.dlog(`No portfolio found for socket ${socketId} in room ${roomId}`);
            return null;
        }
        const room = this.gameRooms.get(roomId);
        const stage = room?.currentRound ?? 0;
        const holdings = Array.from(portfolio.stocks.entries()).map(([companyId, quantity]) => {
            const currentPrice = this.getStockPrice(companyId);
            return {
                stockId: companyId,
                symbol: this.getCompanySymbol(companyId),
                name: this.getCompanyName(companyId),
                quantity,
                currentPrice,
                totalValue: currentPrice * quantity
            };
        });
        const portfolioValue = holdings.reduce((total, holding) => total + holding.totalValue, 0);
        const fixedIncomeHoldings = this.getPlayerFixedIncome(roomId, socketId);
        const fixedIncomeValue = this.getFixedIncomeValue(roomId, socketId);
        const result = {
            cash: portfolio.cash,
            holdings,
            fixedIncomeHoldings: fixedIncomeHoldings.map((bond) => ({
                offerId: bond.offerId,
                issuer: bond.issuer,
                name: bond.name,
                unitPrice: bond.unitPrice,
                interestRate: bond.interestRate,
                remainingMonths: bond.remainingMonths,
                quantity: bond.quantity,
                currentValue: bond.unitPrice * bond.quantity,
            })),
            portfolioValue,
            stage,
            fixedIncomeValue,
            totalValue: portfolio.cash + portfolioValue + fixedIncomeValue
        };
        this.dlog(`Portfolio for socket ${socketId}: Cash $${result.cash}, Portfolio $${result.portfolioValue}, Total $${result.totalValue}`);
        return result;
    }
    updateAllPortfolios(roomId) {
        const roomPortfolios = this.playerPortfolios.get(roomId);
        if (!roomPortfolios)
            return;
        for (const [socketId] of roomPortfolios) {
            const updatedPortfolio = this.getPlayerPortfolio(roomId, socketId);
            if (updatedPortfolio) {
                this.dlog(`Sending updated portfolio to socket ${socketId}: Cash $${updatedPortfolio.cash}, Portfolio $${updatedPortfolio.portfolioValue}, Total $${updatedPortfolio.totalValue}`);
                this.server.to(socketId).emit('portfolioUpdate', updatedPortfolio);
            }
        }
    }
    scheduleFixedIncomeOffersUpdate(roomId) {
        if (this.fixedIncomeOffersUpdateTimers.has(roomId))
            return;
        const timer = setTimeout(() => {
            this.fixedIncomeOffersUpdateTimers.delete(roomId);
            const offers = this.roomFixedIncomeOffers.get(roomId) ?? [];
            this.server.to(roomId).emit('fixedIncomeOffersUpdate', offers);
        }, 100);
        this.fixedIncomeOffersUpdateTimers.set(roomId, timer);
    }
    startGameCountdown(room) {
        let countdown = 10;
        room.status = 'starting';
        const countdownInterval = setInterval(() => {
            this.server.to(room.id).emit('gameStartCountdown', countdown);
            countdown--;
            if (countdown < 0) {
                clearInterval(countdownInterval);
                this.startGame(room);
            }
        }, 1000);
    }
    getLatestResults() {
        return this.latestGameResults?.results ?? [];
    }
    handlePlayerDisconnect(client) {
        const roomId = this.playerSockets.get(client.id);
        if (!roomId)
            return;
        const room = this.gameRooms.get(roomId);
        if (!room)
            return;
        room.players = room.players.filter(p => p.socketId !== client.id);
        this.playerSockets.delete(client.id);
        this.server.to(roomId).emit('playersUpdate', this.mapPlayersForClient(room.players));
        if (room.players.length === 0) {
            this.gameRooms.delete(roomId);
        }
    }
    emitTicker(payload) {
        this.server.emit('ticker', payload);
    }
    emitNews(payload) {
        this.server.emit('news', payload);
    }
    emitEvent(payload) {
        this.server.emit('event', payload);
    }
    emitRanking(payload) {
        this.server.emit('ranking', payload);
    }
    emitPriceUpdate(companyId, price) {
        this.server.emit('priceUpdate', { companyId, price });
    }
};
exports.WsGateway = WsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], WsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('purchaseFixedIncome'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handlePurchaseFixedIncome", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('gameTransaction'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleGameTransaction", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('bulkGameTransactions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleBulkGameTransactions", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('requestRoundState'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleRequestRoundState", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('checkRoomStatus'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleCheckRoomStatus", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('createRoom'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleCreateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinRoom'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleJoinRoom", null);
exports.WsGateway = WsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: {
            origin: 'http://localhost:5173',
            credentials: true
        }
    })
], WsGateway);
