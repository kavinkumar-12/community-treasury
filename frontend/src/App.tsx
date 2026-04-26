import AuthModal from './components/AuthModal';
import { supabase } from './lib/supabaseClient';
import CreateTreasury from './CreateTreasury';
import Navbar from './components/Navbar';
import DashboardLayout from './components/DashboardLayout';
import { VaultList } from './components/VaultList';
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import algosdk from 'algosdk'
import { useWallet, type Wallet } from '@txnlab/use-wallet-react'

const HEALTH_URL = 'http://127.0.0.1:8000/health'
const PROPOSE_TRANSACTION_URL = 'http://127.0.0.1:8000/propose-transaction'
const PENDING_TRANSACTIONS_URL = 'http://127.0.0.1:8000/pending-transactions'
const EXECUTE_TRANSACTION_URL = 'http://127.0.0.1:8000/execute-transaction'




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




type BackendStatus = 'loading' | 'online' | 'offline'

/** Row shape from GET /pending-transactions (Supabase pending_transactions). */
export type PendingTransactionRow = {
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
  const [showKycForm, setShowKycForm] = useState(false)
  const [session, setSession] = useState<any>(null)

  const { wallets, activeAddress, isReady, signTransactions } = useWallet()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        setShowKycForm(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
              className={`h-2 w-2 shrink-0 rounded-full ${backendStatus === 'online'
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
        <Navbar 
          session={session} 
          onSignOut={() => supabase.auth.signOut()} 
          onOpenKyc={() => setShowKycForm(true)} 
          onOpenWallet={() => setWalletModalOpen(true)}
        />



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
            <DashboardLayout
              proposeFormOpen={proposeFormOpen}
              setProposeFormOpen={setProposeFormOpen}
              expenseAmount={expenseAmount}
              setExpenseAmount={setExpenseAmount}
              expenseReason={expenseReason}
              setExpenseReason={setExpenseReason}
              proposeSubmitting={proposeSubmitting}
              handleProposeSubmit={handleProposeSubmit}
              handleProposeCancel={handleProposeCancel}
              pendingLoading={pendingLoading}
              pendingTransactions={pendingTransactions}
              pendingError={pendingError}
              approvingKey={approvingKey}
              handleApprovePending={handleApprovePending}
            />
          </div>
          <div className="mt-8">
            <CreateTreasury />
          </div>
          <div className="mt-12">
            <VaultList />
          </div>
          <AuthModal isOpen={showKycForm} onClose={() => setShowKycForm(false)} />
        </main>
      </div>
    </div>
  )
}

export default App
