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
}

interface GameRoom {
  id: string;
  players: Player[];
  status: 'waiting' | 'ready' | 'starting' | 'playing' | 'finished';
  currentRound: number;
  roundTimer: number;
  currentNews: any;
  roundStartTime: number | null;
  roundInterval?: NodeJS.Timeout;
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
  private playerSockets: Map<string, string> = new Map(); // socketId -> roomId

  onModuleInit() {
    console.log('WebSocket Gateway initialized');
  }

  @SubscribeMessage('requestRoundState')
  handleRequestRoundState(client: Socket) {
    const roomId = this.playerSockets.get(client.id);
    if (!roomId) return;

    const room = this.gameRooms.get(roomId);
    if (!room) return;

    const phase = room.roundTimer <= 50 ? 'trading' : 'news';

    client.emit('roundState', {
      status: room.status,
      round: room.currentRound,
      timer: room.roundTimer,
      news: room.currentNews,
      phase
    });
  }

  handleConnection(client: Socket) {
  console.log(`Client connected: ${client.id}`);
  // Verificar token si es necesario
  const token = client.handshake.auth?.token;
  if (!token) {
    console.log('No token provided, disconnecting');
    client.disconnect();
    return;
  }
}
  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.handlePlayerDisconnect(client);
  }

  @SubscribeMessage('joinWaitingRoom')
  handleJoinWaitingRoom(client: Socket, payload: { userId: number; userName: string }) {
    const { userId, userName } = payload;
    
    // Buscar una sala disponible o crear una nueva
    let room = this.findAvailableRoom();
    if (!room) {
      room = this.createNewRoom();
    }

    // Agregar jugador a la sala
    const player: Player = {
      id: userId,
      name: userName,
      socketId: client.id,
      isReady: false
    };

    room.players.push(player);
    this.playerSockets.set(client.id, room.id);
    
    // Unir al cliente a la sala de Socket.IO
    client.join(room.id);

    // Notificar a todos los jugadores en la sala
    this.server.to(room.id).emit('playersUpdate', room.players);

    console.log(`Player ${userName} joined room ${room.id}. Players: ${room.players.length}/5`);

    // Si la sala está llena, iniciar countdown
    if (room.players.length === 5) {
      room.status = 'ready';
      this.startGameCountdown(room);
    }
  }

  @SubscribeMessage('gameTransaction')
  handleGameTransaction(client: Socket, payload: any) {
    const roomId = this.playerSockets.get(client.id);
    if (!roomId) return;

    const room = this.gameRooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    // Simular validación de transacción
    const isValid = this.validateTransaction(payload);
    const companyName = this.getCompanyName(payload.companyId);
    
    if (isValid) {
      // Transacción exitosa
      this.server.to(roomId).emit('transactionProcessed', {
        success: true,
        playerId: payload.userId,
        type: payload.type,
        companyName: companyName,
        quantity: payload.quantity,
        message: `Transacción procesada exitosamente`
      });
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
    // Simulación de validación - en producción validar con base de datos
    if (payload.type === 'buy') {
      // Validar que tenga suficiente efectivo
      return payload.quantity > 0 && payload.quantity <= 1000;
    } else if (payload.type === 'sell') {
      // Validar que tenga suficientes acciones
      return payload.quantity > 0 && payload.quantity <= 500;
    }
    return false;
  }

  private getCompanyName(companyId: number): string {
    const companies: Record<number, string> = {
      1: 'TechNova',
      2: 'GreenEnergy',
      3: 'HealthPlus',
      4: 'RetailMax',
      5: 'FinanceFirst',
      6: 'AutoDrive'
    };
    return companies[companyId] ?? 'Empresa Desconocida';
  }

  private getTransactionError(payload: any): string {
    if (payload.quantity <= 0) {
      return 'Cantidad debe ser mayor a 0';
    }
    if (payload.type === 'buy' && payload.quantity > 1000) {
      return 'Fondos insuficientes';
    }
    if (payload.type === 'sell' && payload.quantity > 500) {
      return 'No tiene suficientes acciones';
    }
    return 'Error desconocido en la transacción';
  }

  private findAvailableRoom(): GameRoom | null {
    for (const room of this.gameRooms.values()) {
      if (room.status === 'waiting' && room.players.length < 5) {
        return room;
      }
    }
    return null;
  }

  private createNewRoom(): GameRoom {
    const roomId = `room_${Date.now()}`;
    const room: GameRoom = {
      id: roomId,
      players: [],
      status: 'waiting',
      currentRound: 0,
      roundTimer: 0,
      currentNews: null,
      roundStartTime: null
    };

    this.gameRooms.set(roomId, room);
    console.log(`Created new room: ${roomId}`);
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
    
    console.log(`Game started in room ${room.id}`);
    this.server.to(room.id).emit('gameStarted');
    
    // Iniciar primera ronda
    this.startRound(room);
  }

  private startRound(room: GameRoom) {
    // Limpiar intervalo anterior si existe
    if (room.roundInterval) {
      clearInterval(room.roundInterval);
    }
    
    room.roundTimer = 60; // 1 minuto por ronda
    room.roundStartTime = Date.now();
    
    // Generar noticias para la ronda
    const news = this.generateRoundNews();
    room.currentNews = news;
    this.server.to(room.id).emit('roundStarted', {
      round: room.currentRound,
      news: news,
      timer: room.roundTimer
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
    const companies = ['TNV', 'GEC', 'HPI', 'RTM', 'FF', 'ADL'];
    const changes: any = {};
    
    // Determinar si hay evento especial (5% de probabilidad)
    const specialEvent = this.getSpecialEvent();
    
    if (specialEvent) {
      return this.applySpecialEvent(companies, specialEvent);
    }
    
    // Cambios normales basados en noticias
    companies.forEach(symbol => {
      const change = (Math.random() - 0.5) * 0.2; // -10% a +10%
      changes[symbol] = {
        oldPrice: Math.random() * 100 + 50,
        newPrice: 0,
        change: change,
        eventType: 'normal'
      };
      changes[symbol].newPrice = changes[symbol].oldPrice * (1 + change);
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

  private applySpecialEvent(companies: string[], eventType: string) {
    const changes: any = {};
    
    companies.forEach(symbol => {
      const basePrice = Math.random() * 100 + 50;
      let newPrice = basePrice;
      let newQuantity = 1000; // Cantidad base de acciones
      
      switch (eventType) {
        case 'boom':
          // Incrementa precios de todas las acciones 15-25%
          newPrice = basePrice * (1 + (Math.random() * 0.1 + 0.15));
          changes[symbol] = {
            oldPrice: basePrice,
            newPrice: newPrice,
            change: (newPrice - basePrice) / basePrice,
            eventType: 'boom',
            message: '🚀 BOOM! Todos los precios suben!'
          };
          break;
          
        case 'crash':
          // Reduce precios de todas las acciones 15-25%
          newPrice = basePrice * (1 - (Math.random() * 0.1 + 0.15));
          changes[symbol] = {
            oldPrice: basePrice,
            newPrice: newPrice,
            change: (newPrice - basePrice) / basePrice,
            eventType: 'crash',
            message: '📉 CRASH! Todos los precios bajan!'
          };
          break;
          
        case 'split':
          // Incrementa número de acciones, reduce precio proporcionalmente
          const splitRatio = 2; // Split 2:1
          newPrice = basePrice / splitRatio;
          newQuantity = 1000 * splitRatio;
          changes[symbol] = {
            oldPrice: basePrice,
            newPrice: newPrice,
            change: 0, // El valor total se mantiene igual
            eventType: 'split',
            oldQuantity: 1000,
            newQuantity: newQuantity,
            message: '📈 SPLIT! Más acciones, menor precio!'
          };
          break;
          
        case 'contraplit':
          // Reduce número de acciones, incrementa precio proporcionalmente
          const contrasplitRatio = 0.5; // Contra-split 1:2
          newPrice = basePrice / contrasplitRatio;
          newQuantity = 1000 * contrasplitRatio;
          changes[symbol] = {
            oldPrice: basePrice,
            newPrice: newPrice,
            change: 0, // El valor total se mantiene igual
            eventType: 'contraplit',
            oldQuantity: 1000,
            newQuantity: newQuantity,
            message: '📊 CONTRA-SPLIT! Menos acciones, mayor precio!'
          };
          break;
      }
    });
    
    return changes;
  }

  private calculateFinalResults(room: GameRoom) {
    // Calcular portafolios finales de cada jugador
    return room.players.map(player => ({
      playerId: player.id,
      playerName: player.name,
      finalValue: Math.random() * 20000 + 5000, // Simulado
      rank: 1
    })).sort((a, b) => b.finalValue - a.finalValue)
      .map((player, index) => ({ ...player, rank: index + 1 }));
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
