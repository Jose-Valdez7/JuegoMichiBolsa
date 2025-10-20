# 🏦 El Juego de la Bolsa - BVO Tech1

Sistema completo de simulación bursátil multijugador en tiempo real para 5 jugadores simultáneos.

## 🎯 **Características Principales**

### **🎮 Juego Multijugador**
- **5 jugadores simultáneos** por partida
- **Sala de espera** con conexión en tiempo real
- **Sincronización** via Socket.IO
- **Salas automáticas** cuando se llenan

### **📊 Mecánicas del Juego**
- **5 rondas** de 1 minuto cada una
- **$10,000 iniciales** para invertir
- **Noticias positivas/negativas** que afectan precios
- **6 empresas** de diferentes sectores
- **Renta fija y variable** disponibles
- **Fluctuaciones de precios** en tiempo real

### **💼 Funcionalidades**
- **Gráfico de barras interactivo** de acciones
- **Interfaz de trading detallada** (compra/venta)
- **Historial de transacciones** expandible
- **Portfolio en tiempo real** con efectivo y acciones
- **Resultados finales** con podium y rankings
- **Certificados** de participación descargables

## 🏗️ **Arquitectura Técnica**

### **Frontend (React + TypeScript)**
```
client/
├── src/
│   ├── components/
│   │   ├── StockChart.tsx          # Gráfico de barras interactivo
│   │   ├── TradingInterface.tsx    # Panel de trading completo
│   │   └── TransactionHistory.tsx  # Historial de transacciones
│   ├── pages/
│   │   ├── WaitingRoom.tsx         # Sala de espera multijugador
│   │   ├── GameBoard.tsx           # Tablero principal del juego
│   │   └── Results.tsx             # Resultados y rankings
│   ├── store/
│   │   ├── useAuth.ts              # Estado de autenticación
│   │   └── useGame.ts              # Estado del juego
│   ├── hooks/
│   │   └── useSocket.ts            # Hook para Socket.IO
│   └── utils/
│       └── api.ts                  # Cliente HTTP con Axios
```

### **Backend (NestJS + Prisma)**
```
server/
├── src/
│   ├── websocket/
│   │   └── ws.gateway.ts           # WebSocket para multijugador
│   ├── companies/
│   │   └── companies.module.ts     # Gestión de empresas
│   ├── portfolio/
│   │   └── portfolio.module.ts     # Gestión de portfolios
│   ├── transactions/
│   │   └── transactions.module.ts  # Historial de transacciones
│   └── auth/
│       └── auth.module.ts          # Autenticación JWT
├── prisma/
│   ├── schema.prisma               # Esquema de base de datos
│   └── seed.ts                     # Datos iniciales
```

### **Base de Datos (PostgreSQL)**
- **Users**: Usuarios del sistema
- **Companies**: Empresas y precios de acciones
- **Portfolios**: Portfolios de usuarios
- **Transactions**: Historial de transacciones
- **Games**: Partidas y rondas

## 🚀 **Instalación y Uso**

### **Desarrollo con Docker (Recomendado)**
```bash
# Clonar repositorio
git clone <repo-url>
cd el-juego-de-la-bolsa

# Construir y ejecutar con Docker
docker compose up --build

# Acceder a la aplicación
# Frontend: http://localhost:5173
# Backend API: http://localhost:3000
# Base de datos: localhost:5432
```

### **Desarrollo Local**
```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp server/.env.example server/.env
# Editar server/.env con tus configuraciones

# Ejecutar base de datos
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15

# Ejecutar migraciones
cd server && npx prisma migrate dev && npx prisma db seed

# Ejecutar en desarrollo
npm run dev
```

### **Producción**
```bash
# Build
npm run build

# Ejecutar
npm run start
```

## 🎮 **Flujo del Juego**

### **1. Inicio de Sesión**
- Usuario: `admin@example.com`
- Contraseña: `admin`
- Aceptar términos y condiciones

### **2. Sala de Espera**
- Esperar a que se conecten **5 jugadores**
- Ver contador de jugadores conectados
- **Countdown de 10 segundos** cuando esté lleno
- **Campanazo de inicio** 🔔

### **3. Rondas del Juego**
Cada ronda (1 minuto) incluye:

**a) Fase de Noticias (10 segundos)**
- **Noticia positiva** (izquierda, verde)
- **Noticia negativa** (derecha, roja)
- Analizar impacto en sectores

