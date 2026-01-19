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
  is_skipped?: boolean;
  is_auto_use?: boolean;
}

export interface MultiplierBasic {
  id: string;
  category: string;
  multiplier: string;
}

export interface Benefit {
  id: string;
  card_id: string;
  name: string;
  value: string;
  period: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
  category: string;
  description: string | null;
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
}

// API functions
export const api = {
  // Owners
  getOwners: () => fetchAPI<Owner[]>("/owners/"),
  createOwner: (name: string) =>
    fetchAPI<Owner>("/owners/", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteOwner: (id: string) =>
    fetchAPI(`/owners/${id}`, { method: "DELETE" }),

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
};
