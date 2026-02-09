"use client";

import { useState } from "react";
import { api, Wallet, WalletTransaction, ChannelStatus } from "@/lib/api";
import Image from "next/image";

const CARD_IMAGES: Record<string, string> = {
  "Bilt Palladium": "/cards/bilt-palladium.png",
};

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface WalletCardProps {
  wallet: Wallet;
  onRefresh: () => void;
}

export default function WalletCard({ wallet, onRefresh }: WalletCardProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  const balance = parseFloat(wallet.current_balance);
  const mustSpend = parseFloat(wallet.must_spend_by_year_end);
  const maxSpendable = parseFloat(wallet.max_spendable_this_year);
  const monthlyCapacity = wallet.monthly_channel_status.reduce(
    (sum, c) => sum + parseFloat(c.monthly_limit),
    0
  );
  const cardImage = wallet.card ? CARD_IMAGES[wallet.card.name] : null;

  // Calculate progress percentage for must-spend
  const carryoverLimit = wallet.carryover_limit
    ? parseFloat(wallet.carryover_limit)
    : 0;
  const spentSoFar = balance > carryoverLimit ? balance - carryoverLimit - mustSpend : 0;
  const totalToSpend = balance > carryoverLimit ? balance - carryoverLimit : 0;
  const progressPercent = totalToSpend > 0 ? ((totalToSpend - mustSpend) / totalToSpend) * 100 : 100;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cardImage && (
              <div className="w-12 h-8 relative flex-shrink-0">
                <Image
                  src={cardImage}
                  alt={wallet.card?.name || "Card"}
                  fill
                  className="object-contain rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {wallet.currency_name}
              </h2>
              {wallet.card && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {wallet.card.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            + Add Funds
          </button>
        </div>
      </div>

      {/* Balance Section */}
      <div className="p-5 bg-gray-100 dark:bg-gray-800/80">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Current Balance
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(balance)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Must spend by Dec 31
            </p>
            <p
              className={`text-xl font-bold ${
                wallet.on_track
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(mustSpend)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                wallet.on_track ? "bg-green-500" : "bg-orange-500"
              }`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>
            Carryover limit: {formatCurrency(carryoverLimit)}
          </span>
          <span
            className={`font-medium ${
              wallet.on_track
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {wallet.on_track ? "On track" : "Behind pace"}
          </span>
        </div>

        {/* Monthly capacity */}
        <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-400">
              Monthly redemption capacity:
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatCurrency(monthlyCapacity)}/month
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-700 dark:text-gray-400">
              Max spendable ({wallet.months_remaining} months left):
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatCurrency(maxSpendable)}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Redemption Channels */}
      <div className="p-5 border-t border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Monthly Redemption Channels
        </h3>
        <div className="space-y-4">
          {wallet.monthly_channel_status.map((channel) => (
            <RedemptionChannelRow
              key={channel.category}
              channel={channel}
              walletId={wallet.id}
              transactions={wallet.transactions.filter(
                (t) => t.category === channel.category && t.transaction_type === "redemption"
              )}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="p-5 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Transaction History
          </h3>
          {wallet.transactions.length > 5 && (
            <button
              onClick={() => setShowAllTransactions(!showAllTransactions)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showAllTransactions ? "Show less" : "Show all"}
            </button>
          )}
        </div>
        {wallet.transactions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No transactions yet
          </p>
        ) : (
          <div className="space-y-2">
            {(showAllTransactions
              ? wallet.transactions
              : wallet.transactions.slice(0, 5)
            ).map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </div>

      {/* Add Funds Modal */}
      {showAddModal && (
        <AddFundsModal
          walletId={wallet.id}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function RedemptionChannelRow({
  channel,
  walletId,
  transactions,
  onRefresh,
}: {
  channel: ChannelStatus;
  walletId: string;
  transactions: WalletTransaction[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const limit = parseFloat(channel.monthly_limit);
  const usedThisMonth = parseFloat(channel.used_this_month);
  const remaining = parseFloat(channel.remaining);

  // Calculate totals for the year
  const totalUsed = channel.monthly_history.reduce(
    (sum, m) => sum + parseFloat(m.used),
    0
  );
  const completedMonths = channel.monthly_history.filter((m) => m.is_completed).length;
  const missedMonths = channel.monthly_history.filter(
    (m) => m.is_past && !m.is_completed
  ).length;

  const handleMonthClick = (month: number) => {
    const monthData = channel.monthly_history.find((m) => m.month === month);
    if (monthData && (monthData.is_current || monthData.is_past)) {
      setSelectedMonth(month);
      setShowModal(true);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
      {/* Channel Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            {channel.category}
          </h4>
          {channel.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {channel.description}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
            {formatCurrency(totalUsed)} earned
          </p>
          <p className="text-xs text-gray-500">
            {completedMonths} of 12 months ({formatCurrency(limit)}/mo)
          </p>
        </div>
      </div>

      {/* Monthly Grid */}
      <div className="grid grid-cols-6 gap-1.5 mb-3">
        {channel.monthly_history.map((month) => {
          const used = parseFloat(month.used);
          const isFuture = !month.is_past && !month.is_current;
          const isMissed = month.is_past && !month.is_completed && used < limit;

          return (
            <button
              key={month.month}
              onClick={() => handleMonthClick(month.month)}
              disabled={isFuture}
              className={`p-1.5 rounded-lg text-center transition-colors ${
                isFuture
                  ? "bg-gray-100 dark:bg-gray-800/30 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  : month.is_completed
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : isMissed
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : used > 0
                  ? "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 hover:bg-orange-200"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300"
              } ${month.is_current ? "ring-2 ring-blue-500" : ""}`}
            >
              <div className="text-[10px] font-medium">{month.month_name}</div>
              <div className="text-[9px]">
                {isFuture
                  ? "-"
                  : isMissed && used === 0
                  ? "Miss"
                  : used > 0
                  ? `$${used}`
                  : "-"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Current Month Quick Actions */}
      {remaining > 0 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500">
            This month: {formatCurrency(usedThisMonth)} / {formatCurrency(limit)}
          </span>
          <button
            onClick={() => {
              const currentMonth = channel.monthly_history.find((m) => m.is_current);
              if (currentMonth) {
                setSelectedMonth(currentMonth.month);
                setShowModal(true);
              }
            }}
            className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
          >
            Use {formatCurrency(remaining)} remaining
          </button>
        </div>
      )}

      {remaining <= 0 && (
        <div className="flex items-center justify-center pt-3 border-t border-gray-200 dark:border-gray-700">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
            This month complete
          </span>
        </div>
      )}

      {/* Redeem Modal for specific month */}
      {showModal && selectedMonth !== null && (
        <RedeemForMonthModal
          walletId={walletId}
          category={channel.category}
          month={selectedMonth}
          monthName={
            channel.monthly_history.find((m) => m.month === selectedMonth)
              ?.month_name || ""
          }
          monthlyLimit={limit}
          currentUsed={parseFloat(
            channel.monthly_history.find((m) => m.month === selectedMonth)?.used ||
              "0"
          )}
          isCurrent={
            channel.monthly_history.find((m) => m.month === selectedMonth)
              ?.is_current || false
          }
          transactions={transactions.filter((t) => {
            const txDate = new Date(t.transaction_date);
            return txDate.getMonth() + 1 === selectedMonth && txDate.getFullYear() === new Date().getFullYear();
          })}
          onClose={() => {
            setShowModal(false);
            setSelectedMonth(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setSelectedMonth(null);
            onRefresh();
          }}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function RedeemForMonthModal({
  walletId,
  category,
  month,
  monthName,
  monthlyLimit,
  currentUsed,
  isCurrent,
  transactions,
  onClose,
  onSuccess,
  onRefresh,
}: {
  walletId: string;
  category: string;
  month: number;
  monthName: string;
  monthlyLimit: number;
  currentUsed: number;
  isCurrent: boolean;
  transactions: WalletTransaction[];
  onClose: () => void;
  onSuccess: () => void;
  onRefresh: () => void;
}) {
  const remaining = Math.max(0, monthlyLimit - currentUsed);
  const [amount, setAmount] = useState(remaining > 0 ? remaining.toString() : "");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || parsedAmount > remaining) return;

    setLoading(true);
    try {
      // Build date for the transaction (use first of the month for past months)
      const year = new Date().getFullYear();
      const transactionDate = isCurrent
        ? undefined // Let backend use current date
        : `${year}-${month.toString().padStart(2, "0")}-15`; // Mid-month for past

      await api.addWalletTransaction(walletId, {
        amount: -parsedAmount,
        transaction_type: "redemption",
        category,
        description: description || `${category} - ${monthName}`,
        transaction_date: transactionDate,
      });
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (transactionId: string) => {
    if (!confirm("Delete this redemption?")) return;
    setDeleting(transactionId);
    try {
      await api.deleteWalletTransaction(transactionId);
      onRefresh();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {category} - {monthName}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Used this month:
            </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(currentUsed)} / {formatCurrency(monthlyLimit)}
            </span>
          </div>

          {/* Existing transactions for this month */}
          {transactions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Redemptions this month
              </h4>
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {formatCurrency(Math.abs(parseFloat(tx.amount)))}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {tx.description || formatDate(tx.transaction_date)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      disabled={deleting === tx.id}
                      className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                    >
                      {deleting === tx.id ? "..." : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {remaining > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount (max {formatCurrency(remaining)})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      if (
                        e.target.value === "" ||
                        /^\d*\.?\d*$/.test(e.target.value)
                      ) {
                        setAmount(e.target.value);
                      }
                    }}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder={`e.g., ${category} purchase`}
                />
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  parseFloat(amount) > remaining
                }
                className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : `Mark ${formatCurrency(parseFloat(amount) || 0)} Used`}
              </button>
            </form>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-green-600 dark:text-green-400 font-medium">
                Fully used for {monthName}!
              </p>
              {transactions.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Delete a redemption above to add more
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({
  transaction,
  onRefresh,
}: {
  transaction: WalletTransaction;
  onRefresh: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const amount = parseFloat(transaction.amount);
  const isCredit = amount > 0;

  const handleDelete = async () => {
    if (!confirm("Delete this transaction?")) return;
    setDeleting(true);
    try {
      await api.deleteWalletTransaction(transaction.id);
      onRefresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isCredit
              ? "bg-green-100 dark:bg-green-900/50"
              : "bg-red-100 dark:bg-red-900/50"
          }`}
        >
          <span
            className={`text-sm font-bold ${
              isCredit
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {isCredit ? "+" : "-"}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {transaction.category || transaction.transaction_type}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {transaction.description || formatDate(transaction.transaction_date)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-semibold ${
            isCredit
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {isCredit ? "+" : ""}
          {formatCurrency(Math.abs(amount))}
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function AddFundsModal({
  walletId,
  onClose,
  onSuccess,
}: {
  walletId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionType, setTransactionType] = useState("grant");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    setLoading(true);
    try {
      await api.addWalletTransaction(walletId, {
        amount: parsedAmount,
        transaction_type: transactionType,
        description: description || undefined,
      });
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Add Funds
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="grant">Annual Grant</option>
              <option value="bonus">Bonus</option>
              <option value="referral">Referral Reward</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                    setAmount(e.target.value);
                  }
                }}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="e.g., Welcome bonus"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            {loading ? "Adding..." : "Add Funds"}
          </button>
        </form>
      </div>
    </div>
  );
}

