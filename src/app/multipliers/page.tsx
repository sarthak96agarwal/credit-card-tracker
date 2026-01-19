"use client";

import { useEffect, useState } from "react";
import { api, CreditCard } from "@/lib/api";

interface MultiplierWithCard {
  category: string;
  multiplier: number;
  notes: string | null;
  card: {
    id: string;
    name: string;
    color: string;
    owner: string;
  };
}

export default function MultipliersPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"category" | "card">("category");

  useEffect(() => {
    api.getCards()
      .then(setCards)
      .finally(() => setLoading(false));
  }, []);

  // Build multiplier data with card info
  const allMultipliers: MultiplierWithCard[] = cards.flatMap(card =>
    card.multipliers.map(m => ({
      category: m.category,
      multiplier: parseFloat(m.multiplier),
      notes: null, // notes aren't in MultiplierBasic
      card: {
        id: card.id,
        name: card.name,
        color: card.color,
        owner: card.owner.name,
      }
    }))
  );

  // Get unique categories and find best card for each
  const categories = [...new Set(allMultipliers.map(m => m.category))]
    .filter(c => c !== "Everything Else")
    .sort();

  const bestCardByCategory: Record<string, MultiplierWithCard[]> = {};
  categories.forEach(category => {
    const categoryMultipliers = allMultipliers
      .filter(m => m.category === category)
      .sort((a, b) => b.multiplier - a.multiplier);
    if (categoryMultipliers.length > 0) {
      bestCardByCategory[category] = categoryMultipliers;
    }
  });

  // Filter based on search
  const filteredCategories = searchQuery
    ? categories.filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
    : categories;

  // Group by card for card view
  const cardGroups = cards.map(card => ({
    card,
    multipliers: card.multipliers
      .map(m => ({ category: m.category, multiplier: parseFloat(m.multiplier) }))
      .sort((a, b) => b.multiplier - a.multiplier)
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Point Multipliers</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Find the best card to use for each spending category
        </p>
      </div>

      {/* Search and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search categories (e.g., Dining, Travel, Groceries...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("category")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === "category"
                ? "bg-white dark:bg-gray-700 text-foreground shadow-sm"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            By Category
          </button>
          <button
            onClick={() => setViewMode("card")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === "card"
                ? "bg-white dark:bg-gray-700 text-foreground shadow-sm"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            By Card
          </button>
        </div>
      </div>

      {viewMode === "category" ? (
        /* Category View - Best card for each category */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map(category => {
            const multipliers = bestCardByCategory[category];
            if (!multipliers || multipliers.length === 0) return null;
            const best = multipliers[0];
            const others = multipliers.slice(1);

            return (
              <div
                key={category}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                {/* Best card highlight */}
                <div
                  className="p-4 border-l-4"
                  style={{ borderLeftColor: best.card.color }}
                >
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Best for <span className="font-medium text-foreground">{category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">{best.card.name}</div>
                      <div className="text-xs text-gray-400">{best.card.owner}</div>
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {best.multiplier}x
                    </div>
                  </div>
                </div>

                {/* Other options */}
                {others.length > 0 && (
                  <div className="px-4 pb-3 pt-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-xs text-gray-400 mb-2">Also:</div>
                    <div className="space-y-1">
                      {others.slice(0, 2).map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: m.card.color }}
                            />
                            <span className="text-gray-600 dark:text-gray-400">{m.card.name}</span>
                          </div>
                          <span className="font-medium text-purple-500">{m.multiplier}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Card View - All multipliers grouped by card */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cardGroups.map(({ card, multipliers }) => (
            <div
              key={card.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div
                className="h-2"
                style={{ backgroundColor: card.color }}
              />
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{card.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {card.issuer} • {card.owner.name}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {multipliers.map((m, idx) => {
                    const isEverythingElse = m.category === "Everything Else";
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between py-2 ${
                          idx < multipliers.length - 1 ? "border-b border-gray-100 dark:border-gray-700" : ""
                        }`}
                      >
                        <span className={`text-sm ${isEverythingElse ? "text-gray-400" : "text-foreground"}`}>
                          {m.category}
                        </span>
                        <span className={`font-bold ${
                          isEverythingElse
                            ? "text-gray-400"
                            : m.multiplier >= 4
                              ? "text-green-500"
                              : m.multiplier >= 2
                                ? "text-purple-500"
                                : "text-gray-600 dark:text-gray-400"
                        }`}>
                          {m.multiplier}x
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Reference Footer */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-foreground mb-3">Quick Reference</h3>
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 8).map(category => {
            const best = bestCardByCategory[category]?.[0];
            if (!best) return null;
            return (
              <div
                key={category}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-sm"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: best.card.color }}
                />
                <span className="text-gray-600 dark:text-gray-400">{category}:</span>
                <span className="font-medium text-foreground">{best.card.name}</span>
                <span className="text-purple-500 font-bold">{best.multiplier}x</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
