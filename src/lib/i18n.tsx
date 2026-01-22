'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Language = 'zh-TW' | 'en' | 'ja'

interface Translations {
  // Landing
  landing: {
    title: string
    subtitle: string
    enter: string
    explore: string
    loading: string
  }
  // Main page
  main: {
    destinations: string
    noTrips: string
    addFromAdmin: string
    sakuraMode: string
    normalMode: string
  }
  // Admin
  admin: {
    dashboard: string
    manageTrips: string
    addTrip: string
    editTrip: string
    viewSite: string
    logout: string
    noTripsYet: string
    clickToCreate: string
    title: string
    date: string
    location: string
    latitude: string
    longitude: string
    description: string
    cancel: string
    create: string
    update: string
    delete: string
    confirmDelete: string
    language: string
  }
  // Login
  login: {
    title: string
    subtitle: string
    username: string
    password: string
    signIn: string
    signingIn: string
    backToMain: string
    invalidCredentials: string
  }
  // Travel Notice
  notice: {
    title: string
    essentials: string
    preparations: string
    showOnce: string
    gotIt: string
    items: {
      passport: string
      money: string
      sim: string
      adapter: string
      medicine: string
      luggage: string
    }
    prep: {
      jrPass: string
      hotel: string
      maps: string
      weather: string
    }
  }
}

