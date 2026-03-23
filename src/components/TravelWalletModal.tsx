'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import {
  saveSupabaseWalletSettings,
  createSupabaseExpense,
  updateSupabaseExpense,
  deleteSupabaseExpense,
  EXPENSE_CATEGORIES,
  type ExpenseDB,
  type ExpenseCategory,
  type WalletSettingsDB,
} from '@/lib/supabase'
import { getCurrentUser, getUsersAsync, type User } from '@/lib/auth'
import { useWalletSettings, useExpenses, queryKeys } from '@/hooks/useQueries'

export type TravelWalletCloseReason = { dataChanged?: boolean }

export type TravelWalletModalProps = {
  open: boolean
  onClose: (reason?: TravelWalletCloseReason) => void
  /** Accent for avatars / bars (destination theme) */
  themeColor?: string
  /** Can edit/delete others' shared expenses */
  isAdminUser?: boolean
  /** Optional toast (e.g. panel top banner); otherwise alert on error */
  onNotify?: (msg: { type: 'success' | 'error'; text: string }) => void
}

export default function TravelWalletModal({
  open,
  onClose,
  themeColor = '#F472B6',
  isAdminUser = false,
  onNotify,
}: TravelWalletModalProps) {
  const queryClient = useQueryClient()
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getCurrentUser>>(null)
  const [personalUsername, setPersonalUsername] = useState<string | undefined>(undefined)

  const { data: walletSettingsData } = useWalletSettings({ enabled: open })
  const { data: sharedExpensesData = [] } = useExpenses('shared', undefined, { enabled: open })
  const { data: personalExpensesData = [] } = useExpenses('personal', personalUsername, {
    enabled: open && !!personalUsername,
  })

  const [walletTab, setWalletTab] = useState<'personal' | 'shared'>('shared')
  const [walletSettings, setWalletSettings] = useState<WalletSettingsDB | null>(null)
  const [sharedExpenses, setSharedExpenses] = useState<ExpenseDB[]>([])
  const [personalExpenses, setPersonalExpenses] = useState<ExpenseDB[]>([])
  const [walletDirty, setWalletDirty] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseDB | null>(null)
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: 'food' as ExpenseCategory,
    note: '',
  })
  const [budgetForm, setBudgetForm] = useState({ amount: '' })
  const [showBudgetForm, setShowBudgetForm] = useState(false)

  const notify = useCallback(
    (msg: { type: 'success' | 'error'; text: string }) => {
      if (onNotify) onNotify(msg)
      else if (msg.type === 'error') alert(msg.text)
    },
    [onNotify]
  )

  useEffect(() => {
    if (!open) return
    setCurrentUser(getCurrentUser())
    const u = getCurrentUser()?.username
    setPersonalUsername(u)
    getUsersAsync()
      .then(setUsers)
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (walletSettingsData) {
      setWalletSettings(walletSettingsData)
      setBudgetForm({ amount: walletSettingsData.shared_budget.toString() })
    }
  }, [walletSettingsData])

  useEffect(() => {
    setPersonalExpenses(personalExpensesData)
  }, [personalExpensesData])

  useEffect(() => {
    setSharedExpenses(sharedExpensesData)
  }, [sharedExpensesData])

  const getUserAvatarUrl = (username: string, fallbackAvatarUrl?: string): string | undefined => {
    const userObj = users.find(u => u.username === username)
    return userObj?.avatarUrl || fallbackAvatarUrl || undefined
  }

  const handleClose = () => {
    setShowExpenseForm(false)
    setEditingExpense(null)
    setExpenseForm({ amount: '', category: 'food', note: '' })
    const changed = walletDirty
    setWalletDirty(false)
    onClose({ dataChanged: changed })
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[65] p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleClose()
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 md:p-5 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-800">💰 旅行錢包</h3>
                  <button
                    type="button"
                    onClick={() => handleClose()}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWalletTab('shared')}
                    className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition-colors ${
                      walletTab === 'shared'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    👥 共同支出
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletTab('personal')}
                    className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition-colors ${
                      walletTab === 'personal'
                        ? 'bg-gradient-to-r from-blue-400 to-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    👤 個人支出
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {walletTab === 'shared' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">預算</span>
                        <button
                          type="button"
                          onClick={() => setShowBudgetForm(!showBudgetForm)}
                          className="text-xs text-amber-600 hover:underline"
                        >
                          {showBudgetForm ? '取消' : '設定'}
                        </button>
                      </div>

                      {showBudgetForm ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={budgetForm.amount}
                            onChange={(e) => setBudgetForm({ amount: e.target.value })}
                            placeholder="輸入預算金額"
                            className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg focus:border-amber-400 outline-none"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const amount = parseFloat(budgetForm.amount) || 0
                              const result = await saveSupabaseWalletSettings({ shared_budget: amount, currency: 'JPY' })
                              if (!result.success) {
                                notify({ type: 'error', text: `預算儲存失敗：${result.error || '未知錯誤'}` })
                                return
                              }
                              await queryClient.invalidateQueries({ queryKey: queryKeys.walletSettings })
                              setShowBudgetForm(false)
                              notify({ type: 'success', text: '預算已更新！' })
                              setWalletDirty(true)
                            }}
                            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                          >
                            儲存
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="text-2xl font-bold text-gray-800">
                            ¥{(walletSettings?.shared_budget || 0).toLocaleString()}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm text-gray-500">已使用</span>
                            <span className="text-sm font-medium text-orange-600">
                              ¥{sharedExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                            </span>
                          </div>
                          {(() => {
                            const remaining =
                              (walletSettings?.shared_budget || 0) -
                              sharedExpenses.reduce((sum, e) => sum + e.amount, 0)
                            return (
                              <div
                                className={`text-lg font-bold mt-1 ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}
                              >
                                餘額: ¥{remaining.toLocaleString()}
                              </div>
                            )
                          })()}
                        </>
                      )}
                    </div>

                    {sharedExpenses.length > 0 &&
                      (() => {
                        const perPerson = new Map<
                          string,
                          { username: string; displayName: string; avatarUrl?: string; total: number }
                        >()
                        sharedExpenses.forEach((expense) => {
                          const existing = perPerson.get(expense.username)
                          if (existing) {
                            existing.total += expense.amount
                          } else {
                            perPerson.set(expense.username, {
                              username: expense.username,
                              displayName: expense.display_name,
                              avatarUrl: getUserAvatarUrl(expense.username, expense.avatar_url || undefined),
                              total: expense.amount,
                            })
                          }
                        })
                        const people = Array.from(perPerson.values()).sort((a, b) => b.total - a.total)
                        const grandTotal = sharedExpenses.reduce((sum, e) => sum + e.amount, 0)
                        const avgPerPerson = people.length > 0 ? grandTotal / people.length : 0

                        return (
                          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">👥 各人支出總計</h4>
                              <span className="text-[10px] text-gray-400">人均 ¥{Math.round(avgPerPerson).toLocaleString()}</span>
                            </div>
                            <div className="px-3 pb-3 space-y-1.5">
                              {people.map((person) => {
                                const pct = grandTotal > 0 ? (person.total / grandTotal) * 100 : 0
                                return (
                                  <div
                                    key={person.username}
                                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                                  >
                                    {person.avatarUrl ? (
                                      <img
                                        src={person.avatarUrl}
                                        alt=""
                                        className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"
                                      />
                                    ) : (
                                      <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shadow-sm flex-shrink-0"
                                        style={{ backgroundColor: themeColor }}
                                      >
                                        {person.displayName.charAt(0)}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-gray-800 truncate">{person.displayName}</span>
                                        <span className="text-sm font-semibold text-gray-800 ml-2 flex-shrink-0">
                                          ¥{person.total.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all duration-500"
                                          style={{
                                            width: `${Math.min(pct, 100)}%`,
                                            backgroundColor: themeColor,
                                            opacity: 0.7 + (pct / 100) * 0.3,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            {people.length === 2 && (
                              <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100">
                                {(() => {
                                  const [a, b] = people
                                  const diff = Math.abs(a.total - b.total)
                                  const half = Math.round(diff / 2)
                                  if (half === 0)
                                    return <p className="text-xs text-amber-700 text-center">✅ 雙方支出相同，無需補差額</p>
                                  const payer = a.total > b.total ? a : b
                                  const receiver = a.total > b.total ? b : a
                                  return (
                                    <p className="text-xs text-amber-700 text-center">
                                      💡 <span className="font-medium">{receiver.displayName}</span> 需付{' '}
                                      <span className="font-bold">¥{half.toLocaleString()}</span> 給{' '}
                                      <span className="font-medium">{payer.displayName}</span>
                                    </p>
                                  )
                                })()}
                              </div>
                            )}
                            {people.length > 2 && (
                              <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100">
                                <div className="space-y-1">
                                  {(() => {
                                    const balances = people.map((p) => ({
                                      ...p,
                                      balance: p.total - avgPerPerson,
                                    }))
                                    const creditors = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance)
                                    const debtors = balances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance)
                                    const settlements: { from: string; to: string; amount: number }[] = []
                                    let ci = 0,
                                      di = 0
                                    const creds = creditors.map((c) => ({ ...c }))
                                    const debts = debtors.map((d) => ({ ...d, balance: Math.abs(d.balance) }))
                                    while (ci < creds.length && di < debts.length) {
                                      const amount = Math.min(creds[ci].balance, debts[di].balance)
                                      if (Math.round(amount) > 0) {
                                        settlements.push({
                                          from: debts[di].displayName,
                                          to: creds[ci].displayName,
                                          amount: Math.round(amount),
                                        })
                                      }
                                      creds[ci].balance -= amount
                                      debts[di].balance -= amount
                                      if (creds[ci].balance < 1) ci++
                                      if (debts[di].balance < 1) di++
                                    }
                                    if (settlements.length === 0) {
                                      return <p className="text-xs text-amber-700 text-center">✅ 各人支出相同，無需補差額</p>
                                    }
                                    return settlements.map((s, i) => (
                                      <p key={i} className="text-xs text-amber-700 text-center">
                                        💡 <span className="font-medium">{s.from}</span> 需付{' '}
                                        <span className="font-bold">¥{s.amount.toLocaleString()}</span> 給{' '}
                                        <span className="font-medium">{s.to}</span>
                                      </p>
                                    ))
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                    <div className="space-y-2">
                      {sharedExpenses.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">尚無共同支出記錄</p>
                      ) : (
                        sharedExpenses.map((expense) => {
                          const category = EXPENSE_CATEGORIES.find((c) => c.id === expense.category)
                          const avatarUrl = getUserAvatarUrl(expense.username, expense.avatar_url || undefined)
                          return (
                            <div
                              key={expense.id}
                              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                              style={{ borderLeftColor: themeColor, borderLeftWidth: '3px' }}
                            >
                              {avatarUrl ? (
                                <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white shadow" />
                              ) : (
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shadow"
                                  style={{ backgroundColor: themeColor }}
                                >
                                  {expense.display_name.charAt(0)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{category?.icon}</span>
                                  <span className="text-sm font-medium text-gray-800 truncate">
                                    {expense.note || category?.label}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400">
                                  {expense.display_name} ·{' '}
                                  {new Date(expense.created_at).toLocaleDateString('zh-TW', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-red-600">-¥{expense.amount.toLocaleString()}</p>
                              </div>
                              {(currentUser?.username === expense.username || isAdminUser) && (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingExpense(expense)
                                      setExpenseForm({
                                        amount: expense.amount.toString(),
                                        category: expense.category,
                                        note: expense.note || '',
                                      })
                                      setShowExpenseForm(true)
                                    }}
                                    className="p-1.5 text-xs text-blue-500 hover:bg-blue-50 rounded"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm('確定要刪除此支出？')) {
                                        await deleteSupabaseExpense(expense.id)
                                        await queryClient.invalidateQueries({ queryKey: ['expenses'] })
                                        setWalletDirty(true)
                                      }
                                    }}
                                    className="p-1.5 text-xs text-red-500 hover:bg-red-50 rounded"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}

                {walletTab === 'personal' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                      <span className="text-sm text-gray-600">我的總支出</span>
                      <div className="text-2xl font-bold text-gray-800 mt-1">
                        ¥{personalExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{personalExpenses.length} 筆記錄</p>
                    </div>

                    <div className="space-y-2">
                      {personalExpenses.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">尚無個人支出記錄</p>
                      ) : (
                        personalExpenses.map((expense) => {
                          const category = EXPENSE_CATEGORIES.find((c) => c.id === expense.category)
                          return (
                            <div
                              key={expense.id}
                              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                            >
                              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg">{category?.icon}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{expense.note || category?.label}</p>
                                <p className="text-xs text-gray-400">
                                  {new Date(expense.created_at).toLocaleDateString('zh-TW', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-red-600">-¥{expense.amount.toLocaleString()}</p>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingExpense(expense)
                                    setExpenseForm({
                                      amount: expense.amount.toString(),
                                      category: expense.category,
                                      note: expense.note || '',
                                    })
                                    setShowExpenseForm(true)
                                  }}
                                  className="p-1.5 text-xs text-blue-500 hover:bg-blue-50 rounded"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm('確定要刪除此支出？')) {
                                      await deleteSupabaseExpense(expense.id)
                                      await queryClient.invalidateQueries({ queryKey: ['expenses'] })
                                      setWalletDirty(true)
                                    }
                                  }}
                                  className="p-1.5 text-xs text-red-500 hover:bg-red-50 rounded"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!showExpenseForm && (
                <div className="p-4 border-t border-gray-100 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowExpenseForm(true)}
                    className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">+</span>
                    <span>新增{walletTab === 'shared' ? '共同' : '個人'}支出</span>
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && showExpenseForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[75] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowExpenseForm(false)
                setEditingExpense(null)
                setExpenseForm({ amount: '', category: 'food', note: '' })
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl max-h-[70vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-shrink-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                <h4 className="font-medium text-gray-800 text-lg">{editingExpense ? '編輯支出' : '新增支出'}</h4>
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseForm(false)
                    setEditingExpense(null)
                    setExpenseForm({ amount: '', category: 'food', note: '' })
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">金額 (JPY)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 text-lg font-semibold border border-gray-200 rounded-xl focus:border-amber-400 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">類別</label>
                  <div className="grid grid-cols-3 gap-2">
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setExpenseForm({ ...expenseForm, category: cat.id })}
                        className={`py-2 px-2 text-sm rounded-xl border transition-colors flex items-center justify-center gap-1 ${
                          expenseForm.category === cat.id
                            ? 'border-amber-400 bg-amber-50 text-amber-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">備註（選填）</label>
                  <input
                    type="text"
                    value={expenseForm.note}
                    onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })}
                    placeholder="例如：午餐拉麵"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={async () => {
                    if (!expenseForm.amount) {
                      notify({ type: 'error', text: '請輸入金額' })
                      return
                    }

                    let user = currentUser || getCurrentUser()
                    if (!user && users.length > 0) {
                      const adminUser = users.find((u) => u.role === 'admin')
                      const fallbackUser = adminUser || users[0]
                      if (fallbackUser) {
                        user = {
                          username: fallbackUser.username,
                          role: fallbackUser.role,
                          displayName: fallbackUser.displayName,
                          avatarUrl: fallbackUser.avatarUrl,
                        }
                        setCurrentUser(user)
                      }
                    }

                    if (!user) {
                      notify({ type: 'error', text: '請先登入' })
                      return
                    }

                    try {
                      if (editingExpense) {
                        const { error } = await updateSupabaseExpense(editingExpense.id, {
                          amount: parseFloat(expenseForm.amount),
                          category: expenseForm.category,
                          note: expenseForm.note || null,
                        })
                        if (error) {
                          notify({ type: 'error', text: `更新失敗：${error}` })
                          return
                        }
                      } else {
                        const { error } = await createSupabaseExpense({
                          type: walletTab,
                          username: user.username,
                          display_name: user.displayName,
                          avatar_url: user.avatarUrl || null,
                          amount: parseFloat(expenseForm.amount),
                          category: expenseForm.category,
                          note: expenseForm.note || null,
                        })
                        if (error) {
                          notify({ type: 'error', text: `新增失敗：${error}` })
                          return
                        }
                      }

                      await queryClient.invalidateQueries({ queryKey: ['expenses'] })
                      setShowExpenseForm(false)
                      setEditingExpense(null)
                      setExpenseForm({ amount: '', category: 'food', note: '' })
                      notify({ type: 'success', text: editingExpense ? '支出已更新！' : '支出已新增！' })
                      setWalletDirty(true)
                    } catch (err: unknown) {
                      const m = err instanceof Error ? err.message : '未知錯誤'
                      notify({ type: 'error', text: `操作失敗：${m}` })
                    }
                  }}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-medium rounded-xl transition-colors"
                >
                  {editingExpense ? '更新' : '新增'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
