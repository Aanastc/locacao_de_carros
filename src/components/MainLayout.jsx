import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300 pt-16">
      <Navbar />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  )
}
