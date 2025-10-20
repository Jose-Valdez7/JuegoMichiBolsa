import { create } from 'zustand'
import { api } from '../utils/api'

interface News { 
  id: number
  title: string
  type: 'POSITIVE' | 'NEGATIVE' | 'SURPRISE'
  effect: string
}

interface GameState {
  round: number
  timer: number
  news: News[]
  ranking: Array<{ userId: number; name: string; totalValue: number }>
  gameId: number | null
  startGame: () => Promise<void>
  fetchNews: () => Promise<void>
  fetchRanking: () => Promise<void>
  setTimer: (seconds: number) => void
  setRound: (round: number) => void
}

export const useGame = create<GameState>((set, get) => ({
  round: 0,
  timer: 60,
  news: [],
  ranking: [],
  gameId: null,
  
  async startGame() {
    try {
      const { data } = await api.get('/game/start')
      set({ gameId: data.gameId })
    } catch (error) {
      console.error('Error starting game:', error)
    }
  },
  
  async fetchNews() {
    try {
      const { data } = await api.get('/game/news')
      set({ news: data })
    } catch (error) {
      console.error('Error fetching news:', error)
    }
  },
  
  async fetchRanking() {
    try {
      const { data } = await api.get('/game/results')
      set({ ranking: data })
    } catch (error) {
      console.error('Error fetching ranking:', error)
    }
  },
  
  setTimer: (seconds: number) => set({ timer: seconds }),
  setRound: (round: number) => set({ round }),
}))
