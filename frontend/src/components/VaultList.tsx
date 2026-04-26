import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Vault {
  id: number;
  name: string;
  address: string;
  trustees: string[];
  threshold: number;
  created_at: string;
}

export const VaultList: React.FC = () => {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVaults();
  }, []);

  const fetchVaults = async () => {
    try {
      const { data, error } = await supabase
        .from('multisig_vaults')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching vaults:', error);
        return;
      }

      setVaults(data || []);
    } catch (err) {
      console.error('Error in fetchVaults:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  if (vaults.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
        <p className="text-slate-400">No multisig vaults have been created yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
      {vaults.map((vault) => (
        <div key={vault.id} className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:border-emerald-500/50 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
              {vault.name || 'Community Treasury'}
            </h3>
            <span className="bg-slate-800 text-emerald-400 text-xs px-3 py-1 rounded-full font-medium border border-emerald-500/20">
              {vault.threshold} of {vault.trustees?.length || 0} Signers
            </span>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Vault Address</p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-sm text-slate-300 break-all select-all">
                {vault.address}
              </div>
            </div>

            <a 
              href={`https://testnet.algoexplorer.io/address/${vault.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View on AlgoExplorer
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      ))}
    </div>
  );
};
