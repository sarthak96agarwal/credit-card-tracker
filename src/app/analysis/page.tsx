"use client";

import { useEffect, useState } from "react";
import { api, CardAnalysis, Owner } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import ChatWidget from "@/components/ChatWidget";

export default function AnalysisPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [analysis, setAnalysis] = useState<CardAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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
                <CardAnalysisCard key={card.id} card={card} />
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

function CardAnalysisCard({ card }: { card: CardAnalysis }) {
  const netValue = parseFloat(card.net_value);
  const isPositive = netValue >= 0;
  const benefitsValue = parseFloat(card.total_benefits_value);
  const benefitsUsed = parseFloat(card.benefits_used);
  const annualFee = parseFloat(card.annual_fee);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
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
