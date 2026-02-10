"use client";

import { useState, useEffect } from "react";
import { api, Owner, CardTemplate } from "@/lib/api";

function formatPeriod(period: string): string {
  switch (period) {
    case "MONTHLY": return "month";
    case "QUARTERLY": return "quarter";
    case "SEMI_ANNUAL": return "half";
    case "ANNUAL": return "year";
    default: return period.toLowerCase();
  }
}

export default function ManagePage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate | null>(null);
  const [assigningCard, setAssigningCard] = useState<{
    ownerId: string;
    templateId: string;
  } | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ownersData, templatesData] = await Promise.all([
        api.getOwners(),
        api.getCardTemplates(),
      ]);
      setOwners(ownersData);
      setTemplates(templatesData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCard = async (ownerId: string, templateId: string) => {
    setAssigningCard({ ownerId, templateId });
    try {
      await api.assignCardToOwner({ owner_id: ownerId, template_id: templateId });
      await loadData();
    } catch (error) {
      console.error("Failed to assign card:", error);
      alert("Failed to assign card. The owner may already have this card.");
    } finally {
      setAssigningCard(null);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    if (!confirm("Are you sure you want to remove this card? All benefit tracking data will be lost.")) {
      return;
    }
    try {
      await api.removeCardFromOwner(cardId);
      await loadData();
    } catch (error) {
      console.error("Failed to remove card:", error);
    }
  };

  const handleUpdateEmail = async (ownerId: string) => {
    try {
      await api.updateOwner(ownerId, { email: emailInput || undefined });
      await loadData();
      setEditingEmail(null);
      setEmailInput("");
    } catch (error) {
      console.error("Failed to update email:", error);
      alert("Failed to update email");
    }
  };

  const handleSendEmail = async (ownerId: string) => {
    setSendingEmail(ownerId);
    try {
      const result = await api.sendNotificationToOwner(ownerId);
      alert(result.message);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send email";
      alert(errorMessage);
    } finally {
      setSendingEmail(null);
    }
  };

  const getOwnerCards = (owner: Owner) => {
    return owner.cards || [];
  };

  const getAvailableTemplatesForOwner = (owner: Owner) => {
    const ownerCardNames = getOwnerCards(owner).map((c) => c.name);
    return templates.filter((t) => !ownerCardNames.includes(t.name));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manage Cards</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          View supported cards and manage card assignments for each user
        </p>
      </div>

      {/* Supported Cards */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Supported Cards ({templates.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
            >
              <div
                className="h-2"
                style={{ backgroundColor: template.color }}
              />
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-foreground">{template.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {template.issuer}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    ${parseFloat(template.annual_fee).toFixed(0)}/yr
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                    {template.template_benefits.length} benefits
                  </span>
                  <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full">
                    {template.template_multipliers.length} multipliers
                  </span>
                </div>
                {/* Total benefit value */}
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  ~${template.template_benefits
                    .filter(b => b.benefit_type !== "UNLIMITED_USE")
                    .reduce((sum, b) => {
                      const value = parseFloat(b.value);
                      const multiplier = b.period === "MONTHLY" ? 12 : b.period === "QUARTERLY" ? 4 : b.period === "SEMI_ANNUAL" ? 2 : 1;
                      return sum + value * multiplier;
                    }, 0).toFixed(0)}/yr in benefits
                  {template.template_benefits.some(b => b.benefit_type === "UNLIMITED_USE") && " + unlimited"}
                </div>
                <div className="mt-2 text-xs text-blue-500 dark:text-blue-400">
                  Click for details →
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Users and Their Cards */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Users & Their Cards
        </h2>
        <div className="space-y-6">
          {owners.map((owner) => {
            const ownerCards = getOwnerCards(owner);
            const availableTemplates = getAvailableTemplatesForOwner(owner);

            return (
              <div
                key={owner.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {owner.name}
                    </h3>
                    {/* Email Section */}
                    <div className="mt-1">
                      {editingEmail === owner.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder="email@example.com"
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-foreground"
                          />
                          <button
                            onClick={() => handleUpdateEmail(owner.id)}
                            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingEmail(null); setEmailInput(""); }}
                            className="text-xs px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {owner.email || "No email set"}
                          </span>
                          <button
                            onClick={() => { setEditingEmail(owner.id); setEmailInput(owner.email || ""); }}
                            className="text-xs text-blue-500 hover:text-blue-600"
                          >
                            {owner.email ? "Edit" : "Add email"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {ownerCards.length} card{ownerCards.length !== 1 ? "s" : ""}
                    </span>
                    {owner.email && (
                      <button
                        onClick={() => handleSendEmail(owner.id)}
                        disabled={sendingEmail === owner.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 transition-colors"
                      >
                        {sendingEmail === owner.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Send Reminder
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Owner's Cards */}
                {ownerCards.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {ownerCards.map((card) => (
                        <div
                          key={card.id}
                          className="group relative flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600"
                          style={{ borderLeftColor: card.color, borderLeftWidth: "3px" }}
                        >
                          <span className="text-sm font-medium text-foreground">
                            {card.name}
                          </span>
                          <button
                            onClick={() => handleRemoveCard(card.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove card"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
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
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Card Dropdown */}
                {availableTemplates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignCard(owner.id, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      disabled={assigningCard?.ownerId === owner.id}
                    >
                      <option value="">+ Add a card...</option>
                      {availableTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.issuer})
                        </option>
                      ))}
                    </select>
                    {assigningCard?.ownerId === owner.id && (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    )}
                  </div>
                )}

                {availableTemplates.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    All available cards have been assigned
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Card Template Detail Modal */}
      {selectedTemplate && (
        <CardTemplateModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </div>
  );
}

function CardTemplateModal({
  template,
  onClose,
}: {
  template: CardTemplate;
  onClose: () => void;
}) {
  // Only count period-capped benefits for annual value (unlimited benefits are variable)
  const periodCappedBenefits = template.template_benefits.filter(b => b.benefit_type !== "UNLIMITED_USE");
  const unlimitedBenefits = template.template_benefits.filter(b => b.benefit_type === "UNLIMITED_USE");

  const totalAnnualValue = periodCappedBenefits.reduce((sum, b) => {
    const value = parseFloat(b.value);
    const multiplier = b.period === "MONTHLY" ? 12 : b.period === "QUARTERLY" ? 4 : b.period === "SEMI_ANNUAL" ? 2 : 1;
    return sum + value * multiplier;
  }, 0);

  const netValue = totalAnnualValue - parseFloat(template.annual_fee);
  const hasUnlimited = unlimitedBenefits.length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative">
          <div
            className="h-3"
            style={{ backgroundColor: template.color }}
          />
          <div className="p-5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{template.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{template.issuer}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Annual Fee</div>
                <div className="text-lg font-bold text-red-500">${parseFloat(template.annual_fee).toFixed(0)}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Benefits Value</div>
                <div className="text-lg font-bold text-green-500">
                  ${totalAnnualValue.toFixed(0)}{hasUnlimited && "+"}
                </div>
              </div>
              <div className={`${netValue >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"} rounded-lg p-3 text-center`}>
                <div className="text-xs text-gray-500 dark:text-gray-400">Net Value</div>
                <div className={`text-lg font-bold ${netValue >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {netValue >= 0 ? "+" : ""}${netValue.toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* Benefits */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Benefits ({template.template_benefits.length})
            </h3>
            <div className="space-y-2">
              {template.template_benefits.map((benefit) => {
                const isUnlimited = benefit.benefit_type === "UNLIMITED_USE";
                const annualValue = parseFloat(benefit.value) *
                  (benefit.period === "MONTHLY" ? 12 : benefit.period === "QUARTERLY" ? 4 : benefit.period === "SEMI_ANNUAL" ? 2 : 1);

                return (
                  <div
                    key={benefit.id}
                    className={`rounded-lg p-3 ${isUnlimited ? "bg-purple-50 dark:bg-purple-900/20" : "bg-gray-50 dark:bg-gray-800"}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">{benefit.name}</span>
                          {isUnlimited && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 font-medium">
                              Unlimited
                            </span>
                          )}
                        </div>
                        {benefit.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {benefit.description}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        {isUnlimited ? (
                          <div className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                            ${parseFloat(benefit.value).toFixed(0)}/use
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                              ${parseFloat(benefit.value).toFixed(0)}/{formatPeriod(benefit.period)}
                            </div>
                            {benefit.period !== "ANNUAL" && (
                              <div className="text-xs text-gray-400">
                                ${annualValue.toFixed(0)}/yr
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                        {benefit.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Multipliers */}
          {template.template_multipliers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                Point Multipliers ({template.template_multipliers.length})
              </h3>
              <div className="space-y-2">
                {template.template_multipliers.map((mult) => (
                  <div
                    key={mult.id}
                    className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                  >
                    <div>
                      <div className="font-medium text-foreground text-sm">{mult.category}</div>
                      {mult.notes && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{mult.notes}</div>
                      )}
                    </div>
                    <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                      {parseFloat(mult.multiplier)}x
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