const translations: Record<Language, Translations> = {
  'zh-TW': {
    landing: {
      title: '日本旅遊',
      subtitle: '探索日本之美',
      enter: '進入',
      explore: '點擊開始探索日本',
      loading: '正在載入您的旅程...',
    },
    main: {
      destinations: '目的地',
      noTrips: '尚無行程',
      addFromAdmin: '從管理面板新增行程',
      sakuraMode: '櫻花',
      normalMode: '一般',
    },
    admin: {
      dashboard: '管理面板',
      manageTrips: '管理行程',
      addTrip: '新增行程',
      editTrip: '編輯行程',
      viewSite: '查看網站',
      logout: '登出',
      noTripsYet: '尚無行程',
      clickToCreate: '點擊「新增行程」建立您的第一個目的地',
      title: '標題',
      date: '日期',
      location: '地點',
      latitude: '緯度',
      longitude: '經度',
      description: '描述',
      cancel: '取消',
      create: '建立行程',
      update: '更新行程',
      delete: '刪除',
      confirmDelete: '確定要刪除此行程嗎？',
      language: '語言',
    },
    login: {
      title: '管理員登入',
      subtitle: '登入以管理行程',
      username: '使用者名稱',
      password: '密碼',
      signIn: '登入',
      signingIn: '登入中...',
      backToMain: '← 返回主頁',
      invalidCredentials: '使用者名稱或密碼錯誤',
    },
    notice: {
      title: '旅遊須知',
      essentials: '必備物品',
      preparations: '出發前準備',
      showOnce: '此提示每24小時顯示一次',
      gotIt: '知道了！',
      items: {
        passport: '護照及簽證文件',
        money: '日圓現金及信用卡',
        sim: 'SIM卡或WiFi蛋',
        adapter: '日本規格轉換插頭',
        medicine: '常備藥物',
        luggage: '輕便行李箱',
      },
      prep: {
        jrPass: '購買JR Pass或交通卡',
        hotel: '確認酒店預訂',
        maps: '下載離線地圖',
        weather: '查看天氣預報',
      },
    },
  },
  en: {
    landing: {
      title: 'Japan Travel',
      subtitle: 'Discover the beauty of Japan',
      enter: 'Enter',
      explore: 'Click to explore Japan',
      loading: 'Loading your journey...',
    },
    main: {
      destinations: 'Destinations',
      noTrips: 'No trips yet',
      addFromAdmin: 'Add trips from the admin panel',
      sakuraMode: 'Sakura',
      normalMode: 'Normal',
    },
    admin: {
      dashboard: 'Admin Dashboard',
      manageTrips: 'Manage Trips',
      addTrip: 'Add Trip',
      editTrip: 'Edit Trip',
      viewSite: 'View Site',
      logout: 'Logout',
      noTripsYet: 'No trips yet',
      clickToCreate: 'Click "Add Trip" to create your first destination',
      title: 'Title',
      date: 'Date',
      location: 'Location',
      latitude: 'Latitude',
      longitude: 'Longitude',
      description: 'Description',
      cancel: 'Cancel',
      create: 'Create Trip',
      update: 'Update Trip',
      delete: 'Delete',
      confirmDelete: 'Are you sure you want to delete this trip?',
      language: 'Language',
    },
    login: {
      title: 'Admin Login',
      subtitle: 'Sign in to manage trips',
      username: 'Username',
      password: 'Password',
      signIn: 'Sign In',
      signingIn: 'Signing in...',
      backToMain: '← Back to main page',
      invalidCredentials: 'Invalid username or password',
    },
    notice: {
      title: 'Travel Notice',
      essentials: 'Essential Items',
      preparations: 'Pre-departure Preparations',
      showOnce: 'This notice appears once every 24 hours',
      gotIt: 'Got it!',
      items: {
        passport: 'Passport and visa documents',
        money: 'Japanese Yen and credit cards',
        sim: 'SIM card or pocket WiFi',
        adapter: 'Japan-spec power adapter',
        medicine: 'Regular medications',
        luggage: 'Light luggage',
      },
      prep: {
        jrPass: 'Purchase JR Pass or transport card',
        hotel: 'Confirm hotel booking',
        maps: 'Download offline maps',
        weather: 'Check weather forecast',
      },
    },
  },
  ja: {
    landing: {
      title: '日本旅行',
      subtitle: '日本の美しさを発見',
      enter: '入る',
      explore: 'クリックして日本を探索',
      loading: '旅を読み込み中...',
    },
    main: {
      destinations: '目的地',
      noTrips: '旅行はまだありません',
      addFromAdmin: '管理パネルから旅行を追加',
      sakuraMode: '桜',
      normalMode: '通常',
    },
    admin: {
      dashboard: '管理ダッシュボード',
      manageTrips: '旅行を管理',
      addTrip: '旅行を追加',
      editTrip: '旅行を編集',
      viewSite: 'サイトを見る',
      logout: 'ログアウト',
      noTripsYet: '旅行はまだありません',
      clickToCreate: '「旅行を追加」をクリックして最初の目的地を作成',
      title: 'タイトル',
      date: '日付',
      location: '場所',
      latitude: '緯度',
      longitude: '経度',
      description: '説明',
      cancel: 'キャンセル',
      create: '旅行を作成',
      update: '旅行を更新',
      delete: '削除',
      confirmDelete: 'この旅行を削除してもよろしいですか？',
      language: '言語',
    },
    login: {
      title: '管理者ログイン',
      subtitle: 'ログインして旅行を管理',
      username: 'ユーザー名',
      password: 'パスワード',
      signIn: 'ログイン',
      signingIn: 'ログイン中...',
      backToMain: '← メインページに戻る',
      invalidCredentials: 'ユーザー名またはパスワードが無効です',
    },
    notice: {
      title: '旅行のお知らせ',
      essentials: '必需品',
      preparations: '出発前の準備',
      showOnce: 'このお知らせは24時間ごとに表示されます',
      gotIt: 'わかりました！',
      items: {
        passport: 'パスポートとビザ書類',
        money: '日本円とクレジットカード',
        sim: 'SIMカードまたはポケットWiFi',
        adapter: '日本仕様の電源アダプター',
        medicine: '常備薬',
        luggage: '軽量スーツケース',
      },
      prep: {
        jrPass: 'JRパスまたは交通カードを購入',
        hotel: 'ホテル予約を確認',
        maps: 'オフラインマップをダウンロード',
        weather: '天気予報を確認',
      },
    },
  },
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('zh-TW')

  useEffect(() => {
    const saved = localStorage.getItem('app_language') as Language
    if (saved && translations[saved]) {
      setLanguage(saved)
    }
  }, [])

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('app_language', lang)
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: handleSetLanguage,
        t: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export const languageNames: Record<Language, string> = {
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
}
