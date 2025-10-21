import { Routes, Route, Navigate } from 'react-router-dom'
import Lobby from './Lobby'
import WaitingRoom from './WaitingRoom'
import GameBoard from './GameBoard'
import Transactions from './Transactions'
import Results from './Results'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/waiting" element={<WaitingRoom />} />
      <Route path="/game" element={<GameBoard />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/results" element={<Results />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
