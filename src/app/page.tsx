'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n'
import SakuraCanvas from '@/components/SakuraCanvas'

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
    <main className="h-[100dvh] bg-gradient-to-b from-sakura-50 to-white flex items-center justify-center overflow-hidden relative">
      {/* Sakura Effect */}
      <SakuraCanvas enabled={true} />
      <AnimatePresence mode="wait">
        {!isTransitioning ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="text-center px-6"
          >
            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-800 mb-4 sm:mb-6 leading-snug tracking-tight"
            >
              <span className="text-sakura-500 drop-shadow-sm">頌晞專屬</span>
              <span className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl mt-1 sm:mt-2 font-semibold">東京七日『<span className="text-sakura-500 drop-shadow-sm">極Chill</span>』慶生之旅</span>
            </motion.h1>

            {/* Decorative images */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0 }}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-sakura-200 shadow-md bg-white"
              >
                <Image
                  src="/images/draw-5a-nobg.png"
                  alt="draw-5a"
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </motion.div>
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-xl sm:text-2xl md:text-3xl text-red-400"
              >
                ❤️
              </motion.span>
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-sakura-200 shadow-md bg-white"
              >
                <Image
                  src="/images/draw-6a-nobg.png"
                  alt="draw-6a"
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </motion.div>

            {/* Enter Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEnter}
              className="px-10 py-3 sm:px-12 sm:py-3.5 bg-sakura-500 hover:bg-sakura-600 text-white rounded-full text-base sm:text-lg font-medium shadow-lg shadow-sakura-200 transition-colors"
            >
              Let&apos;s Start !!
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
            {/* Centered circular container with image - smaller */}
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
              className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-full overflow-hidden bg-white shadow-2xl"
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
              className="mt-6 sm:mt-8 text-center text-sakura-600 font-medium text-sm sm:text-base"
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
