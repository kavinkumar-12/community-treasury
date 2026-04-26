import base64
import logging
import os
import msgpack
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv
from supabase import create_client, Client
from algosdk.v2client import algod
from algosdk import account
from algosdk import encoding
from algosdk.transaction import Multisig, PaymentTxn

# Load secret keys from .env file
load_dotenv()

logger = logging.getLogger(__name__)

app = FastAPI(title="Community Treasury API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Essential when using origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase Setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Algorand Testnet Setup
ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""  # No token is needed for this endpoint
algod_client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)

@app.get("/")
def read_root():
    return {"message": "Server is Alive"}

@app.get("/health")
def health_check():
    try:
        status = algod_client.status()
        return {"algod_status": status}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Algod connection failed: {str(e)}")

# This tells FastAPI what data to expect from the frontend
class VaultRequest(BaseModel):
    addresses: List[str]
    threshold: int

class ProposalRequest(BaseModel):
    vault_address: str
    proposer_address: str
    amount: int
    reason: str

class MultisigRequest(BaseModel):
    treasuryName: str
    trustees: List[str]
    threshold: int

@app.get("/generate-test-accounts")
def generate_test_accounts():
    """Helper route to generate 5 valid Algorand test accounts."""
    accounts = []
    for _ in range(5):
        private_key, public_address = account.generate_account()
        accounts.append(public_address)
    return {"test_addresses": accounts}

@app.post("/create-vault")
def create_vault(request: VaultRequest):
    """Fuses multiple addresses into a single MultiSig Treasury Vault."""
    try:
        # Algorand's native MultiSig object
        msig = Multisig(version=1, threshold=request.threshold, addresses=request.addresses)
        
        # Calculate the immutable vault address
        vault_address = msig.address()
        
        return {
            "status": "Vault Created Successfully!",
            "vault_address": vault_address,
            "threshold": request.threshold
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/propose-transaction")
def propose_transaction(request: ProposalRequest):
    """Builds an unsigned payment txn (vault → proposer) and saves it to the waiting room."""
    try:
        if request.amount < 0:
            return {"error": "Amount must be non-negative"}

        sp = algod_client.suggested_params()
        micro_algos = request.amount * 1_000_000

        payment_txn = PaymentTxn(
            sender=request.vault_address,
            sp=sp,
            receiver=request.proposer_address,
            amt=micro_algos,
        )

        canonical_dict = encoding._sort_dict(payment_txn.dictify())
        msgpack_bytes = msgpack.packb(canonical_dict, use_bin_type=True)
        msgpack_txn_b64 = base64.b64encode(msgpack_bytes).decode("ascii")

        db_data = {
            "vault_address": request.vault_address,
            "proposer_address": request.proposer_address,
            "amount": request.amount,
            "reason": request.reason,
            "msgpack_txn": msgpack_txn_b64,
            "signature_count": 1,  # The proposer is the first signature
        }

        response = supabase.table("pending_transactions").insert(db_data).execute()

        return {
            "status": "Transaction proposed and saved to waiting room!",
            "data": response.data,
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/pending-transactions")
def get_pending_transactions():
    """Return all pending_transactions rows that have not been executed yet."""
    try:
        response = (
            supabase.table("pending_transactions")
            .select("*")
            .eq("is_executed", False)
            .execute()
        )
        rows = response.data if response.data is not None else []
        return {"pending_transactions": rows}
    except Exception as e:
        logger.exception("Failed to query pending_transactions from Supabase")
        raise HTTPException(
            status_code=502,
            detail="Unable to load pending transactions. Please try again later.",
        ) from e


class ExecuteRequest(BaseModel):
    transaction_id: int
    signed_bytes_array: list[int]

@app.post("/execute-transaction")
async def execute_transaction(req: ExecuteRequest):
    try:
        # 1. Convert the pure numbers into pure bytes
        decoded_bytes = bytes(req.signed_bytes_array)
        
        # 2. Safely wrap the pure bytes in Base64 for the Algorand SDK
        safe_b64_string = base64.b64encode(decoded_bytes).decode('utf-8')
        
        # 3. Send the safely formatted string to Algorand
        txid = algod_client.send_raw_transaction(safe_b64_string)
        
        # 4. Mark as executed in Supabase
        supabase.table("pending_transactions").update({"is_executed": True}).eq("id", req.transaction_id).execute()
        
        return {"message": "Success", "txid": txid}
        
    except Exception as e:
        print(f"\n====================\nALGORAND ERROR:\n{str(e)}\n====================\n")
        raise HTTPException(status_code=400, detail=f"Transaction execution failed: {str(e)}")

@app.post("/api/v1/treasury/multisig")
async def create_multisig(request: MultisigRequest):
    print(f"DEBUG: Received threshold={request.threshold}, trustees={request.trustees}")
    try:
        # Use transaction.Multisig to avoid the fatal ImportError we debugged earlier!
        from algosdk.transaction import Multisig
        
        # Force-convert everything to pure types
        t = int(request.threshold)
        # Filter out empty strings and trim whitespace
        a = [str(addr).strip() for addr in request.trustees if addr]
        
        msig = Multisig(1, t, a)
        vault_addr = str(msig.address())

        # 2. Save to Supabase
        vault_data = {
            "name": request.treasuryName,
            "address": vault_addr,
            "trustees": a,
            "threshold": t
        }
        supabase.table("multisig_vaults").insert(vault_data).execute()

        return {"status": "success", "multisig_address": vault_addr}
    except Exception as e:
        # If the address is invalid, return a clean 400 error
        return JSONResponse(status_code=400, content={"error": f"Invalid Data: {str(e)}"})