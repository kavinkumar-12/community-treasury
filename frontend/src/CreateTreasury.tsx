import React, { useState } from 'react';

export default function CreateTreasury() {
  const [treasuryName, setTreasuryName] = useState('Global Relief Fund 2026');
  const [trustees, setTrustees] = useState<string[]>([
    'EW64MACWEOZVRMQYAQS6K22CW273LIJE7IN64MWEFAV2TAYKJE4QJ2HXXE',
    '5W3LHQKRYJ2D2YYLZX4A367R4HNYKYYL4M4ZQ3M6KQQJ5V4J3GQQJ5V4J3'
  ]);
  const [threshold, setThreshold] = useState(2);

  const handleAddTrustee = () => {
    setTrustees([...trustees, '']);
  };

  const handleRemoveTrustee = (index: number) => {
    const newTrustees = [...trustees];
    newTrustees.splice(index, 1);
    setTrustees(newTrustees);
    // Adjust threshold if it exceeds the new number of trustees
    if (threshold > newTrustees.length) {
      setThreshold(newTrustees.length);
    }
  };

  const handleTrusteeChange = (index: number, value: string) => {
    const newTrustees = [...trustees];
    newTrustees[index] = value;
    setTrustees(newTrustees);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = "http://localhost:8000/api/v1/treasury/multisig";
    
    // Clean hidden spaces from the addresses
    const cleanTrustees = trustees.map(addr => addr.trim());
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treasuryName: treasuryName,
          trustees: cleanTrustees,
          threshold: Number(threshold)
        }),
        // Add a timeout to prevent the 'sleeping' feeling
        signal: AbortSignal.timeout(10000) 
      });

      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.error || "Server Error");
      }

      const data = await response.json();
      alert("VAULT CREATED: " + data.multisig_address);
    } catch (err: any) {
      alert("⚠️ STATUS: " + err.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-8 p-8 bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all">
      <div className="mb-8 border-b border-slate-800 pb-6">
        <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tight">
          Configure Multisignature Vault
        </h2>
        <p className="mt-3 text-base text-slate-400">
          Create a new shared treasury by adding trustee wallet addresses and setting a signature threshold.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Treasury Name */}
        <div className="group">
          <label htmlFor="treasuryName" className="block text-sm font-medium text-slate-300 mb-2 transition-colors group-focus-within:text-emerald-400">
            Treasury Name
          </label>
          <input
            id="treasuryName"
            type="text"
            value={treasuryName}
            onChange={(e) => setTreasuryName(e.target.value)}
            className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30 transition-all hover:border-slate-600"
            placeholder="e.g. Community Grant Fund"
            required
          />
        </div>

        {/* Trustee Addresses */}
        <div className="group">
          <label className="block text-sm font-medium text-slate-300 mb-2 transition-colors group-focus-within:text-emerald-400">
            Trustee Addresses
          </label>
          <div className="space-y-3">
            {trustees.map((trustee, index) => (
              <div key={index} className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-500 font-mono text-xs">{index + 1}.</span>
                  </div>
                  <input
                    type="text"
                    value={trustee}
                    onChange={(e) => handleTrusteeChange(index, e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30 transition-all font-mono text-sm hover:border-slate-600"
                    placeholder="Algorand Wallet Address"
                    required
                  />
                </div>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTrustee(index)}
                    className="shrink-0 px-4 py-3.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 hover:text-rose-300 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/40 font-medium text-sm active:scale-95"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddTrustee}
            className="mt-4 text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1.5 focus:outline-none px-3 py-2 rounded-lg hover:bg-emerald-500/10 transition-all active:scale-95"
          >
            <span className="text-lg leading-none">+</span> Add Another Trustee
          </button>
        </div>

        {/* Signature Threshold */}
        <div className="group">
          <label htmlFor="threshold" className="block text-sm font-medium text-slate-300 mb-2 transition-colors group-focus-within:text-emerald-400">
            Signature Threshold
          </label>
          <p className="text-sm text-slate-500 mb-4">
            How many trustees must sign to approve a transaction? (Max: {trustees.length})
          </p>
          <div className="flex items-center gap-4">
            <input
              id="threshold"
              type="number"
              min={1}
              max={trustees.length}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-32 bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30 transition-all tabular-nums text-lg font-medium hover:border-slate-600"
              required
            />
            <span className="text-slate-400 font-medium">
              out of {trustees.length} {trustees.length === 1 ? 'trustee' : 'trustees'}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-6 border-t border-slate-800/80">
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-4 px-6 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all transform hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 text-lg tracking-wide active:scale-95"
          >
            Generate Multisig Vault
          </button>
        </div>
      </form>
    </div>
  );
}
