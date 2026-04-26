import { useWallet } from '@txnlab/use-wallet-react'

type NavbarProps = {
  session: any
  onSignOut: () => void
  onOpenKyc: () => void
  onOpenWallet: () => void
}

function formatActiveAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function Navbar({ session, onSignOut, onOpenKyc, onOpenWallet }: NavbarProps) {
  const { isReady, activeAddress, activeWallet } = useWallet()

  async function handleDisconnect() {
    if (!activeWallet) return
    try {
      await activeWallet.disconnect()
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  return (
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
          {!session && (
            <button
              type="button"
              onClick={onOpenKyc}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Complete KYC / Register
            </button>
          )}
          {session && (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg border border-slate-600 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Sign Out
            </button>
          )}
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
          onClick={onOpenWallet}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Connect Wallet
        </button>
      )}
    </header>
  )
}
