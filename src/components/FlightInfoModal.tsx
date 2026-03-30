'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FlightRecord } from '@/lib/flightInfo'
import {
  airportCodeCityLine,
  computeFlightDurationLabel,
  emptyFlightForm,
  flightRecordFromForm,
  formatFlightFooterLine,
} from '@/lib/flightInfo'

const BTN = '#4F46E5'

function FlightListCard({
  flight,
  onDelete,
}: {
  flight: FlightRecord
  onDelete?: () => void
}) {
  const duration =
    flight.durationDisplay?.trim() ||
    computeFlightDurationLabel(
      flight.depDate,
      flight.depTime,
      flight.arrDate,
      flight.arrTime
    ) ||
    '—'

  const airline = flight.airlineName?.trim() || flight.flightNumber?.trim() || '航班'
  const showPriceRow = Boolean(flight.priceDisplay?.trim() || flight.discountLabel?.trim())

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            {flight.airlineLogoUrl?.trim() ? (
              <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-gray-100">
                <img
                  src={flight.airlineLogoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                {airline.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{airline}</p>
              {flight.aircraftModel?.trim() ? (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{flight.aircraftModel}</p>
              ) : flight.fareTag?.trim() ? (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{flight.fareTag}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span aria-hidden>🕐</span>
              <span>{duration}</span>
            </div>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="text-xs text-red-500 hover:text-red-600"
              >
                刪除
              </button>
            )}
          </div>
        </div>

        {/* Main row */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 items-center">
          <div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 tabular-nums tracking-tight">
              {flight.depTime || '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <span className="text-[10px]" aria-hidden>
                ↗
              </span>
              <span className="truncate">
                {airportCodeCityLine(flight.depCode, flight.depCity)}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-gray-400 text-lg" aria-hidden>
              ✈️
            </span>
            {flight.flightNumber?.trim() && (
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{flight.flightNumber}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl md:text-3xl font-bold text-gray-900 tabular-nums tracking-tight">
              {flight.arrTime || '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-1">
              <span className="truncate">
                {airportCodeCityLine(flight.arrCode, flight.arrCity)}
              </span>
              <span className="text-[10px] flex-shrink-0" aria-hidden>
                ↘
              </span>
            </p>
          </div>
        </div>

        <div className="my-4 border-t border-dashed border-gray-200" />

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 min-w-0">
            <span aria-hidden>📅</span>
            <span className="truncate">{formatFlightFooterLine(flight.depDate, flight.stopsLabel)}</span>
          </div>
          {showPriceRow && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {flight.discountLabel?.trim() && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {flight.discountLabel}
                </span>
              )}
              {flight.priceDisplay?.trim() && (
                <span className="text-lg font-bold text-gray-900">{flight.priceDisplay}</span>
              )}
            </div>
          )}
        </div>

        {(flight.depAirportName?.trim() || flight.depTerminal?.trim()) && (
          <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
            {flight.depAirportName?.trim()}
            {flight.depTerminal?.trim() ? ` · ${flight.depTerminal}` : ''}
            {flight.arrAirportName?.trim() || flight.arrTerminal?.trim() ? (
              <>
                {' → '}
                {flight.arrAirportName?.trim()}
                {flight.arrTerminal?.trim() ? ` · ${flight.arrTerminal}` : ''}
              </>
            ) : null}
            {flight.fareClass?.trim() ? ` · Fare Class ${flight.fareClass}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

function FlightRecordFormFields({
  form,
  setForm,
}: {
  form: Omit<FlightRecord, 'id'>
  setForm: Dispatch<SetStateAction<Omit<FlightRecord, 'id'>>>
}) {
  const inp =
    'border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 text-sm'
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-gray-500">航空公司名稱</span>
        <input
          value={form.airlineName ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, airlineName: e.target.value }))}
          className={inp}
          placeholder="HK Express"
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-gray-500">航空公司 Logo 圖片網址（選填）</span>
        <input
          value={form.airlineLogoUrl ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, airlineLogoUrl: e.target.value }))}
          className={inp}
          placeholder="https://..."
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">機型（選填）</span>
        <input
          value={form.aircraftModel ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, aircraftModel: e.target.value }))}
          className={inp}
          placeholder="Airbus A321neo"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">飛行時長（選填，留空則自動推算）</span>
        <input
          value={form.durationDisplay ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, durationDisplay: e.target.value }))}
          className={inp}
          placeholder="5h 30m"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">出發城市（括號內）</span>
        <input
          value={form.depCity ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, depCity: e.target.value }))}
          className={inp}
          placeholder="香港"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">抵達城市（括號內）</span>
        <input
          value={form.arrCity ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, arrCity: e.target.value }))}
          className={inp}
          placeholder="東京"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">經停／直飛</span>
        <input
          value={form.stopsLabel ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, stopsLabel: e.target.value }))}
          className={inp}
          placeholder="直飛"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">折扣標籤（選填）</span>
        <input
          value={form.discountLabel ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, discountLabel: e.target.value }))}
          className={inp}
          placeholder="-15%"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">票價顯示（選填）</span>
        <input
          value={form.priceDisplay ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, priceDisplay: e.target.value }))}
          className={inp}
          placeholder="HKD 3,200"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">航班編號</span>
        <input
          value={form.flightNumber}
          onChange={(e) => setForm((p) => ({ ...p, flightNumber: e.target.value }))}
          className={inp}
          placeholder="UO848"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Fare Class</span>
        <input
          value={form.fareClass}
          onChange={(e) => setForm((p) => ({ ...p, fareClass: e.target.value }))}
          className={inp}
          placeholder="U"
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-gray-500">標籤（如 隨心飛）</span>
        <input
          value={form.fareTag}
          onChange={(e) => setForm((p) => ({ ...p, fareTag: e.target.value }))}
          className={inp}
          placeholder="隨心飛"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">出發時間</span>
        <input
          type="time"
          value={form.depTime}
          onChange={(e) => setForm((p) => ({ ...p, depTime: e.target.value }))}
          className={inp}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">抵達時間</span>
        <input
          type="time"
          value={form.arrTime}
          onChange={(e) => setForm((p) => ({ ...p, arrTime: e.target.value }))}
          className={inp}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">出發機場代碼</span>
        <input
          value={form.depCode}
          onChange={(e) => setForm((p) => ({ ...p, depCode: e.target.value.toUpperCase() }))}
          className={inp}
          placeholder="HKG"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">抵達機場代碼</span>
        <input
          value={form.arrCode}
          onChange={(e) => setForm((p) => ({ ...p, arrCode: e.target.value.toUpperCase() }))}
          className={inp}
          placeholder="NRT"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">出發日期</span>
        <input
          type="date"
          value={form.depDate}
          onChange={(e) => setForm((p) => ({ ...p, depDate: e.target.value }))}
          className={inp}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">抵達日期</span>
        <input
          type="date"
          value={form.arrDate}
          onChange={(e) => setForm((p) => ({ ...p, arrDate: e.target.value }))}
          className={inp}
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-gray-500">出發機場名稱</span>
        <input
          value={form.depAirportName}
          onChange={(e) => setForm((p) => ({ ...p, depAirportName: e.target.value }))}
          className={inp}
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-gray-500">抵達機場名稱</span>
        <input
          value={form.arrAirportName}
          onChange={(e) => setForm((p) => ({ ...p, arrAirportName: e.target.value }))}
          className={inp}
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-gray-500">出發航廈</span>
        <input
          value={form.depTerminal}
          onChange={(e) => setForm((p) => ({ ...p, depTerminal: e.target.value }))}
          className={inp}
          placeholder="客運大樓 1"
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-gray-500">抵達航廈</span>
        <input
          value={form.arrTerminal}
          onChange={(e) => setForm((p) => ({ ...p, arrTerminal: e.target.value }))}
          className={inp}
          placeholder="客運大樓 2"
        />
      </label>
    </div>
  )
}

export type FlightInfoModalProps = {
  open: boolean
  onClose: () => void
  flights: FlightRecord[]
  onSave: (next: FlightRecord[]) => Promise<void>
  /** 僅管理員可看見「新增航班」與表單 */
  isAdminUser?: boolean
}

export default function FlightInfoModal({
  open,
  onClose,
  flights,
  onSave,
  isAdminUser = false,
}: FlightInfoModalProps) {
  const [list, setList] = useState<FlightRecord[]>(flights)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(emptyFlightForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setList(flights)
      setForm(emptyFlightForm())
      setShowAddForm(false)
    }
  }, [open, flights])

  useEffect(() => {
    if (open && !isAdminUser) setShowAddForm(false)
  }, [open, isAdminUser])

  const handleAdd = async () => {
    if (!form.flightNumber.trim()) {
      alert('請填寫航班編號')
      return
    }
    const next = [...list, flightRecordFromForm(form)]
    setList(next)
    setForm(emptyFlightForm())
    setShowAddForm(false)
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    if (!confirm('確定刪除此航班？')) return
    const next = list.filter((f) => f.id !== id)
    setList(next)
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  const formWrap = (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm mb-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-sm font-semibold text-gray-800">填寫航班資料</h4>
        {list.length === 0 && (
          <button
            type="button"
            onClick={() => setShowAddForm(false)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            取消
          </button>
        )}
      </div>
      <FlightRecordFormFields form={form} setForm={setForm} />
      <button
        type="button"
        disabled={saving}
        onClick={handleAdd}
        className="mt-4 w-full py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-50 transition-opacity"
        style={{ backgroundColor: BTN }}
      >
        {saving ? '儲存中…' : '新增並儲存'}
      </button>
    </div>
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 md:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            className="bg-gray-50 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">航班資料</h3>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center"
                aria-label="關閉"
              >
                ×
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 space-y-4">
              {list.length > 0 && (
                <div
                  className={`flex items-center mb-1 ${isAdminUser ? 'justify-between' : ''}`}
                >
                  <p className="text-xs font-medium text-gray-500">航班列表</p>
                  {isAdminUser && (
                    <button
                      type="button"
                      onClick={() => setShowAddForm((v) => !v)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-colors"
                      style={{ backgroundColor: BTN }}
                    >
                      {showAddForm ? '取消新增' : '+ 新增航班'}
                    </button>
                  )}
                </div>
              )}

              <AnimatePresence>
                {isAdminUser && showAddForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    {formWrap}
                  </motion.div>
                )}
              </AnimatePresence>

              {list.length > 0 ? (
                <div className="space-y-3">
                  {list.map((f) => (
                    <FlightListCard
                      key={f.id}
                      flight={f}
                      onDelete={isAdminUser ? () => handleRemove(f.id) : undefined}
                    />
                  ))}
                </div>
              ) : (
                !showAddForm && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 mb-4">
                      {isAdminUser ? '尚無航班，請新增' : '尚無航班資料'}
                    </p>
                    {isAdminUser && (
                      <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="px-4 py-2.5 rounded-xl text-white font-medium text-sm"
                        style={{ backgroundColor: BTN }}
                      >
                        + 新增航班
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
