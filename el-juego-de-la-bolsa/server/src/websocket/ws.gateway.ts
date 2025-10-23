import { OnModuleInit } from '@nestjs/common';
import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface Player {
  id: number;
  name: string;
  socketId: string;
  isReady: boolean;
  characterId?: number;
}

interface FixedIncomeOffer {
  id: string;
  issuer: string;
  name: string;
  unitPrice: number;
  interestRate: number;
  termMonths: number;
  remainingUnits: number;
}

interface FixedIncomeHolding {
  offerId: string;
  issuer: string;
  name: string;
  unitPrice: number;
  interestRate: number;
  remainingMonths: number;
  quantity: number;
}

interface GameRoom {
  id: string;
  code: string;
  players: Player[];
  status: 'waiting' | 'ready' | 'starting' | 'playing' | 'finished';
  currentRound: number;
  roundTimer: number;
  currentNews: any;
  roundStartTime: number | null;
  roundInterval?: NodeJS.Timeout;
  createdAt: number;
  fixedIncomeOffers: FixedIncomeOffer[];
}

@WebSocketGateway({  cors: { 
    origin: 'http://localhost:5173', // URL específica del cliente
    credentials: true 
  } 
})
export class WsGateway implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private gameRooms: Map<string, GameRoom> = new Map();
  private roomCodes: Map<string, string> = new Map(); // roomCode -> roomId
  private playerSockets: Map<string, string> = new Map(); // socketId -> roomId
  private playerReconnections: Map<string, { roomId: string; playerName: string; characterId?: number }> = new Map(); // socketId -> room info
  private playerPortfolios: Map<string, Map<string, { cash: number; stocks: Map<number, number> }>> = new Map(); // roomId -> socketId -> portfolio
  private playerFixedIncome: Map<string, Map<string, FixedIncomeHolding[]>> = new Map(); // roomId -> socketId -> fixed income holdings
  private companyStocks: Map<string, Map<number, number>> = new Map(); // roomId -> companyId -> available stocks
  private latestGameResults: { roomId: string; results: any[] } | null = null;
  private roomFixedIncomeOffers: Map<string, FixedIncomeOffer[]> = new Map();

  private readonly fixedIncomeTemplates: Array<Omit<FixedIncomeOffer, 'remainingUnits'>> = [
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

  private buildFixedIncomeOffers(): FixedIncomeOffer[] {
    return this.fixedIncomeTemplates.map((template) => ({
      ...template,
      remainingUnits: 200,
    }));
  }

  @SubscribeMessage('purchaseFixedIncome')
  handlePurchaseFixedIncome(client: Socket, payload: { offerId: string; quantity: number }) {
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

    // Registrar compra
    playerPortfolio.cash -= totalCost;
    offer.remainingUnits -= quantity;

    const roomHoldings = this.playerFixedIncome.get(roomId)!;
    const currentHoldings = roomHoldings.get(client.id) ?? [];
    const existingHolding = currentHoldings.find((h) => h.offerId === offer.id && h.remainingMonths === offer.termMonths);

    if (existingHolding) {
      existingHolding.quantity += quantity;
    } else {
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

    // Emitir resultados
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
    this.server.to(roomId).emit('fixedIncomeOffersUpdate', offers);
  }

  private getPlayerFixedIncome(roomId: string, socketId: string): FixedIncomeHolding[] {
    const roomHoldings = this.playerFixedIncome.get(roomId);
    if (!roomHoldings) {
      return [];
    }
    return roomHoldings.get(socketId) ?? [];
  }

  private processFixedIncomeHoldings(room: GameRoom) {
    const roomHoldings = this.playerFixedIncome.get(room.id);
    if (!roomHoldings) return;

    for (const [socketId, holdings] of roomHoldings.entries()) {
      const playerPortfolio = this.playerPortfolios.get(room.id)?.get(socketId);
      if (!playerPortfolio) continue;

      const remainingHoldings: FixedIncomeHolding[] = [];

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
        } else {
          remainingHoldings.push(updatedHolding);
        }
      }

      roomHoldings.set(socketId, remainingHoldings);
    }
  }

  private getFixedIncomeValue(roomId: string, socketId: string) {
    return this.getPlayerFixedIncome(roomId, socketId).reduce((total, bond) => total + bond.unitPrice * bond.quantity, 0);
  }

  onModuleInit() {
  }

  @SubscribeMessage('requestRoundState')
  handleRequestRoundState(client: Socket) {
    const roomId = this.playerSockets.get(client.id);
    if (!roomId) return;

    const room = this.gameRooms.get(roomId);
    if (!room) return;

    // Calcular tiempo restante basado en el tiempo transcurrido
    let remainingTime = room.roundTimer;
    if (room.roundStartTime && room.roundTimer > 0) {
      const elapsed = Math.floor((Date.now() - room.roundStartTime) / 1000);
      remainingTime = Math.max(0, room.roundTimer - elapsed);
    }

    const phase = remainingTime <= 60 ? 'trading' : 'news';


    client.emit('roundState', {
      status: room.status,
      round: room.currentRound,
      timer: remainingTime,
      news: room.currentNews,
      phase,
      fixedIncomeOffers: room.currentRound === 1 ? (this.roomFixedIncomeOffers.get(roomId) ?? []) : []
    });
  }

  handleConnection(client: Socket) {
    // Verificar si es una reconexión
    const reconnectionInfo = this.playerReconnections.get(client.id);
    if (reconnectionInfo) {
      this.handlePlayerReconnection(client, reconnectionInfo);
  }
}
  handleDisconnect(client: Socket) {
    this.handlePlayerDisconnect(client);
  }

  private handlePlayerReconnection(client: Socket, reconnectionInfo: { roomId: string; playerName: string; characterId?: number }) {
    const room = this.gameRooms.get(reconnectionInfo.roomId);
    if (!room) {
      this.playerReconnections.delete(client.id);
      return;
    }

    // Actualizar el socketId del jugador en la sala
    const playerIndex = room.players.findIndex(p => p.name === reconnectionInfo.playerName);
    if (playerIndex !== -1) {
      room.players[playerIndex].socketId = client.id;
      this.playerSockets.set(client.id, reconnectionInfo.roomId);
      client.join(reconnectionInfo.roomId);
      
      // Enviar estado actual de la sala
      client.emit('roomStatus', { 
        inRoom: true, 
        roomId: reconnectionInfo.roomId, 
        status: room.status,
        players: room.players.length 
      });
      
      // Si el juego ya está en progreso, enviar el estado actual
      if (room.status === 'playing') {
        this.sendCurrentGameState(client, room);
      }
    }
  }

  private sendCurrentGameState(client: Socket, room: GameRoom) {
    // Enviar estado actual del juego
    client.emit('gameStarted');
    
    if (room.currentRound > 0) {
      client.emit('roundStarted', {
        round: room.currentRound,
        news: room.currentNews,
        timer: room.roundTimer,
        fixedIncomeOffers: room.currentRound === 1 ? (this.roomFixedIncomeOffers.get(room.id) ?? []) : []
      });
    }
  }

  private initializeGameData(roomId: string) {
    // Inicializar portafolios de jugadores
    this.playerPortfolios.set(roomId, new Map());
    this.playerFixedIncome.set(roomId, new Map());
    console.log(`Game data initialized for room ${roomId}`);

    // Inicializar acciones disponibles (999 por empresa)
    const stocks = new Map();
    for (let i = 1; i <= 6; i++) {
      stocks.set(i, 999);
    }
    this.companyStocks.set(roomId, stocks);
    console.log(`Available stocks initialized: 999 for each company`);

    this.roomFixedIncomeOffers.set(roomId, []);
  }

  private initializePlayerPortfolio(roomId: string, socketId: string) {
    if (!this.playerPortfolios.has(roomId)) {
      this.playerPortfolios.set(roomId, new Map());
    }
    
    const roomPortfolios = this.playerPortfolios.get(roomId)!;
    
    // Solo inicializar si el jugador no tiene portafolio
    if (!roomPortfolios.has(socketId)) {
      roomPortfolios.set(socketId, {
        cash: 10000,
        stocks: new Map()
      });
      
      console.log(`Portfolio initialized for socket ${socketId} in room ${roomId}: $10,000 cash`);
    } else {
      const existingPortfolio = roomPortfolios.get(socketId);
      console.log(`Portfolio already exists for socket ${socketId} in room ${roomId}: Cash $${existingPortfolio?.cash}, Stocks: ${existingPortfolio?.stocks.size} positions`);
    }

    const roomFixedIncome = this.playerFixedIncome.get(roomId);
    if (roomFixedIncome && !roomFixedIncome.has(socketId)) {
      roomFixedIncome.set(socketId, []);
    }
  }

  @SubscribeMessage('createRoom')
  handleCreateRoom(client: Socket, payload: { playerName: string; roomCode: string; characterId?: number }) {
    const { playerName, roomCode, characterId } = payload;
    
    // Verificar si el código ya existe
    if (this.roomCodes.has(roomCode)) {
      client.emit('roomError', { message: 'Este código ya está en uso' });
      return;
    }

    // Crear nueva sala
    const roomId = `room_${Date.now()}`;
    const room: GameRoom = {
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
    };

    // Agregar jugador creador
    const player: Player = {
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
    
    // Inicializar sistema de portafolios y acciones
    this.initializeGameData(roomId);
    
    // Inicializar portafolio del creador
    this.initializePlayerPortfolio(roomId, client.id);

    // Enviar portafolio inicial al creador
    const initialPortfolio = this.getPlayerPortfolio(roomId, client.id);
    if (initialPortfolio) {
      client.emit('portfolioUpdate', initialPortfolio);
    }

    client.emit('roomCreated', { 
      roomCode, 
      players: room.players,
      message: 'Sala creada exitosamente. Esperando más jugadores...'
    });
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, payload: { playerName: string; roomCode: string; characterId?: number }) {
    const { playerName, roomCode, characterId } = payload;
    
    // Buscar sala por código
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

    // Verificar si la sala está llena
    if (room.players.length >= 5) {
      client.emit('roomError', { message: 'La sala está llena' });
      return;
    }

    // Verificar si la sala ya está en juego
    if (room.status === 'playing' || room.status === 'finished') {
      client.emit('roomError', { message: 'La partida ya está en curso' });
      return;
    }

    // Verificar si el personaje ya está seleccionado
    if (characterId !== undefined) {
      const characterTaken = room.players.some(p => p.characterId === characterId);
      if (characterTaken) {
        client.emit('roomError', { message: 'Este personaje ya está seleccionado' });
        return;
      }
    }

    // Agregar jugador
    const player: Player = {
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
    
    // Inicializar portafolio del jugador
    this.initializePlayerPortfolio(roomId, client.id);

    // Enviar portafolio inicial al jugador que se unió
    const initialPortfolio = this.getPlayerPortfolio(roomId, client.id);
    if (initialPortfolio) {
      client.emit('portfolioUpdate', initialPortfolio);
    }

    // Notificar a todos los jugadores
    this.server.to(roomId).emit('playerJoined', {
      player,
      players: room.players,
      message: `${playerName} se unió a la sala`
    });

    // Si la sala está llena, iniciar countdown
    if (room.players.length === 5) {
      room.status = 'ready';
      this.startGameCountdown(room);
    }
  }

  @SubscribeMessage('joinWaitingRoom')
  handleJoinWaitingRoom(client: Socket, payload: { userId: number; userName: string }) {
    // Este método está deshabilitado - usar createRoom/joinRoom en su lugar
    client.emit('roomError', { 
      message: 'Método obsoleto. Usa "Crear Partida" o "Unirse a Partida" desde el lobby.' 
    });
  }

  @SubscribeMessage('checkRoomStatus')
  handleCheckRoomStatus(client: Socket) {
    const roomId = this.playerSockets.get(client.id);
    if (!roomId) {
      client.emit('roomStatus', { inRoom: false });
      return;
    }

    const room = this.gameRooms.get(roomId);
    if (!room) {
      client.emit('roomStatus', { inRoom: false });
      return;
    }

    client.emit('roomStatus', { 
      inRoom: true, 
      roomId: roomId, 
      status: room.status,
      players: room.players.length,
      playersList: room.players
    });
  }

  @SubscribeMessage('gameTransaction')
  handleGameTransaction(client: Socket, payload: any) {
    
    const roomId = this.playerSockets.get(client.id);
    if (!roomId) {
      client.emit('transactionProcessed', {
        success: false,
        error: 'No estás en una sala de juego',
        message: 'Transacción no procesada: No estás en una sala de juego'
      });
      return;
    }

    const room = this.gameRooms.get(roomId);
    if (!room) {
      client.emit('transactionProcessed', {
        success: false,
        error: 'Sala no encontrada',
        message: 'Transacción no procesada: Sala no encontrada'
      });
      return;
    }

    if (room.status !== 'playing') {
      client.emit('transactionProcessed', {
        success: false,
        error: 'El juego no está activo',
        message: 'Transacción no procesada: El juego no está activo'
      });
      return;
    }

    // Validar transacción
    const isValid = this.validateTransaction(payload);
    const companyName = this.getCompanyName(payload.companyId);
    
    if (isValid) {
      // Procesar transacción real
      try {
        const success = this.processTransaction(roomId, client.id, payload.type, payload.companyId, payload.quantity);
        
        if (success) {
          // Enviar actualización de portafolio al jugador
          const portfolio = this.getPlayerPortfolio(roomId, client.id);
          client.emit('portfolioUpdate', portfolio);
          
          // Enviar actualización de acciones disponibles a todos
          const availableStocks = this.getAvailableStocks(roomId);
          this.server.to(roomId).emit('stocksUpdate', availableStocks);
          
      this.server.to(roomId).emit('transactionProcessed', {
        success: true,
        playerId: payload.userId,
        type: payload.type,
        companyName: companyName,
            companySymbol: this.getCompanySymbol(payload.companyId),
        quantity: payload.quantity,
            priceAtMoment: this.getStockPrice(payload.companyId),
        message: `Transacción procesada exitosamente`
      });
        } else {
          client.emit('transactionProcessed', {
            success: false,
            playerId: payload.userId,
            error: 'Fondos insuficientes o acciones no disponibles',
            message: `Transacción no procesada: Fondos insuficientes`
          });
        }
      } catch (error) {
        client.emit('transactionProcessed', {
          success: false,
          playerId: payload.userId,
          error: 'Error al procesar la transacción',
          message: `Transacción no procesada: Error del servidor`
        });
      }
    } else {
      // Transacción fallida
      const errorMessage = this.getTransactionError(payload);
      client.emit('transactionProcessed', {
        success: false,
        playerId: payload.userId,
        error: errorMessage,
        message: `Transacción no procesada: ${errorMessage}`
      });
    }
  }

  private validateTransaction(payload: any): boolean {
    // Validación básica de transacción
    if (!payload.type || !payload.quantity || !payload.companyId) {
    return false;
    }

    // Validación simple: solo verificar que la cantidad sea positiva
    return payload.quantity > 0;
  }

  private getTransactionError(payload: any): string {
    if (!payload.type || !payload.quantity || !payload.companyId) {
      return 'Datos de transacción incompletos';
    }
    
    if (payload.quantity <= 0) {
      return 'La cantidad debe ser mayor a 0';
    }
    
    return 'Transacción no válida';
  }

  private getCompanyName(companyId: number): string {
    const companies: Record<number, string> = {
      1: 'MichiPapeles',
      2: 'MichiHotel',
      3: 'MichiAgro',
      4: 'MichiTech',
      5: 'MichiFuel'
    };
    return companies[companyId] ?? 'Empresa Desconocida';
  }

  private getCompanySymbol(companyId: number): string {
    const symbols: Record<number, string> = {
      1: 'TNV',
      2: 'GEC',
      3: 'HPI',
      4: 'RTM',
      5: 'FF',
      6: 'ADL'
    };
    return symbols[companyId] ?? 'N/A';
  }

  private processTransaction(roomId: string, socketId: string, type: string, companyId: number, quantity: number): boolean {
    const roomPortfolios = this.playerPortfolios.get(roomId);
    const roomStocks = this.companyStocks.get(roomId);
    
    if (!roomPortfolios || !roomStocks) {
      console.log(`No portfolios or stocks found for room ${roomId}`);
      return false;
    }
    
    const playerPortfolio = roomPortfolios.get(socketId);
    if (!playerPortfolio) {
      console.log(`No portfolio found for socket ${socketId} in room ${roomId}`);
      return false;
    }
    
    console.log(`Processing ${type} transaction for socket ${socketId}: ${quantity} shares of company ${companyId}`);
    console.log(`Player cash: $${playerPortfolio.cash}, Available stocks: ${roomStocks.get(companyId)}`);
    
    const stockPrice = this.getStockPrice(companyId);
    const totalCost = stockPrice * quantity;
    
    if (type === 'BUY') {
      // Verificar fondos y acciones disponibles
      console.log(`Buy validation: Cash $${playerPortfolio.cash} >= Cost $${totalCost}? ${playerPortfolio.cash >= totalCost}`);
      console.log(`Stocks validation: Available ${roomStocks.get(companyId)} >= Quantity ${quantity}? ${roomStocks.get(companyId)! >= quantity}`);
      
      if (playerPortfolio.cash < totalCost || roomStocks.get(companyId)! < quantity) {
        console.log(`Transaction failed: Insufficient funds or stocks`);
        return false;
      }
      
      // Procesar compra
      playerPortfolio.cash -= totalCost;
      const currentStocks = playerPortfolio.stocks.get(companyId) || 0;
      playerPortfolio.stocks.set(companyId, currentStocks + quantity);
      
      // Reducir acciones disponibles
      roomStocks.set(companyId, roomStocks.get(companyId)! - quantity);
      
      console.log(`Buy successful: Player now has $${playerPortfolio.cash} cash and ${playerPortfolio.stocks.get(companyId)} shares of company ${companyId}`);
    } else if (type === 'SELL') {
      // Verificar que tenga acciones para vender
      const currentStocks = playerPortfolio.stocks.get(companyId) || 0;
      if (currentStocks < quantity) {
        return false;
      }
      
      // Procesar venta
      playerPortfolio.cash += totalCost;
      playerPortfolio.stocks.set(companyId, currentStocks - quantity);
      
      // Aumentar acciones disponibles
      roomStocks.set(companyId, roomStocks.get(companyId)! + quantity);
    }
    
    return true;
  }

  // Almacenar precios actuales por empresa
  private currentPrices: Map<number, number> = new Map();

  private getStockPrice(companyId: number): number {
    // Si no hay precio actual, usar precio base
    if (!this.currentPrices.has(companyId)) {
      const basePrices: Record<number, number> = {
        1: 75.00,  // TechNova
        2: 50.00,  // GreenEnergy
        3: 75.00,  // HealthPlus
        4: 80.00,  // RetailMax
        5: 90.00,  // FinanceFirst
        6: 65.00   // AutoDrive
      };
      this.currentPrices.set(companyId, basePrices[companyId] || 50.00);
    }
    return this.currentPrices.get(companyId) || 50.00;
  }

  private updateStockPrices(priceChanges: any) {
    for (const [companyId, change] of Object.entries(priceChanges)) {
      const newPrice = (change as any).newPrice;
      this.currentPrices.set(parseInt(companyId), newPrice);
      console.log(`Updated price for company ${companyId}: $${newPrice.toFixed(2)}`);
    }
  }

  private updateAllPortfolios(roomId: string) {
    const roomPortfolios = this.playerPortfolios.get(roomId);
    if (!roomPortfolios) return;

    for (const [socketId] of roomPortfolios) {
      const updatedPortfolio = this.getPlayerPortfolio(roomId, socketId);
      if (updatedPortfolio) {
        console.log(`Sending updated portfolio to socket ${socketId}: Cash $${updatedPortfolio.cash}, Portfolio $${updatedPortfolio.portfolioValue}, Total $${updatedPortfolio.totalValue}`);
        this.server.to(socketId).emit('portfolioUpdate', updatedPortfolio);
      }
    }
  }

  private getPlayerPortfolio(roomId: string, socketId: string) {
    const roomPortfolios = this.playerPortfolios.get(roomId);
    if (!roomPortfolios) {
      console.log(`No room portfolios found for room ${roomId}`);
      return null;
    }
    
    const portfolio = roomPortfolios.get(socketId);
    if (!portfolio) {
      console.log(`No portfolio found for socket ${socketId} in room ${roomId}`);
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

    console.log(`Portfolio for socket ${socketId}: Cash $${result.cash}, Portfolio $${result.portfolioValue}, Total $${result.totalValue}`);
    return result;
  }

  private getAvailableStocks(roomId: string) {
    const roomStocks = this.companyStocks.get(roomId);
    if (!roomStocks) {
      console.log(`No room stocks found for room ${roomId}`);
      return {};
    }
    
    const stocks: Record<number, number> = {};
    for (const [companyId, quantity] of roomStocks) {
      stocks[companyId] = quantity;
      console.log(`Company ${companyId}: ${quantity} available stocks`);
    }
    
    console.log(`Sending stocks update for room ${roomId}:`, stocks);
    return stocks;
  }


  private findAvailableRoom(): GameRoom | null {
    // Primero buscar salas en juego que tengan espacio
    for (const room of this.gameRooms.values()) {
      if ((room.status === 'playing' || room.status === 'starting') && room.players.length < 5) {
        return room;
      }
    }
    
    // Luego buscar salas en espera
    for (const room of this.gameRooms.values()) {
      if (room.status === 'waiting' && room.players.length < 5) {
        return room;
      }
    }
    
    // Si no hay salas disponibles, buscar cualquier sala activa para unirse como espectador
    for (const room of this.gameRooms.values()) {
      if (room.status === 'playing' || room.status === 'starting') {
        return room;
      }
    }
    
    return null;
  }

  private createNewRoom(): GameRoom {
    const roomId = `room_${Date.now()}`;
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room: GameRoom = {
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
    };

    this.gameRooms.set(roomId, room);
    this.roomCodes.set(roomCode, roomId);
    return room;
  }

  private startGameCountdown(room: GameRoom) {
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

  private startGame(room: GameRoom) {
    room.status = 'playing';
    room.currentRound = 1;
    const offers = this.buildFixedIncomeOffers();
    room.fixedIncomeOffers = offers;
    this.roomFixedIncomeOffers.set(room.id, offers);
    this.server.to(room.id).emit('fixedIncomeOffersUpdate', offers);

    // Enviar portafolio inicial a todos los jugadores
    for (const player of room.players) {
      const portfolio = this.getPlayerPortfolio(room.id, player.socketId);
      if (portfolio) {
        console.log(`Sending initial portfolio to player ${player.id} (${player.name}): $${portfolio.cash} cash`);
        this.server.to(player.socketId).emit('portfolioUpdate', portfolio);
      } else {
        console.log(`ERROR: No portfolio found for player ${player.id} (${player.name})`);
      }
    }
    
    this.server.to(room.id).emit('gameStarted');
    
    // Iniciar primera ronda
    this.startRound(room);
  }

  private startRound(room: GameRoom) {

    // Limpiar intervalo anterior si existe
    if (room.roundInterval) {
      clearInterval(room.roundInterval);
    }

    room.roundTimer = 75; // 15 segundos de noticias + 60 segundos de trading
    room.roundStartTime = Date.now();

    if (room.currentRound === 1) {
      const offers = this.roomFixedIncomeOffers.get(room.id) ?? this.buildFixedIncomeOffers();
      room.fixedIncomeOffers = offers;
      this.roomFixedIncomeOffers.set(room.id, offers);
      this.server.to(room.id).emit('fixedIncomeOffersUpdate', offers);
    } else {
      room.fixedIncomeOffers = [];
      this.roomFixedIncomeOffers.set(room.id, []);
      this.server.to(room.id).emit('fixedIncomeOffersUpdate', []);
    }

    // Generar noticias para la ronda
    const news = this.generateRoundNews();
    room.currentNews = news;

    this.server.to(room.id).emit('roundStarted', {
      round: room.currentRound,
      news: news,
      timer: room.roundTimer,
      fixedIncomeOffers: room.fixedIncomeOffers
    });

    // Timer de la ronda
    room.roundInterval = setInterval(() => {
      room.roundTimer--;
      this.server.to(room.id).emit('roundTimer', room.roundTimer);

      if (room.roundTimer <= 0) {
        clearInterval(room.roundInterval!);
        room.roundInterval = undefined;
        this.endRound(room);
      }
    }, 1000);
  }

  private endRound(room: GameRoom) {
    // Procesar fluctuaciones de precios
    const priceChanges = this.calculatePriceChanges();

    // Actualizar precios en el sistema
    this.updateStockPrices(priceChanges);

    // Procesar renta fija
    this.processFixedIncomeHoldings(room);

    // Enviar actualizaciones de portafolio a todos los jugadores
    this.updateAllPortfolios(room.id);
    
    this.server.to(room.id).emit('roundEnded', {
      round: room.currentRound,
      priceChanges: priceChanges
    });

    // Siguiente ronda o finalizar juego
    if (room.currentRound < 5) {
      room.currentRound++;
      setTimeout(() => this.startRound(room), 5000); // 5 segundos entre rondas
    } else {
      this.endGame(room);
    }
  }

  private endGame(room: GameRoom) {
    room.status = 'finished';
    
    // Calcular resultados finales
    const results = this.calculateFinalResults(room);
    this.latestGameResults = { roomId: room.id, results };
    this.server.to(room.id).emit('gameFinished', results);

    // Limpiar sala después de 30 segundos
    setTimeout(() => {
      this.gameRooms.delete(room.id);
    }, 30000);
  }

  private generateRoundNews() {
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

  private calculatePriceChanges() {
    const companies = ['MPA', 'MHT', 'MAG', 'MTC', 'MFL'];
    const changes: any = {};
    
    // Determinar si hay evento especial (5% de probabilidad)
    const specialEvent = this.getSpecialEvent();
    
    if (specialEvent) {
      // Convertir IDs a símbolos para applySpecialEvent
      const companySymbols = companies.map(id => this.getCompanySymbol(id));
      return this.applySpecialEvent(companySymbols, specialEvent);
    }
    
    // Cambios normales basados en noticias
    companies.forEach(companyId => {
      const change = (Math.random() - 0.5) * 0.2; // -10% a +10%
      const oldPrice = this.getStockPrice(companyId);
      const newPrice = oldPrice * (1 + change);
      
      changes[companyId] = {
        oldPrice: oldPrice,
        newPrice: newPrice,
        change: change,
        eventType: 'normal'
      };
      
      console.log(`Price change for company ${companyId}: $${oldPrice.toFixed(2)} → $${newPrice.toFixed(2)} (${(change * 100).toFixed(1)}%)`);
    });

    return changes;
  }

  private getSpecialEvent(): string | null {
    const random = Math.random();
    if (random < 0.01) return 'boom';      // 1% probabilidad
    if (random < 0.02) return 'crash';     // 1% probabilidad  
    if (random < 0.03) return 'split';     // 1% probabilidad
    if (random < 0.04) return 'contraplit'; // 1% probabilidad
    return null;
  }

  private applySpecialEvent(companySymbols: string[], eventType: string) {
    const changes: any = {};
    
    // Usar IDs numéricos para el sistema de precios
    const companyIds = [1, 2, 3, 4, 5, 6];
    
    companyIds.forEach(companyId => {
      const oldPrice = this.getStockPrice(companyId);
      let newPrice = oldPrice;
      
      switch (eventType) {
        case 'boom':
          // Incrementa precios de todas las acciones 15-25%
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
          // Reduce precios de todas las acciones 15-25%
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
          // Split de acciones - precio se reduce a la mitad
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
          // Contra-split - precio se duplica
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

  private calculateFinalResults(room: GameRoom) {
    const roundToTwo = (value: number) => Math.round(value * 100) / 100;

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

  getLatestResults() {
    return this.latestGameResults?.results ?? [];
  }

  private handlePlayerDisconnect(client: Socket) {
    const roomId = this.playerSockets.get(client.id);
    if (!roomId) return;

    const room = this.gameRooms.get(roomId);
    if (!room) return;

    // Remover jugador de la sala
    room.players = room.players.filter(p => p.socketId !== client.id);
    this.playerSockets.delete(client.id);

    // Notificar a otros jugadores
    this.server.to(roomId).emit('playersUpdate', room.players);

    // Si no quedan jugadores, eliminar sala
    if (room.players.length === 0) {
      this.gameRooms.delete(roomId);
    }
  }

  // Métodos originales para compatibilidad
  emitTicker(payload: any) {
    this.server.emit('ticker', payload);
  }

  emitNews(payload: any) {
    this.server.emit('news', payload);
  }

  emitEvent(payload: any) {
    this.server.emit('event', payload);
  }

  emitRanking(payload: any) {
    this.server.emit('ranking', payload);
  }

  emitPriceUpdate(companyId: number, price: number) {
    this.server.emit('priceUpdate', { companyId, price });
  }
}
