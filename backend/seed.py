"""Seed the database with card templates and owner data from JSON files."""
import sys
import json
from pathlib import Path
from datetime import date

sys.path.insert(0, '.')

from app.database import SessionLocal, engine, Base
from app.models import (
    Owner,
    CardTemplate,
    TemplateBenefit,
    TemplateMultiplier,
    CreditCard,
    Benefit,
    PointMultiplier,
    BenefitPeriod,
    NotificationPreference,
    NotificationHistory,
    CurrencyWallet,
    CurrencyTransaction
)
from decimal import Decimal

# Paths
DATA_DIR = Path(__file__).parent / "data"
CARDS_DIR = DATA_DIR / "cards"
OWNERS_FILE = DATA_DIR / "owners.json"


def load_json(filepath: Path) -> dict:
    """Load a JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)


def period_from_string(period_str: str) -> BenefitPeriod:
    """Convert period string to BenefitPeriod enum."""
    return BenefitPeriod[period_str]


def seed_from_json():
    """Seed database from JSON card files and owners file."""
    # Drop all existing tables and recreate from scratch
    print("Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Track stats
        templates_created = 0
        template_benefits_created = 0
        template_multipliers_created = 0
        owners_created = 0
        cards_created = 0
        benefits_created = 0
        multipliers_created = 0
        wallets_created = 0
        wallet_transactions_created = 0

        # Store wallet config from templates
        template_wallet_configs = {}  # slug -> wallet config

        # Step 1: Load all card templates
        if not CARDS_DIR.exists():
            print(f"Error: Cards directory not found at {CARDS_DIR}")
            return

        json_files = list(CARDS_DIR.glob("*.json"))
        if not json_files:
            print(f"No JSON files found in {CARDS_DIR}")
            return

        print(f"\nStep 1: Loading {len(json_files)} card templates...\n")

        templates = {}  # slug -> CardTemplate
        for json_file in sorted(json_files):
            slug = json_file.stem  # filename without extension
            print(f"  Loading template: {slug}")
            card_data = load_json(json_file)

            # Create CardTemplate
            template = CardTemplate(
                slug=slug,
                name=card_data["name"],
                issuer=card_data["issuer"],
                annual_fee=Decimal(str(card_data.get("annual_fee", 0))),
                color=card_data.get("color", "#1f2937"),
                image=card_data.get("image"),
            )
            db.add(template)
            db.commit()
            db.refresh(template)
            templates[slug] = template
            templates_created += 1

            # Create TemplateBenefits
            for benefit_data in card_data.get("benefits", []):
                if benefit_data.get("value", 0) > 0:
                    template_benefit = TemplateBenefit(
                        template_id=template.id,
                        name=benefit_data["name"],
                        value=Decimal(str(benefit_data["value"])),
                        period=period_from_string(benefit_data["period"]),
                        category=benefit_data.get("category", "Other"),
                        description=benefit_data.get("description")
                    )
                    db.add(template_benefit)
                    template_benefits_created += 1

            # Create TemplateMultipliers
            for mult_data in card_data.get("multipliers", []):
                template_multiplier = TemplateMultiplier(
                    template_id=template.id,
                    category=mult_data["category"],
                    multiplier=Decimal(str(mult_data["multiplier"])),
                    notes=mult_data.get("notes")
                )
                db.add(template_multiplier)
                template_multipliers_created += 1

            # Store wallet config if present
            if "currency_wallet" in card_data:
                template_wallet_configs[slug] = card_data["currency_wallet"]

            db.commit()

        print(f"\n  Created {templates_created} templates with {template_benefits_created} benefits and {template_multipliers_created} multipliers\n")

        # Step 2: Load owners and assign cards
        if not OWNERS_FILE.exists():
            print(f"Error: Owners file not found at {OWNERS_FILE}")
            return

        owners_data = load_json(OWNERS_FILE)
        print(f"Step 2: Loading {len(owners_data['owners'])} owners and assigning cards...\n")

        for owner_data in owners_data["owners"]:
            owner_name = owner_data["name"]
            owner_email = owner_data.get("email")
            print(f"  Creating owner: {owner_name}")

            # Create Owner
            owner = Owner(
                name=owner_name,
                email=owner_email,
                notifications_enabled=True
            )
            db.add(owner)
            db.commit()
            db.refresh(owner)
            owners_created += 1

            # Create default NotificationPreference for owner
            notification_pref = NotificationPreference(
                owner_id=owner.id,
                email_enabled=True,
                push_enabled=True,
                monthly_reminder=True,
                expiry_3day_warning=True,
                expiry_final_day=True
            )
            db.add(notification_pref)
            db.commit()

            # Assign cards to owner
            for card_slug in owner_data.get("cards", []):
                if card_slug not in templates:
                    print(f"    Warning: Unknown card template '{card_slug}', skipping")
                    continue

                template = templates[card_slug]
                print(f"    Assigning card: {template.name}")

                # Create CreditCard instance for this owner
                card = CreditCard(
                    owner_id=owner.id,
                    template_id=template.id,
                )
                db.add(card)
                db.commit()
                db.refresh(card)
                cards_created += 1

                # Copy benefits from template
                for tb in template.template_benefits:
                    benefit = Benefit(
                        card_id=card.id,
                        name=tb.name,
                        value=tb.value,
                        period=tb.period,
                        category=tb.category,
                        description=tb.description,
                        is_skipped=False,
                        is_auto_use=False,
                    )
                    db.add(benefit)
                    benefits_created += 1

                # Copy multipliers from template
                for tm in template.template_multipliers:
                    multiplier = PointMultiplier(
                        card_id=card.id,
                        category=tm.category,
                        multiplier=tm.multiplier,
                        notes=tm.notes,
                    )
                    db.add(multiplier)
                    multipliers_created += 1

                # Create currency wallet if template has wallet config
                if card_slug in template_wallet_configs:
                    wallet_config = template_wallet_configs[card_slug]
                    print(f"      Creating wallet: {wallet_config['name']}")

                    wallet = CurrencyWallet(
                        owner_id=owner.id,
                        card_id=card.id,
                        currency_name=wallet_config["name"],
                        carryover_limit=Decimal(str(wallet_config.get("carryover_limit", 0))) if wallet_config.get("carryover_limit") else None,
                        redemption_channels=wallet_config.get("redemption_channels")
                    )
                    db.add(wallet)
                    db.commit()
                    db.refresh(wallet)
                    wallets_created += 1

                    # Create annual grant transactions that would have occurred this year
                    current_year = date.today().year
                    current_month = date.today().month

                    for grant in wallet_config.get("annual_grants", []):
                        grant_month = grant.get("month", 1)
                        # Only create grants for months that have passed (or current month)
                        if grant_month <= current_month:
                            grant_date = date(current_year, grant_month, 1)
                            transaction = CurrencyTransaction(
                                wallet_id=wallet.id,
                                amount=Decimal(str(grant["amount"])),
                                transaction_type="grant",
                                description=grant.get("description", "Annual grant"),
                                transaction_date=grant_date
                            )
                            db.add(transaction)
                            wallet_transactions_created += 1

                db.commit()

        print("\n" + "=" * 60)
        print("Database seeded successfully!")
        print("=" * 60)
        print(f"\nCard Templates: {templates_created}")
        print(f"  - Template Benefits: {template_benefits_created}")
        print(f"  - Template Multipliers: {template_multipliers_created}")
        print(f"\nOwners: {owners_created}")
        print(f"  - Owner Cards: {cards_created}")
        print(f"  - Card Benefits: {benefits_created}")
        print(f"  - Card Multipliers: {multipliers_created}")
        print(f"  - Currency Wallets: {wallets_created}")
        print(f"  - Wallet Transactions: {wallet_transactions_created}")
        print("=" * 60)

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_from_json()
