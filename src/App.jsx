import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import VerifyEmail from './pages/VerifyEmail'
import CarDetails from './pages/CarDetails'
import Profile from './pages/Profile'
import Home from './pages/Home'
import { ThemeProvider } from './context/ThemeContext'
import { ErrorBoundary } from './components/ErrorBoundary'

// Componente para proteger rotas
function PrivateRoute({ children }) {
  const { user } = useAuth()
  
  if (!user) {
    return <Navigate to="/" replace />
  }
  
  return children
}

// Redirecionar usuário logado para dashboard
function PublicRoute({ children }) {
  const { user } = useAuth()
  
  if (user) {
    return <Navigate to="/dashboard" replace />
  }
  
  return children
}

import Cars from './pages/Cars'
import Reports from './pages/Reports'
import MainLayout from './components/MainLayout'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <Register />
        </PublicRoute>
      } />
      <Route path="/verify-email" element={
        <PublicRoute>
          <VerifyEmail />
        </PublicRoute>
      } />
      
      {/* Protected Routes with MainLayout */}
      <Route element={
        <PrivateRoute>
          <MainLayout />
        </PrivateRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/cars" element={<Cars />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/car/:plate" element={<CarDetails />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  )
}



function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export default App
