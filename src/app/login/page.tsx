'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { loginAsync, isAuthenticated } from '@/lib/auth'
import { useLanguage } from '@/lib/i18n'
import { getSettingsAsync } from '@/lib/settings'
import SakuraCanvas from '@/components/SakuraCanvas'

const REMEMBER_ME_KEY = 'japan_travel_remember_me'
const REMEMBER_ME_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

const RECAPTCHA_SITE_KEY = '6LftaFcsAAAAAKAtFdRCCWOCPdJ1c9kvGHqkTSAV'

// Array of character images for login page (randomly selected)
const LOGIN_CHARACTER_IMAGES = [
  '/images/usagi-login.png',
  '/images/chii-login.png',
  '/images/hachi-login.png',
]

// Pet images for mouse follower
const PET_IMAGES = [
  '/images/chiikawa-pet.gif',
  '/images/hachiware-pet.gif',
  '/images/chii-pet.gif',
]

// Inner login form component that uses reCAPTCHA hook
function LoginForm({ recaptchaEnabled }: { recaptchaEnabled: boolean }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [characterImage, setCharacterImage] = useState('')
  const [petImage, setPetImage] = useState('')
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const autoLoginFired = useRef(false)
  const { t } = useLanguage()
  const { executeRecaptcha } = useGoogleReCaptcha()

  // Core login logic, callable with explicit credentials (for auto-login)
  const performLogin = useCallback(async (uname: string, pwd: string) => {
    setError('')
    setIsLoading(true)

    try {
      if (recaptchaEnabled && executeRecaptcha) {
        const token = await executeRecaptcha('login')
        if (!token) {
          setError('驗證失敗，請重試')
          setIsLoading(false)
          return
        }
      }

      const user = await loginAsync(uname, pwd)

      if (user) {
        await new Promise(resolve => setTimeout(resolve, 100))
        window.location.href = '/main'
      } else {
        // Saved credentials are now invalid — clear them
        localStorage.removeItem(REMEMBER_ME_KEY)
        setError(t.login.invalidCredentials)
        setIsLoading(false)
      }
    } catch (err) {
      setError('發生錯誤，請重試')
      setIsLoading(false)
    }
  }, [recaptchaEnabled, executeRecaptcha, t.login.invalidCredentials])

  useEffect(() => {
    // Select random character and pet on mount
    const randomIndex = Math.floor(Math.random() * LOGIN_CHARACTER_IMAGES.length)
    setCharacterImage(LOGIN_CHARACTER_IMAGES[randomIndex])

    const randomPetIndex = Math.floor(Math.random() * PET_IMAGES.length)
    setPetImage(PET_IMAGES[randomPetIndex])

    // Check for saved "Remember Me" credentials
    try {
      const saved = localStorage.getItem(REMEMBER_ME_KEY)
      if (saved) {
        const data = JSON.parse(saved) as { username: string; password: string; savedAt: number }
        if (Date.now() - data.savedAt < REMEMBER_ME_DURATION) {
          setUsername(data.username)
          setPassword(data.password)
          setRememberMe(true)
          // Auto-login after a short delay so the page shows briefly
          if (!autoLoginFired.current) {
            autoLoginFired.current = true
            setTimeout(() => performLogin(data.username, data.password), 600)
          }
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY)
        }
      }
    } catch {
      localStorage.removeItem(REMEMBER_ME_KEY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Persist or clear saved credentials before logging in
    if (rememberMe) {
      localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({ username, password, savedAt: Date.now() }))
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY)
    }

    await performLogin(username, password)
  }, [username, password, rememberMe, performLogin])

  return (
    <main className="h-[100dvh] bg-gradient-to-b from-sakura-50 to-white flex items-center justify-center px-4 relative overflow-hidden">
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
        <div className="text-center mb-4 sm:mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-2 sm:mb-3"
          >
            <Image
              src="/images/gonggu card_1-04-nobg.png"
              alt="Gonggu Card"
              width={200}
              height={200}
              className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 object-contain"
            />
          </motion.div>
          <h1 className="text-xl sm:text-2xl font-medium text-gray-800">{t.login.title}</h1>
        </div>

        {/* Login Form */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-sakura-100 p-5 sm:p-6"
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
                className="w-full px-4 py-2.5 sm:py-3 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none transition-all text-sm sm:text-base"
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
                className="w-full px-4 py-2.5 sm:py-3 rounded-lg border border-gray-200 focus:border-sakura-400 focus:ring-2 focus:ring-sakura-100 outline-none transition-all text-sm sm:text-base"
                placeholder="輸入密碼"
                required
              />
            </div>
          </div>

          {/* Remember Me checkbox */}
          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              role="checkbox"
              aria-checked={rememberMe}
              onClick={() => setRememberMe(v => !v)}
              className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
                rememberMe
                  ? 'bg-sakura-500 border-sakura-500'
                  : 'bg-white border-gray-300'
              }`}
            >
              {rememberMe && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span
              className="text-sm text-gray-600 cursor-pointer select-none"
              onClick={() => setRememberMe(v => !v)}
            >
              {t.login.rememberMe}
              <span className="text-xs text-gray-400 ml-1">（7天）</span>
            </span>
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
            className={`w-full py-2.5 sm:py-3 bg-sakura-500 hover:bg-sakura-600 disabled:bg-sakura-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm sm:text-base ${recaptchaEnabled ? '' : 'mt-4 sm:mt-6'}`}
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
        // Already logged in, redirect to main page
        router.replace('/main')
      } else {
        setIsChecking(false)
      }
    }
    
    checkAuth()
  }, [router])

  // Show loading while checking auth
  if (isChecking) {
    return (
      <main className="h-[100dvh] bg-gradient-to-b from-sakura-50 to-white flex items-center justify-center">
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
