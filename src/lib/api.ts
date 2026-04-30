const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

// Types
export interface Owner {
  id: string;
  name: string;
  email: string | null;
  notifications_enabled: boolean;
  created_at: string;
  cards: CardBasic[];
}

export interface CardBasic {
  id: string;
  name: string;
  issuer: string;
  color: string;
}

export interface CardTemplate {
  id: string;
  slug: string;
  name: string;
  issuer: string;
  annual_fee: string;
  color: string;
  created_at: string;
  template_benefits: TemplateBenefit[];
  template_multipliers: TemplateMultiplier[];
}

export interface TemplateBenefit {
  id: string;
  name: string;
  value: string;
  period: string;
  category: string;
  description: string | null;
  benefit_type?: "PERIOD_CAPPED" | "UNLIMITED_USE";
}

export interface TemplateMultiplier {
  id: string;
  category: string;
  multiplier: string;
  notes: string | null;
}

export interface CreditCard {
  id: string;
  owner_id: string;
  template_id: string;
  name: string;
  issuer: string;
  annual_fee: string;
  last_four: string | null;
  color: string;
  annual_fee_date: string | null;
  created_at: string;
  owner: { id: string; name: string };
  template: { id: string; slug: string; name: string; issuer: string; annual_fee: string; color: string };
  benefits: BenefitBasic[];
  multipliers: MultiplierBasic[];
}

export interface BenefitBasic {
  id: string;
  name: string;
  value: string;
  period: string;
  category: string;
  benefit_type?: "PERIOD_CAPPED" | "UNLIMITED_USE";
  is_skipped?: boolean;
  is_auto_use?: boolean;
}

export interface MultiplierBasic {
  id: string;
  category: string;
  multiplier: string;
  notes: string | null;
}

export interface Benefit {
  id: string;
  card_id: string;
  name: string;
  value: string;
  period: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
  category: string;
  description: string | null;
  benefit_type: "PERIOD_CAPPED" | "UNLIMITED_USE";
  is_skipped: boolean;
  is_auto_use: boolean;
  created_at: string;
  card: CardBasic;
  usages: BenefitUsage[];
}

export interface BenefitUsage {
  id: string;
  period_start: string;
  period_end: string;
  used_amount: string;
  used_at: string;
}

export interface PointMultiplier {
  id: string;
  card_id: string;
  category: string;
  multiplier: string;
  notes: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_cards: number;
  total_annual_fees: string;
  total_benefits_value: string;
  benefits_used_this_period: string;
  utilization_rate: number;
}

export interface ExpiringBenefit {
  id: string;
  name: string;
  value: string;
  period: string;
  days_remaining: number;
  card_name: string;
  card_color: string;
  owner_name: string;
}

export interface CardAnalysis {
  id: string;
  name: string;
  issuer: string;
  color: string;
  owner_name: string;
  annual_fee: string;
  total_benefits_value: string;
  benefits_used: string;
  utilization_rate: number;
  net_value: string;
  wallet_annual_value: string;
  wallet_used: string;
  has_wallet: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  response: string;
  configured: boolean;
}

export interface AIStatus {
  configured: boolean;
  model: string | null;
}

export interface CardRanking {
  card_name: string;
  card_color: string;
  owner_name: string;
  multiplier: number;
  notes: string | null;
}

export interface SpendingLookupResponse {
  query: string;
  matched_category: string;
  match_type: "exact" | "ai" | "fallback";
  rankings: CardRanking[];
  ai_reasoning: string | null;
  configured: boolean;
}

// Wallet types
export interface MonthlyUsage {
  month: number;
  month_name: string;
  used: string;
  is_current: boolean;
  is_past: boolean;
  is_completed: boolean;
}

