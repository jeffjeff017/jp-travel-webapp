'use client'

import WishlistButton from '@/components/WishlistButton'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function ProfileWishlistPopup({ isOpen, onClose }: Props) {
  return (
    <WishlistButton
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    />
  )
}
