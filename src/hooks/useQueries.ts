'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  type Trip,
  getSupabaseWishlistItems,
  saveSupabaseWishlistItem,
  updateSupabaseWishlistItem,
  deleteSupabaseWishlistItem,
  type WishlistItemDB,
  getSupabaseChecklistStates,
  saveSupabaseChecklistState,
  type ChecklistStateDB,
  getSupabaseDestinations,
  saveSupabaseDestination,
  deleteSupabaseDestination,
  type DestinationDB,
  getSupabaseExpenses,
  createSupabaseExpense,
  updateSupabaseExpense,
  deleteSupabaseExpense,
  type ExpenseDB,
  type ExpenseCategory,
  getSupabaseWalletSettings,
  saveSupabaseWalletSettings,
  type WalletSettingsDB,
  getSupabaseUsers,
  saveSupabaseUser,
  deleteSupabaseUser,
  type UserDB,
} from '@/lib/supabase'
import { getSettingsAsync, saveSettingsAsync, type SiteSettings } from '@/lib/settings'

// ============================================
// Query Keys
// ============================================
export const queryKeys = {
  trips: ['trips'] as const,
  settings: ['settings'] as const,
  wishlistItems: ['wishlistItems'] as const,
  checklistStates: ['checklistStates'] as const,
  users: ['users'] as const,
  destinations: ['destinations'] as const,
  expenses: (type: 'personal' | 'shared', username?: string) =>
    ['expenses', type, username] as const,
  walletSettings: ['walletSettings'] as const,
}

// ============================================
// Trips
// ============================================

export function useTrips(options?: { refetchInterval?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.trips,
    queryFn: getTrips,
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  })
}

export function useCreateTrip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (trip: Omit<Trip, 'id' | 'created_at' | 'updated_at'>) => createTrip(trip),
    onSuccess: (result) => {
      if (result.data) {
        queryClient.invalidateQueries({ queryKey: queryKeys.trips })
      }
    },
  })
}

export function useUpdateTrip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, trip }: { id: number; trip: Partial<Trip> }) => updateTrip(id, trip),
    onSuccess: (result) => {
      if (result.data) {
        queryClient.invalidateQueries({ queryKey: queryKeys.trips })
      }
    },
  })
}

export function useDeleteTrip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteTrip(id),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.trips })
      }
    },
  })
}

// ============================================
// Site Settings
// ============================================

export function useSettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: getSettingsAsync,
    enabled: options?.enabled,
  })
}

export function useSaveSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settings: Partial<SiteSettings>) => saveSettingsAsync(settings),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.settings })
      }
    },
  })
}

// ============================================
// Wishlist Items
// ============================================

export function useWishlistItems(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.wishlistItems,
    queryFn: getSupabaseWishlistItems,
    enabled: options?.enabled,
  })
}

export function useSaveWishlistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (item: Omit<WishlistItemDB, 'id' | 'created_at'>) =>
      saveSupabaseWishlistItem(item),
    onSuccess: (result) => {
      if (result.data) {
        queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
      }
    },
  })
}

export function useUpdateWishlistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      item,
    }: {
      id: number
      item: Partial<Omit<WishlistItemDB, 'id' | 'created_at'>>
    }) => updateSupabaseWishlistItem(id, item),
    onSuccess: (result) => {
      if (result.data) {
        queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
      }
    },
  })
}

export function useDeleteWishlistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteSupabaseWishlistItem(id),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.wishlistItems })
      }
    },
  })
}

// ============================================
// Checklist States
// ============================================

export function useChecklistStates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.checklistStates,
    queryFn: getSupabaseChecklistStates,
    enabled: options?.enabled,
  })
}

export function useSaveChecklistState() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (state: ChecklistStateDB) => saveSupabaseChecklistState(state),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.checklistStates })
      }
    },
  })
}

// ============================================
// Users
// ============================================

export function useSupabaseUsers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: getSupabaseUsers,
    enabled: options?.enabled,
  })
}

export function useSaveUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      user,
      originalUsername,
    }: {
      user: Omit<UserDB, 'id' | 'created_at'>
      originalUsername?: string
    }) => saveSupabaseUser(user, originalUsername),
    onSuccess: (result) => {
      if (result.data) {
        queryClient.invalidateQueries({ queryKey: queryKeys.users })
      }
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (username: string) => deleteSupabaseUser(username),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.users })
      }
    },
  })
}

// ============================================
// Destinations
// ============================================

export function useDestinations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.destinations,
    queryFn: getSupabaseDestinations,
    enabled: options?.enabled,
  })
}

export function useSaveDestination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (destination: Omit<DestinationDB, 'created_at' | 'updated_at'>) =>
      saveSupabaseDestination(destination),
    onSuccess: (result) => {
      if (result.data) {
        queryClient.invalidateQueries({ queryKey: queryKeys.destinations })
      }
    },
  })
}

export function useDeleteDestination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteSupabaseDestination(id),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.destinations })
      }
    },
  })
}

// ============================================
// Expenses
// ============================================

export function useExpenses(
  type: 'personal' | 'shared',
  username?: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.expenses(type, username),
    queryFn: () => getSupabaseExpenses(type, username),
    enabled: options?.enabled,
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (expense: Omit<ExpenseDB, 'id' | 'created_at'>) =>
      createSupabaseExpense(expense),
    onSuccess: (result) => {
      if (result.data) {
        // Invalidate all expense queries
        queryClient.invalidateQueries({ queryKey: ['expenses'] })
      }
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      expense,
    }: {
      id: number
      expense: Partial<Omit<ExpenseDB, 'id' | 'created_at'>>
    }) => updateSupabaseExpense(id, expense),
    onSuccess: (result) => {
      if (result.data) {
        queryClient.invalidateQueries({ queryKey: ['expenses'] })
      }
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteSupabaseExpense(id),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['expenses'] })
      }
    },
  })
}

// ============================================
// Wallet Settings
// ============================================

export function useWalletSettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.walletSettings,
    queryFn: getSupabaseWalletSettings,
    enabled: options?.enabled,
  })
}

export function useSaveWalletSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settings: Partial<Omit<WalletSettingsDB, 'id' | 'updated_at'>>) =>
      saveSupabaseWalletSettings(settings),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.walletSettings })
      }
    },
  })
}
