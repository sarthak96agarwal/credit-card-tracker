"use client";

import { useEffect, useState } from "react";
import { api, Owner, Wallet } from "@/lib/api";
import WalletCard from "@/components/WalletCard";

export default function WalletsPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getOwners().then(setOwners);
  }, []);

  useEffect(() => {
    setLoading(true);
    if (selectedOwner === "all") {
      api
        .getAllWallets()
        .then(setWallets)
        .catch(() => setWallets([]))
        .finally(() => setLoading(false));
    } else {
      api
        .getWalletsForOwner(selectedOwner)
        .then(setWallets)
        .catch(() => setWallets([]))
        .finally(() => setLoading(false));
    }
  }, [selectedOwner]);

  const refreshWallets = () => {
    if (selectedOwner === "all") {
      api.getAllWallets().then(setWallets).catch(() => setWallets([]));
    } else {
      api.getWalletsForOwner(selectedOwner).then(setWallets).catch(() => setWallets([]));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Currency Wallets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track Bilt Cash and other currency balances with monthly redemption limits
          </p>
        </div>
        <select
          value={selectedOwner}
          onChange={(e) => setSelectedOwner(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
        >
          <option value="all">All Owners</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading wallets...</div>
      ) : wallets.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No wallets found
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            No currency wallets have been created yet.
            <br />
            Wallets are created when you have cards like Bilt that offer currency credits.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {wallets.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} onRefresh={refreshWallets} />
          ))}
        </div>
      )}
    </div>
  );
}
