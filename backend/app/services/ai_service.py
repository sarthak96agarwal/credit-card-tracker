"""AI service using Google Gemini for insights and chat."""
import os
import json
import logging
from typing import List, Optional, Dict
from decimal import Decimal
import google.generativeai as genai

logger = logging.getLogger(__name__)


class AIService:
    """Service for AI-powered insights and chat using Gemini."""

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(self.model_name)
        else:
            self.model = None
            logger.warning("Gemini API key not configured")

    def is_configured(self) -> bool:
        """Check if Gemini is properly configured."""
        return self.api_key is not None

    def _build_benefits_context(self, benefits_data: dict, owner_name: str) -> str:
        """Build context string from benefits data for the AI."""
        monthly = benefits_data.get("monthly", [])
        yearly = benefits_data.get("yearly", [])

        context_parts = [f"User: {owner_name}\n"]

        # Monthly benefits
        if monthly:
            context_parts.append("MONTHLY BENEFITS (expiring this month):")
            for card in monthly:
                context_parts.append(f"\n  Card: {card['card_name']}")
                for b in card["benefits"]:
                    context_parts.append(
                        f"    - {b['name']}: ${b['remaining']:.2f} remaining "
                        f"(of ${b['value']:.2f}), expires {b['expiry_date']}"
                    )

        # Yearly benefits
        if yearly:
            context_parts.append("\nYEARLY BENEFITS (remaining this year):")
            for card in yearly:
                context_parts.append(f"\n  Card: {card['card_name']}")
                for b in card["benefits"]:
                    period_label = {
                        "QUARTERLY": "Quarterly",
                        "SEMI_ANNUAL": "Semi-Annual",
                        "ANNUAL": "Annual"
                    }.get(b["period"], b["period"])
                    context_parts.append(
                        f"    - {b['name']}: ${b['remaining']:.2f} remaining "
                        f"({period_label}), expires {b['expiry_date']}"
                    )

        # Calculate totals
        monthly_total = sum(
            sum(b["remaining"] for b in card["benefits"])
            for card in monthly
        )
        yearly_total = sum(
            sum(b["remaining"] for b in card["benefits"])
            for card in yearly
        )

        context_parts.append(f"\nTOTALS:")
        context_parts.append(f"  Monthly expiring: ${monthly_total:.2f}")
        context_parts.append(f"  Yearly remaining: ${yearly_total:.2f}")
        context_parts.append(f"  Grand total: ${monthly_total + yearly_total:.2f}")

        return "\n".join(context_parts)

    def generate_email_insights(
        self,
        benefits_data: dict,
        owner_name: str
    ) -> Optional[str]:
        """Generate personalized insights for the monthly reminder email."""
        if not self.is_configured():
            logger.warning("Gemini not configured, skipping insights")
            return None

        context = self._build_benefits_context(benefits_data, owner_name)

        prompt = f"""You are a helpful credit card benefits assistant. Based on the user's unused benefits below, write 2-3 SHORT, actionable insights.

{context}

Guidelines:
- Be friendly and encouraging, address the user by first name
- Focus on urgency for monthly expiring benefits
- Give specific suggestions (e.g., "Use your $15 Uber credit for a ride or Uber Eats order")
- Keep each insight to 1-2 sentences max
- Don't repeat the numbers - the user will see them in the email
- Use bullet points
- Total response should be under 100 words

Write the insights:"""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            return None

    def _build_multipliers_context(self, cards_data: List[dict]) -> str:
        """Build context string from card multipliers."""
        if not cards_data:
            return ""

        context_parts = ["\nCARD MULTIPLIERS (points/miles per dollar):"]
        for card in cards_data:
            if card.get("multipliers"):
                context_parts.append(f"\n  {card['name']}:")
                for mult in card["multipliers"]:
                    context_parts.append(f"    - {mult['category']}: {mult['multiplier']}x")

        return "\n".join(context_parts)

    def chat(
        self,
        message: str,
        benefits_data: dict,
        owner_name: str,
        cards_data: Optional[List[dict]] = None,
        chat_history: Optional[List[dict]] = None
    ) -> str:
        """Chat with the AI about benefits."""
        if not self.is_configured():
            return "AI assistant is not configured. Please set up the Gemini API key."

        context = self._build_benefits_context(benefits_data, owner_name)
        if cards_data:
            context += self._build_multipliers_context(cards_data)

        system_prompt = f"""You are a helpful credit card benefits assistant for {owner_name}. You help users understand and maximize their credit card benefits.

Current data:
{context}

Guidelines:
- Be concise and helpful
- Answer questions about their specific benefits
- Suggest which card to use for different purchases based on the multipliers shown above
- Remind them about expiring benefits when relevant
- If asked about cards/benefits they don't have, say you don't see that in their portfolio
- Keep responses under 150 words unless more detail is needed"""

        # Build conversation
        messages = [{"role": "user", "parts": [system_prompt + "\n\nUser: " + message]}]

        # Add chat history if provided
        if chat_history:
            history_text = "\n\nPrevious conversation:\n"
            for msg in chat_history[-5:]:  # Last 5 messages for context
                role = "User" if msg["role"] == "user" else "Assistant"
                history_text += f"{role}: {msg['content']}\n"
            messages[0]["parts"][0] = system_prompt + history_text + "\n\nUser: " + message

        try:
            response = self.model.generate_content(messages[0]["parts"][0])
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error in chat: {e}")
            return "Sorry, I encountered an error. Please try again."

    def resolve_spending_category(
        self,
        query: str,
        available_categories: List[str]
    ) -> Optional[Dict[str, str]]:
        """Use LLM to resolve a free-text spending query to a known category.

        Returns dict with 'category' and 'reasoning', or None on failure.
        """
        if not self.is_configured():
            return None

        categories_str = ", ".join(available_categories)
        prompt = f"""You are a spending category classifier. Given a user's description of a purchase, determine which credit card spending category it belongs to.

Available categories: {categories_str}

User query: "{query}"

Respond with ONLY valid JSON in this exact format:
{{"category": "matched category from the list above", "reasoning": "one sentence explanation"}}

Rules:
- You MUST pick a category from the available list above
- If the query clearly matches a category, use that category
- If unsure, use "Everything Else"
- Do not invent new categories"""

        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3].strip()
                elif "```" in text:
                    text = text[:text.rfind("```")].strip()

            result = json.loads(text)
            if result.get("category") in available_categories:
                return result
            logger.warning(f"LLM returned invalid category: {result.get('category')}")
            return None
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Error resolving spending category: {e}")
            return None

    def get_card_recommendation(
        self,
        purchase_category: str,
        cards_data: List[dict]
    ) -> str:
        """Get recommendation for which card to use for a purchase category."""
        if not self.is_configured():
            return "AI assistant is not configured."

        # Build cards context with multipliers
        cards_context = "Available cards and their multipliers:\n"
        for card in cards_data:
            cards_context += f"\n{card['name']}:\n"
            for mult in card.get("multipliers", []):
                cards_context += f"  - {mult['category']}: {mult['multiplier']}x"
                if mult.get("notes"):
                    cards_context += f" ({mult['notes']})"
                cards_context += "\n"

        prompt = f"""{cards_context}

Question: Which card should I use for {purchase_category}?

Give a brief recommendation (2-3 sentences max) explaining which card is best and why."""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error getting recommendation: {e}")
            return "Sorry, I couldn't generate a recommendation."


# Singleton instance
ai_service = AIService()
