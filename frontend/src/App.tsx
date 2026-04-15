import { useCallback, useEffect, useState, type FormEvent } from 'react'
import algosdk from 'algosdk'
import { useWallet, type Wallet } from '@txnlab/use-wallet-react'

const HEALTH_URL = 'http://127.0.0.1:8000/health'
const PROPOSE_TRANSACTION_URL = 'http://127.0.0.1:8000/propose-transaction'
const PENDING_TRANSACTIONS_URL = 'http://127.0.0.1:8000/pending-transactions'
const EXECUTE_TRANSACTION_URL = 'http://127.0.0.1:8000/execute-transaction'


function formatActiveAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Decode standard Base64 (with URL-safe variants) to bytes for unsigned txn msgpack. */
function base64ToUint8Array(b64: string): Uint8Array {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}


const RECENT_TXS = [
  { id: 't1', label: 'Treasury deposit', amount: '+5,000 ALGO', when: '2h ago' },
  { id: 't2', label: 'Grant paid — education', amount: '−800 ALGO', when: '1d ago' },
  { id: 't3', label: 'Multisig setup fee', amount: '−0.1 ALGO', when: '3d ago' },
]

type BackendStatus = 'loading' | 'online' | 'offline'

/** Row shape from GET /pending-transactions (Supabase pending_transactions). */
type PendingTransactionRow = {
  id?: string | number
  reason?: string | null
  amount?: number | null
  signature_count?: number | null
  vault_address?: string | null
  proposer_address?: string | null
  msgpack_txn?: string | null
}

