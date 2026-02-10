"use client";

import { useEffect, useState } from "react";
import { api, Benefit, CardAnalysis, Owner } from "@/lib/api";
import { formatCurrency, BenefitPeriod } from "@/lib/utils";
import ChatWidget from "@/components/ChatWidget";

export default function AnalysisPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [analysis, setAnalysis] = useState<CardAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardAnalysis | null>(null);

  useEffect(() => {
    api.getOwners().then(setOwners);
  }, []);

  // Fetch AI insights when owner is selected
  useEffect(() => {
    if (selectedOwner) {
      setAiLoading(true);
      api.getInsights(selectedOwner)
        .then((data) => setAiInsights(data.insights))
        .catch(() => setAiInsights(null))
        .finally(() => setAiLoading(false));
    } else {
      setAiInsights(null);
    }
  }, [selectedOwner]);

  useEffect(() => {
    setLoading(true);
    api
      .getCardAnalysis(selectedOwner || undefined)
      .then(setAnalysis)
      .finally(() => setLoading(false));
  }, [selectedOwner]);

  const totalFees = analysis.reduce(
    (sum, card) => sum + parseFloat(card.annual_fee),
    0
  );
  const totalBenefits = analysis.reduce(
    (sum, card) => sum + parseFloat(card.total_benefits_value),
    0
  );
  const totalUsed = analysis.reduce(
    (sum, card) => sum + parseFloat(card.benefits_used),
    0
  );
  const netValue = totalBenefits - totalFees;
  const overallUtilization = totalBenefits > 0 ? (totalUsed / totalBenefits) * 100 : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ROI Analysis</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Card performance and benefit utilization
          </p>
        </div>
        <select
          value={selectedOwner}
          onChange={(e) => setSelectedOwner(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-foreground"
        >
          <option value="">All Cards</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}&apos;s Cards
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Annual Fees"
              value={formatCurrency(totalFees)}
              color="text-red-500"
              bgColor="bg-red-50 dark:bg-red-900/20"
            />
            <SummaryCard
              title="Total Benefits Value"
              value={formatCurrency(totalBenefits)}
              color="text-green-500"
              bgColor="bg-green-50 dark:bg-green-900/20"
            />
            <SummaryCard
              title="Net Value"
              value={formatCurrency(netValue)}
              color={netValue >= 0 ? "text-green-500" : "text-red-500"}
              bgColor={netValue >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}
            />
            <SummaryCard
              title="Overall Utilization"
              value={`${overallUtilization.toFixed(0)}%`}
              color="text-purple-500"
              bgColor="bg-purple-50 dark:bg-purple-900/20"
            />
          </div>

          {/* AI Insights */}
          {selectedOwner && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-5 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">✨</span>
                <h2 className="text-lg font-semibold text-indigo-800 dark:text-indigo-300">AI Recommendations</h2>
              </div>
              {aiLoading ? (
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Analyzing your benefits...</span>
                </div>
              ) : aiInsights ? (
                <div className="text-sm text-indigo-800 dark:text-indigo-300 whitespace-pre-line">
                  {aiInsights}
                </div>
              ) : (
                <p className="text-sm text-indigo-600 dark:text-indigo-400">
                  Select an owner to get personalized AI recommendations.
                </p>
              )}
            </div>
          )}

          {/* Card-by-Card Analysis Grid */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Card Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analysis.map((card) => (
                <CardAnalysisCard
                  key={card.id}
                  card={card}
                  onClick={() => setSelectedCard(card)}
                />
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {(analysis.some(card => parseFloat(card.net_value) < 0) ||
            analysis.some(card => card.utilization_rate < 50 && parseFloat(card.total_benefits_value) > 0)) && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Recommendations
              </h2>
              <div className="space-y-3">
                {analysis
                  .filter((card) => parseFloat(card.net_value) < 0)
                  .map((card) => (
                    <div
                      key={card.id}
                      className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
                    >
                      <p className="font-medium text-red-800 dark:text-red-400">
                        Consider canceling {card.name}
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                        Annual fee of {formatCurrency(card.annual_fee)} exceeds
                        benefit value of {formatCurrency(card.total_benefits_value)}.
                        Net loss: {formatCurrency(Math.abs(parseFloat(card.net_value)))}
                      </p>
                    </div>
                  ))}

                {analysis
                  .filter(
                    (card) =>
                      card.utilization_rate < 50 && parseFloat(card.total_benefits_value) > 0 && parseFloat(card.net_value) >= 0
                  )
                  .map((card) => (
                    <div
                      key={card.id}
                      className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl"
                    >
                      <p className="font-medium text-yellow-800 dark:text-yellow-400">
                        Low utilization on {card.name}
                      </p>
                      <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
                        Only {card.utilization_rate.toFixed(0)}% of benefits used.
                        You&apos;re leaving {formatCurrency(
                          parseFloat(card.total_benefits_value) -
                            parseFloat(card.benefits_used)
                        )}{" "}
                        on the table!
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {analysis.filter(
            (card) =>
              parseFloat(card.net_value) >= 0 && card.utilization_rate >= 50
          ).length === analysis.length && analysis.length > 0 && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <p className="font-medium text-green-800 dark:text-green-400">
                Great job! All cards are providing positive value.
              </p>
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                Keep maximizing your benefits usage.
              </p>
            </div>
          )}
        </>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {/* AI Chat Widget */}
      {selectedOwner && (
        <ChatWidget
          ownerId={selectedOwner}
          ownerName={owners.find(o => o.id === selectedOwner)?.name || "there"}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  color,
  bgColor,
}: {
  title: string;
  value: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`rounded-xl p-4 ${bgColor}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function CardAnalysisCard({ card, onClick }: { card: CardAnalysis; onClick: () => void }) {
  const netValue = parseFloat(card.net_value);
  const isPositive = netValue >= 0;
  const benefitsValue = parseFloat(card.total_benefits_value);
  const benefitsUsed = parseFloat(card.benefits_used);
  const annualFee = parseFloat(card.annual_fee);

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-lg transition-all"
    >
      {/* Color bar */}
      <div
        className="h-2"
        style={{ backgroundColor: card.color }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">{card.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {card.issuer} • {card.owner_name}
            </p>
          </div>
          <div className={`text-right`}>
            <div className={`text-xl font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>
              {isPositive ? "+" : ""}{formatCurrency(netValue)}
            </div>
            <div className="text-xs text-gray-400">net value</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Annual Fee</div>
            <div className="text-lg font-semibold text-red-500">{formatCurrency(annualFee)}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Benefits Value</div>
            <div className="text-lg font-semibold text-green-500">{formatCurrency(benefitsValue)}</div>
          </div>
        </div>

        {/* Utilization */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">Utilization</span>
            <span className={`text-sm font-semibold ${
              card.utilization_rate >= 75 ? "text-green-500" :
              card.utilization_rate >= 50 ? "text-yellow-500" :
              "text-red-500"
            }`}>
              {card.utilization_rate.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                card.utilization_rate >= 75 ? "bg-green-500" :
                card.utilization_rate >= 50 ? "bg-yellow-500" :
                "bg-red-500"
              }`}
              style={{ width: `${Math.min(card.utilization_rate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>{formatCurrency(benefitsUsed)} used</span>
            <span>{formatCurrency(benefitsValue - benefitsUsed)} remaining</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: compute per-benefit breakdown for a card
interface BenefitBreakdown {
  id: string;
  name: string;
  category: string;
  period: BenefitPeriod;
  periodLabel: string;
  valuePerPeriod: number;
  annualValue: number;
  totalEarned: number;
  totalMissed: number;
  isSkipped: boolean;
  isAutoUse: boolean;
  isUnlimited: boolean;
  usageCount: number;
  periodsCompleted: number;
  periodsMissed: number;
  totalPastPeriods: number;
}

function computeBenefitBreakdowns(benefits: Benefit[]): BenefitBreakdown[] {
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);

  return benefits.map((benefit) => {
    const period = benefit.period as BenefitPeriod;
    const value = parseFloat(benefit.value);
    const isUnlimited = benefit.benefit_type === "UNLIMITED_USE";

    // For unlimited benefits, use different logic
    if (isUnlimited) {
      const thisYearUsages = benefit.usages.filter(u => new Date(u.used_at) >= yearStart);
      const totalEarned = thisYearUsages.reduce((sum, u) => sum + parseFloat(u.used_amount), 0);
      const usageCount = thisYearUsages.length;

      return {
        id: benefit.id,
        name: benefit.name,
        category: benefit.category,
        period,
        periodLabel: "use",
        valuePerPeriod: value,
        annualValue: 0, // No fixed annual value for unlimited
        totalEarned,
        totalMissed: 0, // Can't miss unlimited benefits
        isSkipped: benefit.is_skipped,
        isAutoUse: benefit.is_auto_use,
        isUnlimited: true,
        usageCount,
        periodsCompleted: usageCount,
        periodsMissed: 0,
        totalPastPeriods: 0,
      };
    }

    const periodLabel =
      period === "MONTHLY" ? "month" : period === "QUARTERLY" ? "quarter" : period === "SEMI_ANNUAL" ? "half" : "year";
    const annualMultiplier = period === "MONTHLY" ? 12 : period === "QUARTERLY" ? 4 : period === "SEMI_ANNUAL" ? 2 : 1;
    const annualValue = value * annualMultiplier;

    // Generate past periods
    let periodsCompleted = 0;
    let periodsMissed = 0;
    let totalEarned = 0;
    let totalMissed = 0;
    let totalPastPeriods = 0;

    const getPeriodRanges = (): Array<{ start: Date; end: Date }> => {
      const ranges: Array<{ start: Date; end: Date }> = [];
      if (period === "MONTHLY") {
        for (let m = 0; m <= now.getMonth(); m++) {
          ranges.push({ start: new Date(year, m, 1), end: new Date(year, m + 1, 0) });
        }
      } else if (period === "QUARTERLY") {
        const curQ = Math.floor(now.getMonth() / 3);
        for (let q = 0; q <= curQ; q++) {
          ranges.push({ start: new Date(year, q * 3, 1), end: new Date(year, q * 3 + 3, 0) });
        }
      } else if (period === "SEMI_ANNUAL") {
        const curH = Math.floor(now.getMonth() / 6);
        for (let h = 0; h <= curH; h++) {
          ranges.push({ start: new Date(year, h * 6, 1), end: new Date(year, h * 6 + 6, 0) });
        }
      } else {
        ranges.push({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });
      }
      return ranges;
    };

    const ranges = getPeriodRanges();

    for (const range of ranges) {
      const isPast = now > range.end;
      const used = benefit.usages
        .filter((u) => {
          const uStart = new Date(u.period_start);
          return uStart >= range.start && uStart <= range.end;
        })
        .reduce((sum, u) => sum + parseFloat(u.used_amount), 0);

      totalEarned += used;

      if (isPast) {
        totalPastPeriods++;
        if (used >= value) {
          periodsCompleted++;
        } else {
          periodsMissed++;
          totalMissed += value - used;
        }
      } else {
        // Current period
        if (used >= value) {
          periodsCompleted++;
          totalPastPeriods++;
        }
      }
    }

    return {
      id: benefit.id,
      name: benefit.name,
      category: benefit.category,
      period,
      periodLabel,
      valuePerPeriod: value,
      annualValue,
      totalEarned,
      totalMissed,
      isSkipped: benefit.is_skipped,
      isAutoUse: benefit.is_auto_use,
      isUnlimited: false,
      usageCount: 0,
      periodsCompleted,
      periodsMissed,
      totalPastPeriods,
    };
  });
}

function CardDetailModal({
  card,
  onClose,
}: {
  card: CardAnalysis;
  onClose: () => void;
}) {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBenefits(card.id).then((data) => {
      setBenefits(data);
      setLoading(false);
    });
  }, [card.id]);

  const annualFee = parseFloat(card.annual_fee);
  const walletAnnualValue = parseFloat(card.wallet_annual_value);
  const walletUsed = parseFloat(card.wallet_used);
  const breakdowns = computeBenefitBreakdowns(benefits);
  const benefitsEarned = breakdowns.reduce((sum, b) => sum + b.totalEarned, 0);
  const totalEarned = benefitsEarned + walletUsed;
  const totalMissed = breakdowns.reduce((sum, b) => sum + b.totalMissed, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {card.name}
            </h2>
            <p className="text-sm text-gray-500">{card.issuer} • {card.owner_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading details...</div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Earned YTD</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(totalEarned)}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Missed YTD</div>
                <div className="text-lg font-bold text-red-500">{formatCurrency(totalMissed)}</div>
              </div>
            </div>

            {/* Fee vs Earned Progress */}
            {annualFee > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Break-Even Progress</span>
                  <span className={`text-sm font-bold ${totalEarned >= annualFee ? "text-green-500" : "text-orange-500"}`}>
                    {formatCurrency(totalEarned)} / {formatCurrency(annualFee)}
                  </span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${totalEarned >= annualFee ? "bg-green-500" : "bg-orange-500"}`}
                    style={{ width: `${Math.min((totalEarned / annualFee) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {totalEarned >= annualFee
                    ? "✅ Annual fee covered!"
                    : `${formatCurrency(annualFee - totalEarned)} more to break even`}
                </p>
              </div>
            )}

            {/* Benefit Breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Benefit Breakdown</h3>
              <div className="space-y-2">
                {breakdowns
                  .sort((a, b) => b.totalEarned - a.totalEarned)
                  .map((b) => {
                    const utilizationPct = b.annualValue > 0 ? (b.totalEarned / b.annualValue) * 100 : 0;

                    // Unlimited-use benefit display
                    if (b.isUnlimited) {
                      return (
                        <div
                          key={b.id}
                          className="rounded-lg border p-3 bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 font-medium">Unlimited</span>
                            </div>
                            <span className="text-green-600 dark:text-green-400 font-semibold text-xs">{formatCurrency(b.totalEarned)}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {b.usageCount} {b.usageCount === 1 ? 'use' : 'uses'} @ {formatCurrency(b.valuePerPeriod)} each
                          </p>
                        </div>
                      );
                    }

                    // Regular period-capped benefit display
                    return (
                      <div
                        key={b.id}
                        className={`rounded-lg border p-3 ${
                          b.isSkipped
                            ? "bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 opacity-60"
                            : b.totalMissed > 0
                            ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.name}</span>
                            {b.isAutoUse && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 font-medium">Auto</span>
                            )}
                            {b.isSkipped && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 font-medium">Skipped</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-green-600 dark:text-green-400 font-semibold">{formatCurrency(b.totalEarned)}</span>
                            {b.totalMissed > 0 && (
                              <span className="text-red-500 font-semibold">-{formatCurrency(b.totalMissed)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${b.totalMissed > 0 ? "bg-red-400" : "bg-green-500"}`}
                              style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {formatCurrency(b.valuePerPeriod)}/{b.periodLabel} • {formatCurrency(b.annualValue)}/yr
                          </span>
                        </div>
                        {b.periodsMissed > 0 && !b.isSkipped && (
                          <p className="text-[10px] text-red-500 mt-1">
                            Missed {b.periodsMissed} {b.periodLabel}{b.periodsMissed > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Wallet Section */}
            {card.has_wallet && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Currency Wallet</h3>
                <div className="rounded-lg border p-3 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Bilt Cash Redemptions</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 font-medium">Wallet</span>
                    </div>
                    <span className="text-green-600 dark:text-green-400 font-semibold text-xs">{formatCurrency(walletUsed)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{ width: `${walletAnnualValue > 0 ? Math.min((walletUsed / walletAnnualValue) * 100, 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {formatCurrency(walletAnnualValue)}/yr potential
                    </span>
                  </div>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">
                    Monthly redemption limits across all channels
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}