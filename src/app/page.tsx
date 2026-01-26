'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n'

export default function LandingPage() {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  const handleEnter = () => {
    setIsTransitioning(true)
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sakura-50 to-white flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {!isTransitioning ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="text-center px-4"
          >
            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl md:text-6xl font-light text-gray-800 mb-4"
            >
              <span className="text-sakura-500">日本</span>旅遊
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-gray-500 mb-8 text-lg"
            >
              {t.landing.subtitle}
            </motion.p>

            {/* Decorative sakura */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="flex justify-center gap-2 mb-8"
            >
              {['🌸', '✿', '🌸'].map((emoji, i) => (
                <motion.span
                  key={i}
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  className="text-2xl"
                >
                  {emoji}
                </motion.span>
              ))}
            </motion.div>

            {/* Enter Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEnter}
              className="px-12 py-4 bg-sakura-500 hover:bg-sakura-600 text-white rounded-full text-lg font-medium shadow-lg shadow-sakura-200 transition-colors"
            >
              {t.landing.enter}
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="transition"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center bg-sakura-50 z-50"
          >
            {/* Centered circular container with image - 25% smaller */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{
                scale: [0, 1, 1.05],
              }}
              transition={{
                duration: 2.5,
                times: [0, 0.6, 1],
                ease: 'easeInOut',
              }}
              className="w-48 h-48 md:w-60 md:h-60 rounded-full overflow-hidden bg-white shadow-2xl"
            >
              <Image
                src="/images/chiikawa-transition.png"
                alt="Chiikawa"
                width={400}
                height={400}
                className="w-full h-full object-cover"
                priority
              />
            </motion.div>

            {/* Loading text - below the circle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="mt-8 text-center text-sakura-600 font-medium"
            >
              {t.landing.loading}
            </motion.p>

            {/* Copyright in loading page */}
            <div className="fixed bottom-4 left-0 right-0 text-center pointer-events-none">
              <p className="text-xs text-gray-400/60">
                ©RACFONG CO., LTD.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-32 h-32 rounded-full bg-sakura-100/30"
            animate={{
              x: [0, Math.random() * 100 - 50],
              y: [0, Math.random() * 100 - 50],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      {/* Copyright */}
      <div className="fixed bottom-4 left-0 right-0 text-center pointer-events-none z-10">
        <p className="text-xs text-gray-400/60">
          ©RACFONG CO., LTD.
        </p>
      </div>
    </main>
  )
}
