export type BenefitPeriod = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";

export function getCurrentPeriodDates(period: BenefitPeriod): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case "MONTHLY":
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0),
      };
    case "QUARTERLY": {
      const quarter = Math.floor(month / 3);
      return {
        start: new Date(year, quarter * 3, 1),
        end: new Date(year, quarter * 3 + 3, 0),
      };
    }
    case "SEMI_ANNUAL": {
      const half = Math.floor(month / 6);
      return {
        start: new Date(year, half * 6, 1),
        end: new Date(year, half * 6 + 6, 0),
      };
    }
    case "ANNUAL":
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31),
      };
  }
}

export function getDaysRemaining(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export function formatPeriod(period: BenefitPeriod): string {
  switch (period) {
    case "MONTHLY":
      return "Monthly";
    case "QUARTERLY":
      return "Quarterly";
    case "SEMI_ANNUAL":
      return "Semi-Annual";
    case "ANNUAL":
      return "Annual";
  }
}

export function getAnnualValue(value: number, period: BenefitPeriod): number {
  switch (period) {
    case "MONTHLY":
      return value * 12;
    case "QUARTERLY":
      return value * 4;
    case "SEMI_ANNUAL":
      return value * 2;
    case "ANNUAL":
      return value;
  }
}

export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
