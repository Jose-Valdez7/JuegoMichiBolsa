import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login'
import WaitingRoom from './WaitingRoom'
import GameBoard from './GameBoard'
import Transactions from './Transactions'
import Results from './Results'
import { useAuth } from '../store/useAuth'

export default function App() {
  const { token } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/waiting" element={token ? <WaitingRoom /> : <Navigate to="/login" />} />
      <Route path="/game" element={token ? <GameBoard /> : <Navigate to="/login" />} />
      <Route path="/transactions" element={token ? <Transactions /> : <Navigate to="/login" />} />
      <Route path="/results" element={token ? <Results /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}
