"use client";

import { useEffect, useState } from "react";
import { api, Benefit, Owner, CreditCard } from "@/lib/api";
import { formatCurrency, getCurrentPeriodDates, getDaysRemaining, BenefitPeriod } from "@/lib/utils";
import Image from "next/image";
import ChatWidget from "@/components/ChatWidget";

type TimeFilter = "all" | "week" | "month" | "completed" | "skipped";
type CardFilter = "all" | string;

// Card image mapping - add your card images to /public/cards/
const CARD_IMAGES: Record<string, string> = {
  "Amex Platinum": "/cards/amex-platinum.png",
  "Amex Gold": "/cards/amex-gold.png",
  "Amex Delta Gold": "/cards/amex-delta-gold.png",
  "Bilt Palladium": "/cards/bilt-palladium.png",
  "Capital One Venture X": "/cards/venture-x.png",
  "United Explorer Card": "/cards/united-explorer.png",
};

function getCardImage(cardName: string): string | null {
  return CARD_IMAGES[cardName] || null;
}

// Urgency helpers
function getUrgencyColor(daysRemaining: number, isCompleted: boolean, isSkipped: boolean): { bg: string; text: string; border: string } {
  if (isSkipped) return { bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-400", border: "border-gray-200 dark:border-gray-700" };
  if (isCompleted) return { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-600", border: "border-green-200 dark:border-green-800" };
  if (daysRemaining <= 7) return { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-600", border: "border-red-300 dark:border-red-800" };
  if (daysRemaining <= 30) return { bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-600", border: "border-orange-200 dark:border-orange-800" };
  return { bg: "bg-white dark:bg-gray-800", text: "text-gray-500", border: "border-gray-200 dark:border-gray-700" };
}

function getUrgencyBadge(daysRemaining: number, isCompleted: boolean, isSkipped: boolean, isAutoUse: boolean) {
  if (isSkipped) {
    return (
      <span className="text-xs text-gray-400 dark:text-gray-500">
        Skipped
      </span>
    );
  }
  if (isAutoUse && !isCompleted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400">
        Auto
      </span>
    );
  }
  if (isCompleted) return null;
  if (daysRemaining <= 7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <span>⏰</span> {daysRemaining}d left
      </span>
    );
  }
  if (daysRemaining <= 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        {daysRemaining}d left
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-400">
      {daysRemaining}d left
    </span>
  );
}

export default function Dashboard() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [cardFilter, setCardFilter] = useState<CardFilter>("all");
  const [selectedBenefit, setSelectedBenefit] = useState<Benefit | null>(null);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.getOwners(), api.getCards()]).then(([ownersData, cardsData]) => {
      setOwners(ownersData);
      setCards(cardsData);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    api.getBenefits().then((data) => {
      let filtered = data;
      if (selectedOwner) {
        const ownerCardIds = owners.find(o => o.id === selectedOwner)?.cards.map(c => c.id) || [];
        filtered = filtered.filter(b => ownerCardIds.includes(b.card_id));
      }
      setBenefits(filtered);
      setLoading(false);
    });
  }, [selectedOwner, owners]);

  const refreshBenefits = () => {
    api.getBenefits().then((data) => {
      let filtered = data;
      if (selectedOwner) {
        const ownerCardIds = owners.find(o => o.id === selectedOwner)?.cards.map(c => c.id) || [];
        filtered = filtered.filter(b => ownerCardIds.includes(b.card_id));
      }
      setBenefits(filtered);
    });
  };

  const handleUpdateUsage = async (
    benefit: Benefit,
    newTotalUsed: number,
    periodDates?: { start: Date; end: Date }
  ) => {
    const period = benefit.period as BenefitPeriod;
    const { start, end } = periodDates || getCurrentPeriodDates(period);

    // Calculate usage for this specific period
    const periodUsages = benefit.usages.filter(
      u => new Date(u.period_start) >= start && new Date(u.period_start) < new Date(end.getTime() + 86400000)
    );
    const currentUsed = periodUsages.reduce((sum, u) => sum + parseFloat(u.used_amount), 0);

    // If reducing, delete all period usages and create new one
    if (newTotalUsed < currentUsed) {
      for (const usage of periodUsages) {
        await api.deleteBenefitUsage(usage.id);
      }
      if (newTotalUsed > 0) {
        await api.createBenefitUsage({
          benefit_id: benefit.id,
          period_start: start.toISOString(),
          period_end: end.toISOString(),
          used_amount: newTotalUsed,
        });
      }
    } else if (newTotalUsed > currentUsed) {
      // Calculate the difference to add
      const amountToAdd = newTotalUsed - currentUsed;
      await api.createBenefitUsage({
        benefit_id: benefit.id,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        used_amount: amountToAdd,
      });
    }

    refreshBenefits();
    setSelectedBenefit(null);
    setSelectedPeriodIndex(null);
  };

  // Helper to get benefit status for current period
  const getBenefitStatus = (benefit: Benefit) => {
    const period = benefit.period as BenefitPeriod;
    const { start, end } = getCurrentPeriodDates(period);
    const usedThisPeriod = benefit.usages
      .filter(u => new Date(u.period_start) >= start && new Date(u.period_start) < end)
      .reduce((sum, u) => sum + parseFloat(u.used_amount), 0);
    const isCompleted = usedThisPeriod >= parseFloat(benefit.value);
    const daysRemaining = getDaysRemaining(end);
    const remaining = Math.max(0, parseFloat(benefit.value) - usedThisPeriod);
    return { isCompleted, daysRemaining, usedThisPeriod, remaining };
  };

  // Helper to count completed periods for this benefit
  const getCompletedPeriodCount = (benefit: Benefit): number => {
    const instances = getPeriodInstances(benefit);
    return instances.filter(i => i.isCompleted).length;
  };

  // Helper to get total used across all periods
  const getTotalUsedToDate = (benefit: Benefit): number => {
    return benefit.usages.reduce((sum, u) => sum + parseFloat(u.used_amount), 0);
  };

  // Get unique cards for filter
  const uniqueCards = [...new Map(benefits.map(b => [b.card_id, b.card])).values()];

  // Filter and sort benefits
  const filteredBenefits = benefits
    .filter(benefit => {
      const { isCompleted, daysRemaining } = getBenefitStatus(benefit);

      // Time filter
      if (timeFilter === "skipped") return benefit.is_skipped;
      if (timeFilter === "week" && (isCompleted || daysRemaining > 7 || benefit.is_skipped)) return false;
      if (timeFilter === "month" && (isCompleted || daysRemaining > 30 || benefit.is_skipped)) return false;
      if (timeFilter === "completed") {
        // Show benefits with at least one completed or missed past period
        const instances = getPeriodInstances(benefit);
        const hasHistory = instances.some(i => (i.isPast || i.isCurrent) && !(!i.isPast && !i.isCurrent));
        const hasCompletedOrMissed = instances.some(i => i.isCompleted || (i.isPast && i.used < parseFloat(benefit.value)));
        if (!hasCompletedOrMissed) return false;
      }
      if (timeFilter === "all" && (isCompleted || benefit.is_skipped)) return false; // "Pending" shows only active pending

      // Card filter
      if (cardFilter !== "all" && benefit.card_id !== cardFilter) return false;

      return true;
    })
    .sort((a, b) => {
      const statusA = getBenefitStatus(a);
      const statusB = getBenefitStatus(b);

      // Skipped items go to very bottom
      if (a.is_skipped && !b.is_skipped) return 1;
      if (!a.is_skipped && b.is_skipped) return -1;

      // Completed items go to bottom (but above skipped)
      if (statusA.isCompleted && !statusB.isCompleted) return 1;
      if (!statusA.isCompleted && statusB.isCompleted) return -1;

      // Among non-completed, sort by days remaining (soonest first)
      if (!statusA.isCompleted && !statusB.isCompleted) {
        return statusA.daysRemaining - statusB.daysRemaining;
      }

      return 0;
    });

  // Calculate totals (exclude skipped benefits)
  const activeBenefits = benefits.filter(b => !b.is_skipped);
  const pendingBenefits = activeBenefits.filter(b => !getBenefitStatus(b).isCompleted);
  const totalExpiring = pendingBenefits.reduce((sum, b) => sum + getBenefitStatus(b).remaining, 0);
  const expiringThisWeek = pendingBenefits
    .filter(b => getBenefitStatus(b).daysRemaining <= 7)
    .reduce((sum, b) => sum + getBenefitStatus(b).remaining, 0);

  // Calculate total used this year
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const totalUsedThisYear = benefits.reduce((sum, b) => {
    return sum + b.usages
      .filter(u => new Date(u.used_at) >= yearStart)
      .reduce((s, u) => s + parseFloat(u.used_amount), 0);
  }, 0);

  // Calculate total lost (past periods that weren't fully used, excluding skipped)
  const totalLost = activeBenefits.reduce((sum, benefit) => {
    const period = benefit.period as BenefitPeriod;
    const benefitValue = parseFloat(benefit.value);
    const now = new Date();
    const year = now.getFullYear();

    let lostAmount = 0;

    if (period === "MONTHLY") {
      for (let m = 0; m < now.getMonth(); m++) {
        const start = new Date(year, m, 1);
        const end = new Date(year, m + 1, 0);
        const used = benefit.usages
          .filter(u => {
            const uStart = new Date(u.period_start);
            return uStart >= start && uStart < new Date(year, m + 1, 1);
          })
          .reduce((s, u) => s + parseFloat(u.used_amount), 0);
        lostAmount += Math.max(0, benefitValue - used);
      }
    } else if (period === "QUARTERLY") {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      for (let q = 0; q < currentQuarter; q++) {
        const start = new Date(year, q * 3, 1);
        const used = benefit.usages
          .filter(u => {
            const uStart = new Date(u.period_start);
            return uStart >= start && uStart < new Date(year, q * 3 + 3, 1);
          })
          .reduce((s, u) => s + parseFloat(u.used_amount), 0);
        lostAmount += Math.max(0, benefitValue - used);
      }
    } else if (period === "SEMI_ANNUAL") {
      const currentHalf = Math.floor(now.getMonth() / 6);
      for (let h = 0; h < currentHalf; h++) {
        const start = new Date(year, h * 6, 1);
        const used = benefit.usages
          .filter(u => {
            const uStart = new Date(u.period_start);
            return uStart >= start && uStart < new Date(year, h * 6 + 6, 1);
          })
          .reduce((s, u) => s + parseFloat(u.used_amount), 0);
        lostAmount += Math.max(0, benefitValue - used);
      }
    }
    // Annual benefits can't be "lost" until year end

    return sum + lostAmount;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Card Benefits</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">
            <span>
              <span className="text-green-500 font-semibold">{formatCurrency(totalUsedThisYear)}</span>
              <span className="text-gray-400 ml-1">earned</span>
            </span>
            {totalLost > 0 && (
              <span>
                <span className="text-gray-400 font-semibold">{formatCurrency(totalLost)}</span>
                <span className="text-gray-400 ml-1">lost</span>
              </span>
            )}
            <span>
              <span className="text-orange-500 font-semibold">{formatCurrency(totalExpiring)}</span>
              <span className="text-gray-400 ml-1">pending</span>
            </span>
            {expiringThisWeek > 0 && (
              <span>
                <span className="text-red-500 font-semibold">{formatCurrency(expiringThisWeek)}</span>
                <span className="text-gray-400 ml-1">this week</span>
              </span>
            )}
          </div>
        </div>
        <select
          value={selectedOwner}
          onChange={(e) => setSelectedOwner(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
        >
          <option value="">All Owners</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </select>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Time Filter */}
        <div className="flex gap-1 bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
          {[
            { value: "all", label: "Pending" },
            { value: "week", label: "This Week", urgent: true },
            { value: "month", label: "This Month" },
            { value: "completed", label: "History" },
            { value: "skipped", label: "Skipped" },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setTimeFilter(filter.value as TimeFilter)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeFilter === filter.value
                  ? filter.urgent && filter.value === "week"
                    ? "bg-red-500 text-white"
                    : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Card Filter */}
        <select
          value={cardFilter}
          onChange={(e) => setCardFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="all">All Cards</option>
          {uniqueCards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.name}
            </option>
          ))}
        </select>
      </div>

      {/* Benefits Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredBenefits.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {timeFilter === "completed" ? "No benefit history yet" : timeFilter === "skipped" ? "No skipped benefits" : "No benefits expiring in this timeframe"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBenefits.map((benefit) => (
            timeFilter === "completed" ? (
              <CompletedBenefitCard
                key={benefit.id}
                benefit={benefit}
                onPeriodClick={(b, periodIdx) => {
                  setSelectedBenefit(b);
                  setSelectedPeriodIndex(periodIdx);
                }}
              />
            ) : (
              <BenefitCard
                key={benefit.id}
                benefit={benefit}
                onClick={() => {
                  setSelectedBenefit(benefit);
                  setSelectedPeriodIndex(null);
                }}
              />
            )
          ))}
        </div>
      )}

      {/* Mark Used Modal */}
      {selectedBenefit && (
        <BenefitModal
          benefit={selectedBenefit}
          onClose={() => {
            setSelectedBenefit(null);
            setSelectedPeriodIndex(null);
          }}
          onUpdateUsage={handleUpdateUsage}
          onRefresh={refreshBenefits}
          initialPeriodIndex={selectedPeriodIndex ?? undefined}
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

function BenefitCard({ benefit, onClick }: { benefit: Benefit; onClick: () => void }) {
  const period = benefit.period as BenefitPeriod;
  const { start, end } = getCurrentPeriodDates(period);
  const daysRemaining = getDaysRemaining(end);

  // Calculate used amount for current period
  const usedThisPeriod = benefit.usages
    .filter(u => new Date(u.period_start) >= start && new Date(u.period_start) < end)
    .reduce((sum, u) => sum + parseFloat(u.used_amount), 0);

  const benefitValue = parseFloat(benefit.value);
  const remaining = Math.max(0, benefitValue - usedThisPeriod);
  const isCompleted = usedThisPeriod >= benefitValue;
  const hasPartialUsage = usedThisPeriod > 0 && !isCompleted;
  const isSkipped = benefit.is_skipped;
  const isAutoUse = benefit.is_auto_use;

  const periodLabel = period === "MONTHLY" ? "month" : period === "QUARTERLY" ? "quarter" : period === "SEMI_ANNUAL" ? "half" : "year";
  const cardImage = getCardImage(benefit.card.name);
  const urgencyColors = getUrgencyColor(daysRemaining, isCompleted, isSkipped);

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border-2 p-5 cursor-pointer hover:shadow-lg transition-all ${urgencyColors.bg} ${urgencyColors.border} ${isSkipped ? "opacity-60" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold leading-tight truncate ${isSkipped ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"}`}>{benefit.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{benefit.card.name}</p>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {cardImage && (
            <div className={`w-10 h-6 relative ${isSkipped ? "opacity-50" : ""}`}>
              <Image
                src={cardImage}
                alt={benefit.card.name}
                fill
                className="object-contain rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          {isCompleted && !isSkipped && (
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Hero: Amount expiring */}
      {isSkipped ? (
        <div className="mb-3">
          <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">
            {formatCurrency(benefitValue)}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">not enrolled</p>
        </div>
      ) : !isCompleted ? (
        <div className="mb-3">
          <div className={`text-2xl font-bold ${daysRemaining <= 7 ? "text-red-500" : daysRemaining <= 30 ? "text-orange-500" : "text-gray-900 dark:text-gray-100"}`}>
            {formatCurrency(remaining)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {hasPartialUsage ? `${formatCurrency(usedThisPeriod)} used of ${formatCurrency(benefitValue)}` : `expiring this ${periodLabel}`}
          </p>
        </div>
      ) : (
        <div className="mb-3">
          <div className="text-2xl font-bold text-green-500">
            {formatCurrency(usedThisPeriod)}
          </div>
          <p className="text-xs text-green-500">earned this {periodLabel}</p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isSkipped ? "bg-gray-300 dark:bg-gray-600" : isCompleted ? "bg-green-500" : daysRemaining <= 7 ? "bg-red-500" : daysRemaining <= 30 ? "bg-orange-500" : "bg-blue-500"
            }`}
            style={{ width: isSkipped ? "0%" : `${Math.min((usedThisPeriod / benefitValue) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Footer: Urgency badge */}
      <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-400">
          {formatCurrency(benefitValue)}/{periodLabel}
        </span>
        {getUrgencyBadge(daysRemaining, isCompleted, isSkipped, isAutoUse)}
      </div>
    </div>
  );
}

function CompletedBenefitCard({
  benefit,
  onPeriodClick,
}: {
  benefit: Benefit;
  onPeriodClick: (benefit: Benefit, periodIndex: number) => void;
}) {
  const periodInstances = getPeriodInstances(benefit);
  const completedCount = periodInstances.filter(i => i.isCompleted).length;
  const missedCount = periodInstances.filter(i => i.isPast && !i.isCompleted && i.used < parseFloat(benefit.value)).length;
  const totalPeriods = periodInstances.length;
  const totalUsed = benefit.usages.reduce((sum, u) => sum + parseFloat(u.used_amount), 0);
  const totalMissed = periodInstances
    .filter(i => i.isPast && !i.isCompleted)
    .reduce((sum, i) => sum + Math.max(0, parseFloat(benefit.value) - i.used), 0);
  const benefitValue = parseFloat(benefit.value);
  const period = benefit.period as BenefitPeriod;
  const periodLabel = period === "MONTHLY" ? "month" : period === "QUARTERLY" ? "quarter" : period === "SEMI_ANNUAL" ? "half" : "year";
  const cardImage = getCardImage(benefit.card.name);
  const hasMissed = missedCount > 0;

  // Determine card border/bg color based on whether there are missed periods
  const cardStyle = hasMissed
    ? "bg-red-50 dark:bg-red-900/15 border-red-300 dark:border-red-800"
    : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";

  return (
    <div className={`rounded-xl border-2 p-5 ${cardStyle}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold leading-tight truncate text-gray-900 dark:text-gray-100">{benefit.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{benefit.card.name}</p>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {cardImage && (
            <div className="w-10 h-6 relative">
              <Image
                src={cardImage}
                alt={benefit.card.name}
                fill
                className="object-contain rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          {hasMissed ? (
            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          ) : (
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Total earned + missed */}
      <div className="mb-3">
        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalUsed)}
          </div>
          {totalMissed > 0 && (
            <div className="text-sm font-semibold text-red-500">
              -{formatCurrency(totalMissed)} missed
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {completedCount} earned{missedCount > 0 ? `, ${missedCount} missed` : ""} of {totalPeriods} {periodLabel}s
        </p>
      </div>

      {/* Period bubbles grid */}
      <div className="mb-3">
        <div className={`grid gap-1 ${period === "MONTHLY" ? "grid-cols-6" : period === "QUARTERLY" ? "grid-cols-4" : period === "SEMI_ANNUAL" ? "grid-cols-2" : "grid-cols-1"}`}>
          {periodInstances.map((instance, idx) => {
            const hasUsage = instance.used > 0;
            const isComplete = instance.isCompleted;
            const isFuture = !instance.isPast && !instance.isCurrent;
            const isMissed = instance.isPast && !isComplete;

            return (
              <button
                key={idx}
                onClick={() => !isFuture && onPeriodClick(benefit, idx)}
                disabled={isFuture}
                className={`p-1.5 rounded-lg text-center transition-colors ${
                  isFuture
                    ? "bg-gray-100 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                    : isComplete
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : isMissed
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : hasUsage
                    ? "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 hover:bg-orange-200"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300"
                } ${instance.isCurrent ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="text-[10px] font-medium">{instance.label}</div>
                <div className="text-[9px]">
                  {isFuture ? "-" : isMissed && !hasUsage ? "Missed" : hasUsage ? formatCurrency(instance.used) : "-"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500">
          {formatCurrency(benefitValue)}/{periodLabel}
        </span>
        <span className="text-xs text-gray-500">
          Click to edit
        </span>
      </div>
    </div>
  );
}

function BenefitModal({
  benefit,
  onClose,
  onUpdateUsage,
  onRefresh,
  initialPeriodIndex,
}: {
  benefit: Benefit;
  onClose: () => void;
  onUpdateUsage: (benefit: Benefit, newTotalUsed: number, periodDates?: { start: Date; end: Date }) => void;
  onRefresh: () => void;
  initialPeriodIndex?: number;
}) {
  const period = benefit.period as BenefitPeriod;
  const benefitValue = parseFloat(benefit.value);

  // Get all period instances for the year (hierarchical view)
  const periodInstances = getPeriodInstances(benefit);

  // Find current period index
  const currentPeriodIdx = periodInstances.findIndex(p => p.isCurrent);

  // State for selected period (default to initial or current)
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(
    initialPeriodIndex !== undefined ? initialPeriodIndex : (currentPeriodIdx >= 0 ? currentPeriodIdx : 0)
  );

  // Get selected period data
  const selectedPeriod = periodInstances[selectedPeriodIndex];
  const { start, end } = selectedPeriod ? { start: selectedPeriod.start, end: selectedPeriod.end } : getCurrentPeriodDates(period);
  const daysRemaining = getDaysRemaining(end);
  const isCurrentPeriod = selectedPeriod?.isCurrent ?? true;
  const isPastPeriod = selectedPeriod?.isPast ?? false;

  // Selected period usage
  const selectedPeriodUsages = benefit.usages.filter(
    u => new Date(u.period_start) >= start && new Date(u.period_start) < new Date(end.getTime() + 86400000)
  );
  const usedThisPeriod = selectedPeriodUsages.reduce((sum, u) => sum + parseFloat(u.used_amount), 0);

  const remaining = Math.max(0, benefitValue - usedThisPeriod);
  const isCompleted = usedThisPeriod >= benefitValue;

  const [inputValue, setInputValue] = useState(usedThisPeriod.toFixed(2));
  const [isEditing, setIsEditing] = useState(!isCompleted);
  const [isSkipped, setIsSkipped] = useState(benefit.is_skipped);
  const [isAutoUse, setIsAutoUse] = useState(benefit.is_auto_use);
  const [updating, setUpdating] = useState(false);
  const cardImage = getCardImage(benefit.card.name);

  // Combined loading state - disable all actions when any operation is in progress
  const isProcessing = updating;

  // Update input value when period changes (but don't force editing state)
  useEffect(() => {
    const periodUsages = benefit.usages.filter(
      u => new Date(u.period_start) >= periodInstances[selectedPeriodIndex].start &&
           new Date(u.period_start) < new Date(periodInstances[selectedPeriodIndex].end.getTime() + 86400000)
    );
    const used = periodUsages.reduce((sum, u) => sum + parseFloat(u.used_amount), 0);
    setInputValue(used.toFixed(2));
    // Only auto-enable editing for incomplete periods, don't force disable for completed ones
    if (used < benefitValue) {
      setIsEditing(true);
    }
  }, [selectedPeriodIndex, benefit.usages, benefitValue, periodInstances]);

  const handleToggleSkipped = async () => {
    setUpdating(true);
    try {
      await api.updateBenefit(benefit.id, { is_skipped: !isSkipped, is_auto_use: !isSkipped ? false : isAutoUse });
      setIsSkipped(!isSkipped);
      if (!isSkipped) setIsAutoUse(false); // Can't be auto-use if skipped
      onRefresh();
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleAutoUse = async () => {
    if (isSkipped) return; // Can't enable auto-use if skipped
    setUpdating(true);
    try {
      await api.updateBenefit(benefit.id, { is_auto_use: !isAutoUse });
      setIsAutoUse(!isAutoUse);
      onRefresh();
    } finally {
      setUpdating(false);
    }
  };

  const handleSubmit = async () => {
    const newTotal = parseFloat(inputValue) || 0;
    if (newTotal !== usedThisPeriod && newTotal >= 0 && newTotal <= benefitValue) {
      setUpdating(true);
      try {
        await onUpdateUsage(benefit, newTotal, { start, end });
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleMarkFullyUsed = async () => {
    setUpdating(true);
    try {
      await onUpdateUsage(benefit, benefitValue, { start, end });
    } finally {
      setUpdating(false);
    }
  };

  const handleReset = async () => {
    const periodLabel = selectedPeriod?.label || "this period";
    if (confirm(`Reset all usage for ${periodLabel}? This cannot be undone.`)) {
      for (const usage of selectedPeriodUsages) {
        await api.deleteBenefitUsage(usage.id);
      }
      onRefresh();
      onClose();
    }
  };

  const urgencyColors = getUrgencyColor(daysRemaining, isCompleted, isSkipped);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {cardImage && (
                <div className="w-12 h-8 relative flex-shrink-0">
                  <Image
                    src={cardImage}
                    alt={benefit.card.name}
                    fill
                    className="object-contain rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{benefit.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{benefit.card.name} - {benefit.category}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Settings Toggles */}
          <div className="flex gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={handleToggleSkipped}
              disabled={isProcessing}
              className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                isSkipped
                  ? "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">Skip</span>
              <div className={`w-10 h-6 rounded-full transition-colors relative ${isSkipped ? "bg-gray-500" : "bg-gray-200 dark:bg-gray-700"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isSkipped ? "translate-x-5" : "translate-x-1"}`} />
              </div>
            </button>
            <button
              onClick={handleToggleAutoUse}
              disabled={isProcessing || isSkipped}
              className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                isAutoUse
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                  : isSkipped
                    ? "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <span className={`text-sm ${isSkipped ? "text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>Auto-use</span>
              <div className={`w-10 h-6 rounded-full transition-colors relative ${isAutoUse ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isAutoUse ? "translate-x-5" : "translate-x-1"}`} />
              </div>
            </button>
          </div>

          {isSkipped && (
            <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
              This benefit is marked as skipped. It won&apos;t appear in your pending or urgent lists.
            </div>
          )}

          {isAutoUse && !isSkipped && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm text-blue-700 dark:text-blue-400">
              This benefit is set to auto-use. It will be marked as fully used automatically each period.
            </div>
          )}

          {/* Period Selector */}
          {!isSkipped && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Select Period</h3>
            <div className={`grid gap-1.5 ${period === "MONTHLY" ? "grid-cols-6" : period === "QUARTERLY" ? "grid-cols-4" : period === "SEMI_ANNUAL" ? "grid-cols-2" : "grid-cols-1"}`}>
              {periodInstances.map((instance, idx) => {
                const isSelected = idx === selectedPeriodIndex;
                const hasUsage = instance.used > 0;
                const isFuture = !instance.isPast && !instance.isCurrent;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedPeriodIndex(idx)}
                    disabled={isFuture}
                    className={`p-1.5 rounded-lg text-center text-xs transition-all ${
                      isSelected
                        ? "ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400"
                        : instance.isCompleted
                        ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 hover:bg-green-200"
                        : hasUsage
                        ? "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 hover:bg-orange-200"
                        : isFuture
                        ? "bg-gray-50 dark:bg-gray-800/30 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    <div className="font-medium">{instance.label}</div>
                    <div className="text-[9px] mt-0.5">
                      {hasUsage ? formatCurrency(instance.used) : "-"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Selected Period Status */}
          {!isSkipped && (
          <div className={`rounded-xl p-4 mb-4 ${urgencyColors.bg} border ${urgencyColors.border}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {selectedPeriod?.label || "Period"} {isPastPeriod && <span className="text-gray-400">(Past)</span>}
              </span>
              {isCompleted ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Completed</span>
              ) : isPastPeriod ? (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Expired</span>
              ) : daysRemaining <= 7 ? (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">⏰ {daysRemaining}d left</span>
              ) : daysRemaining <= 30 ? (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">{daysRemaining}d left</span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{daysRemaining}d left</span>
              )}
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full ${
                  isCompleted ? "bg-green-500" : isPastPeriod ? "bg-gray-400" : daysRemaining <= 7 ? "bg-red-500" : daysRemaining <= 30 ? "bg-orange-500" : "bg-blue-500"
                }`}
                style={{ width: `${Math.min((usedThisPeriod / benefitValue) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{formatCurrency(usedThisPeriod)} used</span>
              <span className={`font-semibold ${!isCompleted && !isPastPeriod && daysRemaining <= 7 ? "text-red-500" : "text-gray-900 dark:text-gray-100"}`}>
                {formatCurrency(remaining)} to go
              </span>
            </div>
          </div>
          )}

          {/* Edit Section - Only visible when not skipped */}
          {!isSkipped && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {isCompleted ? "Edit Amount" : "Update Amount Used"}
              </h3>
              {isCompleted && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
              )}
            </div>

            {(isEditing || !isCompleted) && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={inputValue}
                      disabled={isAutoUse}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setInputValue(val);
                        }
                      }}
                      className="w-full pl-7 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                      placeholder="0.00"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={isProcessing || isAutoUse || parseFloat(inputValue) === usedThisPeriod || parseFloat(inputValue) < 0 || parseFloat(inputValue) > benefitValue}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? "Saving..." : "Update"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Enter amount (0 to {formatCurrency(benefitValue)})
                </p>

                <div className="flex gap-2">
                  {!isCompleted && (
                    <button
                      onClick={handleMarkFullyUsed}
                      disabled={isProcessing || isAutoUse}
                      className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? "Saving..." : `Mark Fully Used (${formatCurrency(benefitValue)})`}
                    </button>
                  )}
                  {usedThisPeriod > 0 && (
                    <button
                      onClick={handleReset}
                      disabled={isProcessing || isAutoUse}
                      className="px-4 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getPeriodInstances(benefit: Benefit) {
  const period = benefit.period as BenefitPeriod;
  const now = new Date();
  const year = now.getFullYear();
  const benefitValue = parseFloat(benefit.value);

  const instances: Array<{
    label: string;
    start: Date;
    end: Date;
    isCurrent: boolean;
    isPast: boolean;
    isCompleted: boolean;
    used: number;
  }> = [];

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (period === "MONTHLY") {
    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1);
      const end = new Date(year, m + 1, 0);
      const isCurrent = now >= start && now <= end;
      const isPast = now > end;
      const used = benefit.usages
        .filter(u => {
          const uStart = new Date(u.period_start);
          return uStart >= start && uStart < new Date(year, m + 1, 1);
        })
        .reduce((sum, u) => sum + parseFloat(u.used_amount), 0);

      instances.push({
        label: monthNames[m],
        start,
        end,
        isCurrent,
        isPast,
        isCompleted: (isCurrent || isPast) && used >= benefitValue,
        used,
      });
    }
  } else if (period === "QUARTERLY") {
    const quarters = ["Q1", "Q2", "Q3", "Q4"];
    for (let q = 0; q < 4; q++) {
      const start = new Date(year, q * 3, 1);
      const end = new Date(year, q * 3 + 3, 0);
      const isCurrent = now >= start && now <= end;
      const isPast = now > end;
      const used = benefit.usages
        .filter(u => {
          const uStart = new Date(u.period_start);
          return uStart >= start && uStart < new Date(year, q * 3 + 3, 1);
        })
        .reduce((sum, u) => sum + parseFloat(u.used_amount), 0);

      instances.push({
        label: quarters[q],
        start,
        end,
        isCurrent,
        isPast,
        isCompleted: (isCurrent || isPast) && used >= benefitValue,
        used,
      });
    }
  } else if (period === "SEMI_ANNUAL") {
    const halves = ["H1", "H2"];
    for (let h = 0; h < 2; h++) {
      const start = new Date(year, h * 6, 1);
      const end = new Date(year, h * 6 + 6, 0);
      const isCurrent = now >= start && now <= end;
      const isPast = now > end;
      const used = benefit.usages
        .filter(u => {
          const uStart = new Date(u.period_start);
          return uStart >= start && uStart < new Date(year, h * 6 + 6, 1);
        })
        .reduce((sum, u) => sum + parseFloat(u.used_amount), 0);

      instances.push({
        label: halves[h],
        start,
        end,
        isCurrent,
        isPast,
        isCompleted: (isCurrent || isPast) && used >= benefitValue,
        used,
      });
    }
  } else {
    // Annual
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const used = benefit.usages
      .filter(u => new Date(u.used_at).getFullYear() === year)
      .reduce((sum, u) => sum + parseFloat(u.used_amount), 0);

    instances.push({
      label: year.toString(),
      start,
      end,
      isCurrent: true,
      isPast: false,
      isCompleted: used >= benefitValue,
      used,
    });
  }

  return instances;
}