function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('loading')
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransactionRow[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [connectingKey, setConnectingKey] = useState<string | null>(null)
  const [proposeFormOpen, setProposeFormOpen] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseReason, setExpenseReason] = useState('')
  const [proposeSubmitting, setProposeSubmitting] = useState(false)
  const [approvingKey, setApprovingKey] = useState<string | null>(null)

  const { wallets, activeAddress, activeWallet, isReady, signTransactions } = useWallet()

  const loadPendingTransactions = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) {
      setPendingLoading(true)
      setPendingError(null)
    }
    try {
      const res = await fetch(PENDING_TRANSACTIONS_URL)
      if (!res.ok) {
        let detail = res.statusText
        try {
          const errBody = await res.json()
          if (errBody?.detail) detail = String(errBody.detail)
        } catch {
          /* ignore */
        }
        throw new Error(detail)
      }
      const data: { pending_transactions?: PendingTransactionRow[] } = await res.json()
      setPendingTransactions(Array.isArray(data.pending_transactions) ? data.pending_transactions : [])
      if (silent) setPendingError(null)
    } catch (e) {
      console.error('Failed to load pending transactions:', e)
      if (!silent) {
        setPendingTransactions([])
        setPendingError(e instanceof Error ? e.message : 'Failed to load pending transactions')
      }
    } finally {
      if (!silent) setPendingLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPendingTransactions()
  }, [loadPendingTransactions])

  useEffect(() => {
    let cancelled = false

    async function checkHealth() {
      try {
        const res = await fetch(HEALTH_URL, { method: 'GET' })
        if (!cancelled) {
          setBackendStatus(res.ok ? 'online' : 'offline')
        }
      } catch {
        if (!cancelled) {
          setBackendStatus('offline')
        }
      }
    }

    checkHealth()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSelectWallet(wallet: Wallet) {
    setConnectingKey(wallet.walletKey)
    try {
      await wallet.connect()
      setWalletModalOpen(false)
    } catch (err) {
      console.error('Wallet connection failed:', err)
    } finally {
      setConnectingKey(null)
    }
  }

  async function handleDisconnect() {
    if (!activeWallet) return
    try {
      await activeWallet.disconnect()
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  function resetProposeForm() {
    setExpenseAmount('')
    setExpenseReason('')
  }

  function handleProposeCancel() {
    resetProposeForm()
    setProposeFormOpen(false)
  }

  async function handleProposeSubmit(e: FormEvent) {
    e.preventDefault()
    console.log('Submitting...', { activeAddress, amount: expenseAmount, reason: expenseReason })

    if (!activeAddress) {
      alert('Please connect your wallet first!')
      return
    }

    const amountNum = Number(expenseAmount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount greater than zero.')
      return
    }
    const amountInt = Math.round(amountNum)

    setProposeSubmitting(true)
    try {
      const res = await fetch(PROPOSE_TRANSACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vault_address: activeAddress,
          proposer_address: activeAddress,
          amount: amountInt,
          reason: expenseReason,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        alert(JSON.stringify(errJson))
        return
      }

      resetProposeForm()
      setProposeFormOpen(false)
      void loadPendingTransactions({ silent: true })
      alert('Expense Proposed Successfully!')
    } catch (err) {
      console.error('Propose transaction failed:', err)
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setProposeSubmitting(false)
    }
  }

  async function handleApprovePending(row: PendingTransactionRow, rowKey: string) {
    if (!activeAddress) {
      window.alert('Please connect your wallet to approve.')
      return
    }
    const b64 = row.msgpack_txn
    if (b64 == null || String(b64).trim() === '') {
      window.alert('No transaction payload for this proposal.')
      return
    }
    setApprovingKey(rowKey)
    try {
      const decodedBytes = base64ToUint8Array(String(b64).trim())
      let decodedTxn: algosdk.Transaction
      try {
        decodedTxn = algosdk.decodeUnsignedTransaction(decodedBytes)
      } catch {
        window.alert('Could not decode transaction data.')
        return
      }
      // use-wallet / Pera-Connect expect Transaction[]; providers wrap as [{ txn }] internally
      const signedTxns = await signTransactions([decodedTxn])

      if (!signedTxns[0]) {
        throw new Error('Wallet did not return a signed transaction.')
      }

      const executeRes = await fetch(EXECUTE_TRANSACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: Number(row.id),
          signed_bytes_array: Array.from(signedTxns[0])
        })
      })

      if (!executeRes.ok) {
        let msg = executeRes.statusText
        try {
          const errBody = await executeRes.json()
          msg = errBody.detail || errBody.error || JSON.stringify(errBody)
        } catch { /* ignore */ }
        window.alert(`Execution failed: ${msg}`)
        return
      }

      window.alert('Transaction Executed on Blockchain!')
      void loadPendingTransactions({ silent: true })
    } catch (err) {
      console.error('Approve / sign failed:', err)
      const msg = err instanceof Error ? err.message : 'Signing was cancelled or failed.'
      window.alert(msg)
    } finally {
      setApprovingKey(null)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
        <div className="border-b border-slate-800/80 px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <span className="text-lg font-semibold text-emerald-400">CT</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Community
              </p>
              <p className="font-semibold text-slate-100">Treasury</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4" aria-label="Main">
          <a
            href="#"
            className="rounded-lg bg-slate-800/80 px-3 py-2.5 text-sm font-medium text-white ring-1 ring-slate-700/50"
          >
            Dashboard
          </a>
          <a
            href="#"
            className="rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800/50 hover:text-slate-200"
          >
            Proposals
          </a>
          <a
            href="#"
            className="rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800/50 hover:text-slate-200"
          >
            Vault
          </a>
          <a
            href="#"
            className="rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800/50 hover:text-slate-200"
          >
            Settings
          </a>
        </nav>

        <div className="border-t border-slate-800/80 px-4 py-4">
          <div className="flex items-center gap-2 rounded-lg bg-slate-800/40 px-3 py-2.5 ring-1 ring-slate-700/40">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                backendStatus === 'online'
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : backendStatus === 'offline'
                    ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                    : 'animate-pulse bg-slate-500'
              }`}
              aria-hidden
            />
            <span className="text-xs font-medium text-slate-300">
              {backendStatus === 'online' && 'Backend: Connected'}
              {backendStatus === 'offline' && 'Backend: Offline'}
              {backendStatus === 'loading' && 'Backend: …'}
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-slate-800/80 bg-slate-950/80 px-6 py-4 backdrop-blur-sm">
          {!isReady ? (
            <span className="text-sm text-slate-500">Wallets initializing…</span>
          ) : activeAddress ? (
            <>
              <span
                className="rounded-lg bg-emerald-600/25 px-4 py-2.5 font-mono text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/40"
                title={activeAddress}
              >
                {formatActiveAddress(activeAddress)}
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                className="rounded-lg border border-slate-600 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setWalletModalOpen(true)}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Connect Wallet
            </button>
          )}
        </header>

        {walletModalOpen && isReady && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              aria-label="Close wallet selection"
              onClick={() => setWalletModalOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallet-modal-title"
              className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-800/80"
            >
              <div className="flex items-start justify-between gap-4">
                <h2
                  id="wallet-modal-title"
                  className="text-lg font-semibold text-white"
                >
                  Connect a wallet
                </h2>
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Algorand Testnet — choose Pera or Defly.
              </p>
              <ul className="mt-6 space-y-2">
                {wallets.map((wallet) => (
                  <li key={wallet.walletKey}>
                    <button
                      type="button"
                      disabled={connectingKey !== null}
                      onClick={() => handleSelectWallet(wallet)}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3 text-left transition hover:border-slate-600 hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <img
                        src={wallet.metadata.icon}
                        alt=""
                        className="h-10 w-10 rounded-lg"
                        width={40}
                        height={40}
                      />
                      <span className="flex-1 font-medium text-slate-100">
                        {wallet.metadata.name}
                      </span>
                      <span className="text-sm text-emerald-400">
                        {connectingKey === wallet.walletKey ? 'Connecting…' : 'Connect'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto px-6 py-8 lg:px-10">
          <div className="mx-auto max-w-4xl space-y-10">
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
                          className={`px-4 py-3.5 text-right font-mono tabular-nums ${
                            tx.amount.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'
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
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