export interface ChannelStatus {
  category: string;
  monthly_limit: string;
  description: string | null;
  used_this_month: string;
  remaining: string;
  monthly_history: MonthlyUsage[];
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: string;
  transaction_type: string;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

export interface WalletCardBasic {
  id: string;
  name: string;
  color: string;
}

export interface Wallet {
  id: string;
  owner_id: string;
  card_id: string;
  currency_name: string;
  carryover_limit: string | null;
  redemption_channels: Array<{
    category: string;
    monthly_limit: number;
    description: string;
  }> | null;
  current_balance: string;
  created_at: string;
  card: WalletCardBasic | null;
  transactions: WalletTransaction[];
  monthly_channel_status: ChannelStatus[];
  must_spend_by_year_end: string;
  months_remaining: number;
  max_spendable_this_year: string;
  on_track: boolean;
}

// ── RAG types ─────────────────────────────────────────────────────────────────

export interface RAGSource {
  text: string;
  card_name: string;
  source_file: string;
  page: string;
  score: number | null;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  detected_cards: string[];
}

const RAG_URL = process.env.NEXT_PUBLIC_RAG_SERVICE_URL ?? "";

export const ragApi = {
  query: (question: string): Promise<RAGResponse> =>
    fetch(`${RAG_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }).then((r) => {
      if (!r.ok) throw new Error(`RAG error: ${r.status}`);
      return r.json();
    }),
};

// API functions
export const api = {
  // Owners
  getOwners: () => fetchAPI<Owner[]>("/owners/"),
  createOwner: (name: string) =>
    fetchAPI<Owner>("/owners/", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateOwner: (id: string, data: { name?: string; email?: string; notifications_enabled?: boolean }) =>
    fetchAPI<Owner>(`/owners/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteOwner: (id: string) =>
    fetchAPI(`/owners/${id}`, { method: "DELETE" }),

  // Notifications
  sendNotificationToOwner: (ownerId: string, type: string = "monthly_reminder") =>
    fetchAPI<{ success: boolean; message: string }>(`/notifications/send/${ownerId}?notification_type=${type}`, {
      method: "POST",
    }),

  // Card Templates (all supported cards)
  getCardTemplates: () => fetchAPI<CardTemplate[]>("/card-templates/"),
  getCardTemplate: (id: string) => fetchAPI<CardTemplate>(`/card-templates/${id}`),

  // Cards (owner's cards)
  getCards: (ownerId?: string) =>
    fetchAPI<CreditCard[]>(`/cards/${ownerId ? `?owner_id=${ownerId}` : ""}`),
  getCard: (id: string) => fetchAPI<CreditCard>(`/cards/${id}`),
  assignCardToOwner: (data: {
    owner_id: string;
    template_id: string;
    last_four?: string;
  }) =>
    fetchAPI<CreditCard>("/cards/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCard: (id: string, data: { last_four?: string; annual_fee_date?: string }) =>
    fetchAPI<CreditCard>(`/cards/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  removeCardFromOwner: (id: string) =>
    fetchAPI(`/cards/${id}`, { method: "DELETE" }),

  // Benefits
  getBenefits: (cardId?: string) =>
    fetchAPI<Benefit[]>(`/benefits/${cardId ? `?card_id=${cardId}` : ""}`),
  createBenefit: (data: {
    card_id: string;
    name: string;
    value: number;
    period: string;
    category: string;
    description?: string;
  }) =>
    fetchAPI<Benefit>("/benefits/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBenefit: (id: string, data: { is_skipped?: boolean; is_auto_use?: boolean }) =>
    fetchAPI<Benefit>(`/benefits/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteBenefit: (id: string) =>
    fetchAPI(`/benefits/${id}`, { method: "DELETE" }),

  // Benefit Usages
  createBenefitUsage: (data: {
    benefit_id: string;
    period_start: string;
    period_end: string;
    used_amount: number;
    notes?: string;
  }) =>
    fetchAPI<BenefitUsage>("/benefit-usages/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteBenefitUsage: (id: string) =>
    fetchAPI(`/benefit-usages/${id}`, { method: "DELETE" }),

  // Multipliers
  getMultipliers: (cardId?: string) =>
    fetchAPI<PointMultiplier[]>(
      `/multipliers/${cardId ? `?card_id=${cardId}` : ""}`
    ),
  createMultiplier: (data: {
    card_id: string;
    category: string;
    multiplier: number;
    notes?: string;
  }) =>
    fetchAPI<PointMultiplier>("/multipliers/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteMultiplier: (id: string) =>
    fetchAPI(`/multipliers/${id}`, { method: "DELETE" }),

  // Dashboard
  getDashboardStats: (ownerId?: string) =>
    fetchAPI<DashboardStats>(
      `/dashboard/stats${ownerId ? `?owner_id=${ownerId}` : ""}`
    ),
  getExpiringBenefits: (ownerId?: string) =>
    fetchAPI<ExpiringBenefit[]>(
      `/dashboard/expiring-benefits${ownerId ? `?owner_id=${ownerId}` : ""}`
    ),
  getCardAnalysis: (ownerId?: string) =>
    fetchAPI<CardAnalysis[]>(
      `/dashboard/card-analysis${ownerId ? `?owner_id=${ownerId}` : ""}`
    ),

  // AI
  getAIStatus: () => fetchAPI<AIStatus>("/ai/status"),
  chat: (ownerId: string, message: string, history?: ChatMessage[]) =>
    fetchAPI<ChatResponse>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        owner_id: ownerId,
        message,
        history,
      }),
    }),
  getInsights: (ownerId: string) =>
    fetchAPI<{ insights: string | null; configured: boolean }>("/ai/insights", {
      method: "POST",
      body: JSON.stringify({ owner_id: ownerId }),
    }),
  getCardRecommendation: (ownerId: string, category: string) =>
    fetchAPI<{ category: string; recommendation: string; configured: boolean }>(
      "/ai/recommend-card",
      {
        method: "POST",
        body: JSON.stringify({ owner_id: ownerId, category }),
      }
    ),
  spendingLookup: (query: string, useAI: boolean = true) =>
    fetchAPI<SpendingLookupResponse>("/ai/spending-lookup", {
      method: "POST",
      body: JSON.stringify({ query, use_ai: useAI }),
    }),

  // Wallets
  getAllWallets: () =>
    fetchAPI<Wallet[]>("/wallets/"),
  getWalletsForOwner: (ownerId: string) =>
    fetchAPI<Wallet[]>(`/wallets/owner/${ownerId}`),
  getWallet: (walletId: string) =>
    fetchAPI<Wallet>(`/wallets/${walletId}`),
  createWallet: (data: {
    owner_id: string;
    card_id: string;
    currency_name: string;
    carryover_limit?: number;
    redemption_channels?: Array<{
      category: string;
      monthly_limit: number;
      description: string;
    }>;
    initial_balance?: number;
  }) =>
    fetchAPI<Wallet>("/wallets/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  addWalletTransaction: (walletId: string, data: {
    amount: number;
    transaction_type: string;
    category?: string;
    description?: string;
    transaction_date?: string;
  }) =>
    fetchAPI<WalletTransaction>(`/wallets/${walletId}/transactions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteWalletTransaction: (transactionId: string) =>
    fetchAPI(`/wallets/transactions/${transactionId}`, { method: "DELETE" }),
};
