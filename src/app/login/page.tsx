'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { login, isAuthenticated, isAdmin } from '@/lib/auth'
import { useLanguage } from '@/lib/i18n'
import { getSettingsAsync } from '@/lib/settings'
import SakuraCanvas from '@/components/SakuraCanvas'

const RECAPTCHA_SITE_KEY = '6LftaFcsAAAAAKAtFdRCCWOCPdJ1c9kvGHqkTSAV'

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

// Inner login form component that uses reCAPTCHA hook
function LoginForm({ recaptchaEnabled }: { recaptchaEnabled: boolean }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [characterImage, setCharacterImage] = useState('')
  const [petImage, setPetImage] = useState('')
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const { t } = useLanguage()
  const { executeRecaptcha } = useGoogleReCaptcha()

  useEffect(() => {
    // Select random character and pet on mount
    const randomIndex = Math.floor(Math.random() * LOGIN_CHARACTER_IMAGES.length)
    setCharacterImage(LOGIN_CHARACTER_IMAGES[randomIndex])
    
    const randomPetIndex = Math.floor(Math.random() * PET_IMAGES.length)
    setPetImage(PET_IMAGES[randomPetIndex])
  }, [])

  // Mouse follow effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Execute reCAPTCHA v3 if enabled
      if (recaptchaEnabled && executeRecaptcha) {
        const token = await executeRecaptcha('login')
        // In a production app, you would send this token to your backend
        // to verify with Google. For now, we just check if we got a token.
        if (!token) {
          setError('驗證失敗，請重試')
          setIsLoading(false)
          return
        }
      }

      const user = login(username, password)
      
      if (user) {
        // Small delay to ensure cookie is set before redirect
        await new Promise(resolve => setTimeout(resolve, 100))
        // Redirect based on role - admin goes to admin page, user goes to main
        if (user.role === 'admin') {
          window.location.href = '/panel'
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
  }, [username, password, recaptchaEnabled, executeRecaptcha, t.login.invalidCredentials])

  return (
    <main className="min-h-screen bg-gradient-to-b from-sakura-50 to-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Sakura Effect */}
      <SakuraCanvas />
      
      {/* Mouse Following Chiikawa Pet - Hidden on mobile/touch devices */}
      {petImage && (
        <motion.div
          className="fixed pointer-events-none z-50 hidden md:block"
          style={{
            left: mousePosition.x + 15,
            top: mousePosition.y + 15,
          }}
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <motion.div
            animate={{
              y: [0, -3, 0],
              rotate: [-2, 2, -2],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Image
              src={petImage}
              alt="Pet"
              width={45}
              height={45}
              className="object-contain drop-shadow-md"
              unoptimized
            />
          </motion.div>
        </motion.div>
      )}
      
      {/* Mobile: Static pet in corner */}
      {petImage && (
        <motion.div
          className="fixed bottom-20 right-4 pointer-events-none z-40 md:hidden"
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
            className="object-contain drop-shadow-lg"
            unoptimized
          />
        </motion.div>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-medium text-gray-800">{t.login.title}</h1>
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

          {/* reCAPTCHA v3 indicator - shown above login button */}
          {recaptchaEnabled && (
            <p className="text-[10px] text-gray-400 text-center mt-4 mb-2">
              此網站受 reCAPTCHA 保護
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 bg-sakura-500 hover:bg-sakura-600 disabled:bg-sakura-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${recaptchaEnabled ? '' : 'mt-6'}`}
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

export default function LoginPage() {
  const [isChecking, setIsChecking] = useState(true)
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      // Small delay to ensure cookies are loaded
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Load reCAPTCHA setting
      try {
        const settings = await getSettingsAsync()
        setRecaptchaEnabled(settings.recaptchaEnabled || false)
      } catch (err) {
        console.warn('Failed to load settings:', err)
      }
      
      if (isAuthenticated()) {
        // Already logged in, redirect based on role
        if (isAdmin()) {
          router.replace('/panel')
        } else {
          router.replace('/main')
        }
      } else {
        setIsChecking(false)
      }
    }
    
    checkAuth()
  }, [router])

  // Show loading while checking auth
  if (isChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-sakura-50 to-white flex items-center justify-center">
        <SakuraCanvas />
        <div className="w-8 h-8 border-4 border-sakura-300 border-t-sakura-600 rounded-full animate-spin" />
      </main>
    )
  }

  // Wrap with reCAPTCHA provider if enabled
  if (recaptchaEnabled) {
    return (
      <GoogleReCaptchaProvider
        reCaptchaKey={RECAPTCHA_SITE_KEY}
        language="zh-TW"
      >
        <LoginForm recaptchaEnabled={true} />
      </GoogleReCaptchaProvider>
    )
  }

  return <LoginForm recaptchaEnabled={false} />
}
