'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { login, isAuthenticated, isAdmin, getCurrentUser } from '@/lib/auth'
import { useLanguage } from '@/lib/i18n'
import SakuraCanvas from '@/components/SakuraCanvas'

// Array of character images for login page (randomly selected)
const LOGIN_CHARACTER_IMAGES = [
  '/images/usagi-login.png',
  '/images/chii-login.png',
  '/images/hachi-login.png',
]

// Pet images for mouse follower
const PET_IMAGES = [
  '/images/chiikawa-pet.png',
  '/images/hachiware-pet.png',
  '/images/chii-pet.png',
]

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [characterImage, setCharacterImage] = useState('')
  const [petImage, setPetImage] = useState('')
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    // Select random character and pet on mount
    const randomIndex = Math.floor(Math.random() * LOGIN_CHARACTER_IMAGES.length)
    setCharacterImage(LOGIN_CHARACTER_IMAGES[randomIndex])
    
    const randomPetIndex = Math.floor(Math.random() * PET_IMAGES.length)
    setPetImage(PET_IMAGES[randomPetIndex])
    
    // Check if already authenticated and redirect
    const checkAuth = async () => {
      // Small delay to ensure cookies are loaded
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (isAuthenticated()) {
        // Already logged in, redirect based on role
        if (isAdmin()) {
          router.replace('/admin')
        } else {
          router.replace('/main')
        }
        // Keep isChecking true to prevent flash of login form
      } else {
        // Not logged in, show login form
        setIsChecking(false)
      }
    }
    
    checkAuth()
  }, [router])

  // Mouse follow effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const user = login(username, password)
      
      if (user) {
        // Small delay to ensure cookie is set before redirect
        await new Promise(resolve => setTimeout(resolve, 100))
        // Redirect based on role - admin goes to admin page, user goes to main
        if (user.role === 'admin') {
          window.location.href = '/admin'
        } else {
          window.location.href = '/main'
        }
      } else {
        setError(t.login.invalidCredentials)
        setIsLoading(false)
      }
    } catch (err) {
      setError('發生錯誤，請重試')
      setIsLoading(false)
    }
  }

  // Show loading while checking auth
  if (isChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-sakura-50 to-white flex items-center justify-center">
        <SakuraCanvas />
        <div className="w-8 h-8 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sakura-50 to-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Sakura Effect */}
      <SakuraCanvas />
      
      {/* Mouse Following Chiikawa Pet */}
      {petImage && (
        <motion.div
          className="fixed pointer-events-none z-50"
          animate={{
            x: mousePosition.x + 20,
            y: mousePosition.y + 20,
          }}
          transition={{
            type: 'spring',
            damping: 20,
            stiffness: 200,
            mass: 0.5,
          }}
        >
          <motion.div
            animate={{
              y: [0, -5, 0],
              rotate: [-3, 3, -3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Image
              src={petImage}
              alt="Pet"
              width={50}
              height={50}
              className="object-contain drop-shadow-md"
              unoptimized
            />
          </motion.div>
        </motion.div>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-24 h-24 mx-auto mb-4 relative"
          >
            {characterImage && (
              <Image
                src={characterImage}
                alt="Character"
                fill
                className="object-contain"
                priority
                unoptimized
              />
            )}
          </motion.div>
          <h1 className="text-2xl font-medium text-gray-800">{t.login.title}</h1>
          <p className="text-gray-500 mt-2">{t.login.subtitle}</p>
        </div>

        {/* Login Form */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-sakura-100 p-6"
        >
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.login.username}
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none transition-all"
                placeholder="輸入使用者名稱"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.login.password}
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none transition-all"
                placeholder="輸入密碼"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 py-3 bg-sakura-500 hover:bg-sakura-600 disabled:bg-sakura-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t.login.signingIn}
              </>
            ) : (
              t.login.signIn
            )}
          </button>
        </motion.form>

        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-6"
        >
          <a
            href="/main"
            className="text-sakura-500 hover:text-sakura-600 text-sm"
          >
            {t.login.backToMain}
          </a>
        </motion.div>
      </motion.div>
      
      {/* Copyright */}
      <div className="fixed bottom-4 left-0 right-0 text-center">
        <p className="text-xs text-gray-400">
          ©RACFONG CO., LTD.
        </p>
      </div>
    </main>
  )
}