**b) Fase de Trading (45 segundos)**
- **Interfaz de trading** completa
- Comprar/vender acciones por cantidad
- **Renta fija** disponible ocasionalmente
- Validación de fondos y posiciones

**c) Fluctuación de Precios (5 segundos)**
- **Variación** basada en noticias
- **Verde**: precios subieron ↗
- **Rojo**: precios bajaron ↘
- Recálculo automático de portfolios

### **4. Resultados Finales**
- **Podium** para top 3 jugadores
- **Ranking completo** con valores finales
- **Certificado** de participación
- Opción de **jugar de nuevo**

## 📱 **Interfaz de Usuario**

### **Header del Juego**
```
🏦 El Juego de la Bolsa - BVO Tech1
Ronda X/5 | Tiempo: MM:SS | Controles: ⚙️🔊❓
```

### **Layout Principal**
- **Izquierda**: Renta fija (ZAIMELLA, PRONACA)
- **Centro**: Gráfico de barras de acciones
- **Derecha**: Noticias o fluctuaciones de precios

### **Panel de Trading**
```
RENTA VARIABLE    #ACC    PRECIO    COMPRAR    VENDER
TechNova (TNV)     999    $105.50      [0]       [0]
GreenEnergy (GEC)  999     $87.25      [0]       [0]
...
                    [ENVIAR]  [CANCELAR]
```

### **Portfolio Flotante**
```
Mi Portfolio
Efectivo: $8,450.00
Acciones: $1,550.00
Total:   $10,000.00
```

## 🔧 **Configuración Avanzada**

### **Variables de Entorno**
```env
# server/.env
DATABASE_URL="postgresql://postgres:postgres@db:5432/juego_bolsa"
JWT_SECRET="your-secret-key"
NODE_ENV="development"
```

### **Proxy de Vite**
```typescript
// client/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://server:3000',
      '/auth': 'http://server:3000',
      '/game': 'http://server:3000'
    }
  }
})
```

### **Socket.IO Events**
```typescript
// Eventos del cliente
socket.emit('joinWaitingRoom', { userId, userName })
socket.emit('gameTransaction', { companyId, type, quantity })

// Eventos del servidor
socket.on('playersUpdate', (players) => {...})
socket.on('roundStarted', (data) => {...})
socket.on('roundEnded', (data) => {...})
socket.on('gameFinished', (results) => {...})
```

## 🧪 **Testing**

### **Test Multijugador**
1. Abrir **5 pestañas** en `http://localhost:5173`
2. Iniciar sesión en cada una
3. Verificar que se llene la sala de espera
4. Confirmar sincronización de rondas
5. Probar transacciones simultáneas

### **Datos de Prueba**
```sql
-- 6 empresas predefinidas
TechNova (TNV) - Tecnología
GreenEnergy (GEC) - Energía  
HealthPlus (HPI) - Salud
RetailMax (RTM) - Retail
FinanceFirst (FF) - Finanzas
AutoDrive (ADL) - Tecnología
```

## 📚 **API Endpoints**

### **Autenticación**
- `POST /auth/login` - Iniciar sesión
- `POST /auth/register` - Registrar usuario

### **Juego**
- `GET /api/companies` - Obtener empresas
- `GET /api/portfolio` - Portfolio del usuario
- `POST /game/transaction` - Ejecutar transacción
- `GET /transactions/history` - Historial

### **Resultados**
- `GET /game/results` - Resultados finales
- `GET /certificate/:userId` - Certificado PDF

## 🐳 **Docker Services**

```yaml
services:
  db:        # PostgreSQL 15
  server:    # NestJS API (Puerto 3000)
  client:    # React App (Puerto 5173)
```

## 🔍 **Troubleshooting**

### **Problemas Comunes**
```bash
# Limpiar contenedores
docker compose down -v
docker compose up --build

# Resetear base de datos
docker compose exec server npx prisma migrate reset

# Ver logs
docker compose logs server
docker compose logs client
```

### **Errores de Conexión**
- Verificar que todos los servicios estén corriendo
- Confirmar proxy de Vite configurado
- Revisar variables de entorno

## 👥 **Contribución**

1. Fork del repositorio
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -m 'Agregar nueva funcionalidad'`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

## 📄 **Licencia**

Este proyecto está bajo la Licencia MIT - ver archivo [LICENSE](LICENSE) para detalles.

---

**🎯 ¡Disfruta jugando en la bolsa de valores!** 📈📉
