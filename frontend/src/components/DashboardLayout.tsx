import React from 'react'
import type { PendingTransactionRow } from '../App'

const RECENT_TXS = [
  { id: 't1', label: 'Treasury deposit', amount: '+5,000 ALGO', when: '2h ago' },
  { id: 't2', label: 'Grant paid — education', amount: '−800 ALGO', when: '1d ago' },
  { id: 't3', label: 'Multisig setup fee', amount: '−0.1 ALGO', when: '3d ago' },
]

type DashboardLayoutProps = {
  proposeFormOpen: boolean
  setProposeFormOpen: (open: boolean) => void
  expenseAmount: string
  setExpenseAmount: (amount: string) => void
  expenseReason: string
  setExpenseReason: (reason: string) => void
  proposeSubmitting: boolean
  handleProposeSubmit: (e: React.FormEvent) => void
  handleProposeCancel: () => void
  pendingLoading: boolean
  pendingTransactions: PendingTransactionRow[]
  pendingError: string | null
  approvingKey: string | null
  handleApprovePending: (row: PendingTransactionRow, key: string) => void
}

export default function DashboardLayout({
  proposeFormOpen,
  setProposeFormOpen,
  expenseAmount,
  setExpenseAmount,
  expenseReason,
  setExpenseReason,
  proposeSubmitting,
  handleProposeSubmit,
  handleProposeCancel,
  pendingLoading,
  pendingTransactions,
  pendingError,
  approvingKey,
  handleApprovePending,
}: DashboardLayoutProps) {
  return (
    <>
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Overview</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white lg:text-3xl">
              Current Treasury Balance
            </h1>
          </div>
          {!proposeFormOpen && (
            <button
              type="button"
              onClick={() => setProposeFormOpen(true)}
              className="shrink-0 rounded-lg bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-300 ring-1 ring-amber-500/35 transition hover:bg-amber-500/25 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Propose Expense
            </button>
          )}
        </div>

        {proposeFormOpen && (
          <form
            onSubmit={handleProposeSubmit}
            className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5 ring-1 ring-slate-800/80"
          >
            <h2 className="text-base font-semibold text-white">New expense proposal</h2>
            <p className="mt-1 text-sm text-slate-400">
              Submit a draft proposal to the treasury backend (demo fields).
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label htmlFor="expense-amount" className="block text-sm font-medium text-slate-300">
                  Amount
                </label>
                <input
                  id="expense-amount"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={1}
                  value={expenseAmount}
                  onChange={(ev) => setExpenseAmount(ev.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white tabular-nums outline-none ring-slate-600 placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="e.g. 1000"
                  disabled={proposeSubmitting}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="expense-reason" className="block text-sm font-medium text-slate-300">
                  Reason
                </label>
                <input
                  id="expense-reason"
                  type="text"
                  value={expenseReason}
                  onChange={(ev) => setExpenseReason(ev.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none ring-slate-600 placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="What is this expense for?"
                  disabled={proposeSubmitting}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={proposeSubmitting}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                {proposeSubmitting ? 'Submitting…' : 'Submit'}
              </button>
              <button
                type="button"
                onClick={handleProposeCancel}
                disabled={proposeSubmitting}
                className="rounded-lg border border-slate-600 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/80 p-8 ring-1 ring-slate-800/80">
          <p className="text-sm text-slate-400">Total assets (placeholder)</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-white tabular-nums lg:text-5xl">
            12,450.00
            <span className="ml-2 text-2xl font-semibold text-emerald-400/90 lg:text-3xl">
              ALGO
            </span>
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Multisig vault · Last synced: demo
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Pending Approvals</h2>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">
            {pendingLoading ? '…' : `${pendingTransactions.length} pending`}
          </span>
        </div>
        {pendingError && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {pendingError}
          </p>
        )}
        {pendingLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading pending transactions…</p>
        ) : pendingError ? null : pendingTransactions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No pending approvals right now.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pendingTransactions.map((row, index) => {
              const amountNum = Number(row.amount ?? 0)
              const sigCount = Number(row.signature_count ?? 0)
              const key =
                row.id !== undefined && row.id !== null ? String(row.id) : `pending-${index}`
              return (
                <li
                  key={key}
                  className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 ring-1 ring-slate-800/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">
                      {row.reason?.trim() ? row.reason : '—'}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      <span className="font-mono tabular-nums text-slate-300">
                        {Number.isFinite(amountNum) ? amountNum.toLocaleString() : '—'} ALGO
                      </span>
                      <span className="text-slate-600"> · </span>
                      <span>
                        Current signatures:{' '}
                        <span className="font-mono text-slate-400">{sigCount}</span>
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={approvingKey === key}
                    onClick={() => void handleApprovePending(row, key)}
                    className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-emerald-400 ring-1 ring-slate-700 transition hover:bg-slate-700 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {approvingKey === key ? 'Signing…' : 'Approve'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 ring-1 ring-slate-800/60">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/30">
              {RECENT_TXS.map((tx) => (
                <tr key={tx.id} className="text-slate-300">
                  <td className="px-4 py-3.5 font-medium text-slate-200">{tx.label}</td>
                  <td
                    className={`px-4 py-3.5 text-right font-mono tabular-nums ${tx.amount.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                  >
                    {tx.amount}
                  </td>
                  <td className="hidden px-4 py-3.5 text-right text-slate-500 sm:table-cell">
                    {tx.when}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
