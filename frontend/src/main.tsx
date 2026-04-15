import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PeraWalletConnect } from '@perawallet/connect'
import { DeflyWalletConnect } from '@blockshake/defly-connect'
import {
  WalletProvider,
  WalletManager,
  WalletId,
  NetworkId,
  type SupportedWallet,
} from '@txnlab/use-wallet-react'
import './index.css'
import App from './App.tsx'

/**
 * Algorand TestNet chain id for WalletConnect v1 (Pera / Defly desktop QR flows).
 * @see AlgorandChainIDs in @perawallet/connect
 */
const ALGORAND_TESTNET_WC_CHAIN_ID = 416002

type PeraConnectOptions = NonNullable<ConstructorParameters<typeof PeraWalletConnect>[0]>
type DeflyConnectOptions = NonNullable<ConstructorParameters<typeof DeflyWalletConnect>[0]>

const peraConnectOptions: PeraConnectOptions = {
  chainId: ALGORAND_TESTNET_WC_CHAIN_ID,
  shouldShowSignTxnToast: true,
}

const deflyConnectOptions: DeflyConnectOptions = {
  chainId: ALGORAND_TESTNET_WC_CHAIN_ID,
  shouldShowSignTxnToast: true,
}

/**
 * WalletConnect-based wallets for WalletManager. Each entry supplies the same options
 * @txnlab/use-wallet passes to `new PeraWalletConnect(options)` / `new DeflyWalletConnect(options)`.
 * Importing the SDK classes here keeps their QR modal bundles on the main dependency graph for Vite.
 */
const walletProviders: SupportedWallet[] = [
  {
    id: WalletId.PERA,
    options: peraConnectOptions,
  },
  {
    id: WalletId.DEFLY,
    options: deflyConnectOptions,
  },
]

const walletManager = new WalletManager({
  wallets: walletProviders,
  defaultNetwork: NetworkId.TESTNET,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider manager={walletManager}>
      <App />
    </WalletProvider>
  </StrictMode>,
)
