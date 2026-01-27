declare module 'react-google-recaptcha' {
  import * as React from 'react'

  export interface ReCAPTCHAProps {
    sitekey: string
    onChange?: (token: string | null) => void
    onExpired?: () => void
    onErrored?: () => void
    theme?: 'light' | 'dark'
    size?: 'compact' | 'normal' | 'invisible'
    tabindex?: number
    hl?: string
    badge?: 'bottomright' | 'bottomleft' | 'inline'
  }

  export default class ReCAPTCHA extends React.Component<ReCAPTCHAProps> {
    reset(): void
    execute(): void
    executeAsync(): Promise<string>
    getValue(): string | null
  }
}

declare module 'react-google-recaptcha-v3' {
  import * as React from 'react'

  export interface GoogleReCaptchaProviderProps {
    reCaptchaKey: string
    language?: string
    useRecaptchaNet?: boolean
    useEnterprise?: boolean
    scriptProps?: {
      nonce?: string
      defer?: boolean
      async?: boolean
      appendTo?: 'head' | 'body'
      id?: string
    }
    container?: {
      element?: string | HTMLElement
      parameters?: {
        badge?: 'bottomright' | 'bottomleft' | 'inline'
        theme?: 'light' | 'dark'
      }
    }
    children: React.ReactNode
  }

  export const GoogleReCaptchaProvider: React.FC<GoogleReCaptchaProviderProps>

  export interface UseGoogleReCaptchaReturn {
    executeRecaptcha?: (action?: string) => Promise<string>
  }

  export function useGoogleReCaptcha(): UseGoogleReCaptchaReturn
}
