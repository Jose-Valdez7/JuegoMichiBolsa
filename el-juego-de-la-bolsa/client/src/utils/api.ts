import axios from 'axios'

const baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000'

export const api = axios.create({
  baseURL,
  withCredentials: true,
})

export function setAuth(token: string | null) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  else delete api.defaults.headers.common['Authorization']
}
