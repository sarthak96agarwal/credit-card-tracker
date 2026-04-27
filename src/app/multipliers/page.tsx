"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { api, CreditCard, AIStatus, CardRanking, SpendingLookupResponse } from "@/lib/api";

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

// Common category chips to show as quick-select
const POPULAR_CATEGORIES = [
  "Restaurants",
  "Groceries",
  "Travel",
  "Gas",
  "Flights",
  "Hotels",
  "Streaming",
  "Online Shopping",
  "Transit",
  "Drugstores",
];

export default function MultipliersPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiStatus, setAIStatus] = useState<AIStatus>({ configured: false, model: null });

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiLoading, setAILoading] = useState(false);

  // Result state
  const [lookupResult, setLookupResult] = useState<{
    category: string;
    matchType: "exact" | "ai" | "fallback" | "client";
    rankings: CardRanking[];
    aiReasoning: string | null;
  } | null>(null);

  // Reference grid state
  const [refViewMode, setRefViewMode] = useState<"category" | "card">("category");

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([api.getCards(), api.getAIStatus()])
      .then(([cardsData, status]) => {
        setCards(cardsData);
        setAIStatus(status);
      })
      .finally(() => setLoading(false));
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Derive all multiplier data
  const allMultipliers: MultiplierWithCard[] = useMemo(
    () =>
      cards.flatMap((card) =>
        card.multipliers.map((m) => ({
          category: m.category,
          multiplier: parseFloat(m.multiplier),
          notes: m.notes,
          card: {
            id: card.id,
            name: card.name,
            color: card.color,
            owner: card.owner.name,
          },
        }))
      ),
    [cards]
  );

  // All unique categories
  const allCategories = useMemo(() => {
    const cats = [...new Set(allMultipliers.map((m) => m.category))].sort();
    return cats;
  }, [allMultipliers]);

  // Categories excluding "Everything Else" for display
  const displayCategories = useMemo(
    () => allCategories.filter((c) => c !== "Everything Else"),
    [allCategories]
  );

  // Best card by category (for reference grid)
  const bestCardByCategory: Record<string, MultiplierWithCard[]> = useMemo(() => {
    const result: Record<string, MultiplierWithCard[]> = {};
    displayCategories.forEach((category) => {
      const categoryMultipliers = allMultipliers
        .filter((m) => m.category === category)
        .sort((a, b) => b.multiplier - a.multiplier);
      if (categoryMultipliers.length > 0) {
        result[category] = categoryMultipliers;
      }
    });
    return result;
  }, [allMultipliers, displayCategories]);

  // Filter suggestions based on typing
  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allCategories.filter((c) => c.toLowerCase().includes(q));
  }, [searchQuery, allCategories]);

  // Quick-select chips — only show categories that actually exist
  const chipCategories = useMemo(
    () => POPULAR_CATEGORIES.filter((c) => allCategories.includes(c)),
    [allCategories]
  );

  // Client-side category lookup: rank cards for a known category
  function rankCardsForCategory(category: string): CardRanking[] {
    const rankings: CardRanking[] = [];
    for (const card of cards) {
      for (const m of card.multipliers) {
        if (m.category === category) {
          rankings.push({
            card_name: card.name,
            card_color: card.color,
            owner_name: card.owner.name,
            multiplier: parseFloat(m.multiplier),
            notes: m.notes,
          });
        }
      }
    }
    // If matched a specific category, also include "Everything Else" cards that aren't already listed
    if (category !== "Everything Else") {
      const rankedCardNames = new Set(rankings.map((r) => r.card_name));
      for (const card of cards) {
        if (rankedCardNames.has(card.name)) continue;
        for (const m of card.multipliers) {
          if (m.category === "Everything Else") {
            rankings.push({
              card_name: card.name,
              card_color: card.color,
              owner_name: card.owner.name,
              multiplier: parseFloat(m.multiplier),
              notes: m.notes,
            });
          }
        }
      }
    }
    rankings.sort((a, b) => b.multiplier - a.multiplier);
    return rankings;
  }

  // Handle selecting a known category (chip or suggestion)
  function handleSelectCategory(category: string) {
    setSearchQuery(category);
    setShowSuggestions(false);
    const rankings = rankCardsForCategory(category);
    setLookupResult({
      category,
      matchType: "client",
      rankings,
      aiReasoning: null,
    });
  }

  // Handle Enter key — either client match or AI lookup
  async function handleSearchSubmit() {
    const query = searchQuery.trim();
    if (!query) return;

    // Try client-side exact match first
    const exactMatch = allCategories.find(
      (c) => c.toLowerCase() === query.toLowerCase()
    );
    if (exactMatch) {
      handleSelectCategory(exactMatch);
      return;
    }

    // No exact match — call AI endpoint
    setAILoading(true);
    setShowSuggestions(false);
    try {
      const result: SpendingLookupResponse = await api.spendingLookup(
        query,
        aiStatus.configured
      );
      setLookupResult({
        category: result.matched_category,
        matchType: result.match_type,
        rankings: result.rankings,
        aiReasoning: result.ai_reasoning,
      });
    } catch {
      // Fallback on error — show Everything Else
      const rankings = rankCardsForCategory("Everything Else");
      setLookupResult({
        category: "Everything Else",
        matchType: "fallback",
        rankings,
        aiReasoning: null,
      });
    } finally {
      setAILoading(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setLookupResult(null);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Point Multipliers</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Which card should I use?
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 mb-2">No cards added yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Add cards in the <span className="font-medium text-blue-500">Manage</span> tab to see multiplier rankings
          </p>
        </div>
      </div>
    );
  }

  // Card view grouping for reference grid
  const cardGroups = cards.map((card) => ({
    card,
    multipliers: card.multipliers
      .map((m) => ({
        category: m.category,
        multiplier: parseFloat(m.multiplier),
        notes: m.notes,
      }))
      .sort((a, b) => b.multiplier - a.multiplier),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Point Multipliers</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Which card should I use?
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="relative">
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
            ref={inputRef}
            type="text"
            placeholder="What are you buying? (e.g., Groceries, Uber ride, coffee at Starbucks...)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
              if (!e.target.value.trim()) {
                setLookupResult(null);
              }
            }}
            onFocus={() => {
              if (searchQuery.trim()) setShowSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // If there's exactly one suggestion and it matches, select it directly
                if (filteredSuggestions.length === 1) {
                  handleSelectCategory(filteredSuggestions[0]);
                } else {
                  handleSearchSubmit();
                }
              }
              if (e.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category Suggestions Dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          >
            {filteredSuggestions.map((cat) => (
              <button
                key={cat}
                onClick={() => handleSelectCategory(cat)}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-foreground text-sm first:rounded-t-xl last:rounded-b-xl transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick-select chips */}
      {!lookupResult && chipCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chipCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleSelectCategory(cat)}
              className="px-3 py-1.5 text-sm rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* AI Loading State */}
      {aiLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            <span className="text-gray-500 dark:text-gray-400">
              Figuring out the best category for &ldquo;{searchQuery}&rdquo;...
            </span>
          </div>
        </div>
      )}

      {/* Lookup Result */}
      {lookupResult && !aiLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Result header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Best for </span>
                <span className="font-semibold text-foreground">{lookupResult.category}</span>
              </div>
              {lookupResult.matchType === "ai" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  AI matched
                </span>
              )}
              {lookupResult.matchType === "fallback" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                  Fallback
                </span>
              )}
            </div>
            {lookupResult.aiReasoning && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
                {lookupResult.aiReasoning}
              </p>
            )}
          </div>

          {/* Rankings */}
          {lookupResult.rankings.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {lookupResult.rankings.map((ranking, idx) => (
                <div
                  key={`${ranking.card_name}-${idx}`}
                  className={`px-5 py-3 flex items-center justify-between ${
                    idx === 0 ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 text-sm font-medium text-gray-400">
                      {idx === 0 ? (
                        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ranking.card_color }}
                    />
                    <div>
                      <span className={`font-medium ${idx === 0 ? "text-foreground" : "text-gray-600 dark:text-gray-400"}`}>
                        {ranking.card_name}
                      </span>
                      {ranking.owner_name && (
                        <span className="text-xs text-gray-400 ml-2">{ranking.owner_name}</span>
                      )}
                      {ranking.notes && (
                        <span className="text-xs text-gray-400 ml-2">({ranking.notes})</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`font-bold text-lg ${
                      ranking.multiplier >= 4
                        ? "text-green-500"
                        : ranking.multiplier >= 2
                        ? "text-purple-600 dark:text-purple-400"
                        : "text-gray-500"
                    }`}
                  >
                    {ranking.multiplier}x
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
              No cards have multipliers for this category.
            </div>
          )}
        </div>
      )}

      {/* Divider before reference grid */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-gray-50 dark:bg-gray-950 text-sm text-gray-500 dark:text-gray-400">
            All Multipliers Reference
          </span>
        </div>
      </div>

      {/* Reference Grid Toggle */}
      <div className="flex gap-1 bg-gray-200 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setRefViewMode("category")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            refViewMode === "category"
              ? "bg-white dark:bg-gray-700 text-foreground shadow-sm"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          By Category
        </button>
        <button
          onClick={() => setRefViewMode("card")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            refViewMode === "card"
              ? "bg-white dark:bg-gray-700 text-foreground shadow-sm"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          By Card
        </button>
      </div>

      {refViewMode === "category" ? (
        /* Category View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayCategories.map((category) => {
            const multipliers = bestCardByCategory[category];
            if (!multipliers || multipliers.length === 0) return null;
            const best = multipliers[0];
            const others = multipliers.slice(1);

            return (
              <button
                key={category}
                onClick={() => handleSelectCategory(category)}
                className="text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="p-4 border-l-4" style={{ borderLeftColor: best.card.color }}>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Best for{" "}
                    <span className="font-medium text-foreground">{category}</span>
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
                            <span className="text-gray-600 dark:text-gray-400">
                              {m.card.name}
                            </span>
                          </div>
                          <span className="font-medium text-purple-500">{m.multiplier}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cardGroups.map(({ card, multipliers }) => (
            <div
              key={card.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="h-2" style={{ backgroundColor: card.color }} />
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{card.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {card.issuer} &bull; {card.owner.name}
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
                          idx < multipliers.length - 1
                            ? "border-b border-gray-100 dark:border-gray-700"
                            : ""
                        }`}
                      >
                        <div>
                          <span
                            className={`text-sm ${
                              isEverythingElse ? "text-gray-400" : "text-foreground"
                            }`}
                          >
                            {m.category}
                          </span>
                          {m.notes && (
                            <span className="text-xs text-gray-400 ml-1.5">({m.notes})</span>
                          )}
                        </div>
                        <span
                          className={`font-bold ${
                            isEverythingElse
                              ? "text-gray-400"
                              : m.multiplier >= 4
                              ? "text-green-500"
                              : m.multiplier >= 2
                              ? "text-purple-500"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
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
    </div>
  );
}
