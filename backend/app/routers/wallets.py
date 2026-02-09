"""API endpoints for currency wallets (e.g., Bilt Cash)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, extract
from typing import List
from decimal import Decimal
from datetime import date

from app.database import get_db
from app.models import CurrencyWallet, CurrencyTransaction, CreditCard
from app.schemas.currency_wallet import (
    WalletCreate,
    WalletResponse,
    WalletWithDetails,
    TransactionCreate,
    TransactionResponse,
    ChannelStatus,
    CardBasicForWallet,
    MonthlyUsage
)
from app.utils import get_current_date

router = APIRouter(prefix="/wallets", tags=["wallets"])


@router.get("/", response_model=List[WalletWithDetails])
def get_all_wallets(db: Session = Depends(get_db)):
    """Get all currency wallets with full details."""
    wallets = db.query(CurrencyWallet).all()
    return [_build_wallet_details(wallet, db) for wallet in wallets]


@router.get("/owner/{owner_id}", response_model=List[WalletWithDetails])
def get_wallets_for_owner(owner_id: str, db: Session = Depends(get_db)):
    """Get all currency wallets for an owner with full details."""
    wallets = db.query(CurrencyWallet).filter(
        CurrencyWallet.owner_id == owner_id
    ).all()

    return [_build_wallet_details(wallet, db) for wallet in wallets]


@router.get("/{wallet_id}", response_model=WalletWithDetails)
def get_wallet(wallet_id: str, db: Session = Depends(get_db)):
    """Get a specific wallet with full details."""
    wallet = db.query(CurrencyWallet).filter(CurrencyWallet.id == wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    return _build_wallet_details(wallet, db)


@router.post("/", response_model=WalletResponse)
def create_wallet(wallet_data: WalletCreate, db: Session = Depends(get_db)):
    """Create a new currency wallet."""
    # Check if wallet already exists for this card/currency
    existing = db.query(CurrencyWallet).filter(
        and_(
            CurrencyWallet.owner_id == wallet_data.owner_id,
            CurrencyWallet.card_id == wallet_data.card_id,
            CurrencyWallet.currency_name == wallet_data.currency_name
        )
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Wallet already exists for this card and currency")

    wallet = CurrencyWallet(
        owner_id=wallet_data.owner_id,
        card_id=wallet_data.card_id,
        currency_name=wallet_data.currency_name,
        carryover_limit=wallet_data.carryover_limit,
        redemption_channels=wallet_data.redemption_channels
    )
    db.add(wallet)
    db.flush()

    # Create initial balance transaction if specified
    if wallet_data.initial_balance and wallet_data.initial_balance > 0:
        transaction = CurrencyTransaction(
            wallet_id=wallet.id,
            amount=wallet_data.initial_balance,
            transaction_type="grant",
            description="Initial balance",
            transaction_date=get_current_date()
        )
        db.add(transaction)

    db.commit()
    db.refresh(wallet)

    # Calculate current balance
    balance = sum(t.amount for t in wallet.transactions)

    return WalletResponse(
        id=wallet.id,
        owner_id=wallet.owner_id,
        card_id=wallet.card_id,
        currency_name=wallet.currency_name,
        carryover_limit=wallet.carryover_limit,
        redemption_channels=wallet.redemption_channels,
        current_balance=balance,
        created_at=wallet.created_at
    )


@router.post("/{wallet_id}/transactions", response_model=TransactionResponse)
def add_transaction(wallet_id: str, tx_data: TransactionCreate, db: Session = Depends(get_db)):
    """Add a transaction to a wallet (credit or redemption)."""
    wallet = db.query(CurrencyWallet).filter(CurrencyWallet.id == wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    # For redemptions, validate against monthly limit
    if tx_data.transaction_type == "redemption":
        if tx_data.amount > 0:
            tx_data.amount = -tx_data.amount  # Ensure negative for redemptions

        if not tx_data.category:
            raise HTTPException(status_code=400, detail="Category required for redemptions")

        # Check monthly limit for this category
        if wallet.redemption_channels:
            channel = next(
                (c for c in wallet.redemption_channels if c.get("category") == tx_data.category),
                None
            )
            if channel:
                monthly_limit = Decimal(str(channel.get("monthly_limit", 0)))
                tx_date = tx_data.transaction_date or get_current_date()

                # Calculate used this month for this category
                used_this_month = db.query(CurrencyTransaction).filter(
                    and_(
                        CurrencyTransaction.wallet_id == wallet_id,
                        CurrencyTransaction.category == tx_data.category,
                        CurrencyTransaction.transaction_type == "redemption",
                        extract("year", CurrencyTransaction.transaction_date) == tx_date.year,
                        extract("month", CurrencyTransaction.transaction_date) == tx_date.month
                    )
                ).all()

                total_used = sum(abs(t.amount) for t in used_this_month)
                new_total = total_used + abs(tx_data.amount)

                if new_total > monthly_limit:
                    remaining = monthly_limit - total_used
                    raise HTTPException(
                        status_code=400,
                        detail=f"Monthly limit exceeded for {tx_data.category}. Remaining: ${remaining}"
                    )

    transaction = CurrencyTransaction(
        wallet_id=wallet_id,
        amount=tx_data.amount,
        transaction_type=tx_data.transaction_type,
        category=tx_data.category,
        description=tx_data.description,
        transaction_date=tx_data.transaction_date or get_current_date()
    )

    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return TransactionResponse.model_validate(transaction)


@router.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: str, db: Session = Depends(get_db)):
    """Delete a transaction."""
    transaction = db.query(CurrencyTransaction).filter(
        CurrencyTransaction.id == transaction_id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(transaction)
    db.commit()

    return {"message": "Transaction deleted"}


def _build_wallet_details(wallet: CurrencyWallet, db: Session) -> WalletWithDetails:
    """Build wallet response with all calculated fields."""
    current_date = get_current_date()
    current_year = current_date.year
    current_month = current_date.month

    # Get all transactions
    transactions = db.query(CurrencyTransaction).filter(
        CurrencyTransaction.wallet_id == wallet.id
    ).order_by(CurrencyTransaction.transaction_date.desc()).all()

    # Calculate current balance
    balance = sum(t.amount for t in transactions)

    # Calculate monthly channel status with history
    channel_status = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    if wallet.redemption_channels:
        for channel in wallet.redemption_channels:
            category = channel.get("category")
            monthly_limit = Decimal(str(channel.get("monthly_limit", 0)))

            # Sum redemptions for this category this month
            used_this_month = sum(
                abs(t.amount) for t in transactions
                if t.category == category
                and t.transaction_type == "redemption"
                and t.transaction_date.year == current_year
                and t.transaction_date.month == current_month
            )

            # Build monthly history for the year
            monthly_history = []
            for month in range(1, 13):
                month_used = sum(
                    abs(t.amount) for t in transactions
                    if t.category == category
                    and t.transaction_type == "redemption"
                    and t.transaction_date.year == current_year
                    and t.transaction_date.month == month
                )
                is_current = month == current_month
                is_past = month < current_month
                is_completed = (is_current or is_past) and month_used >= monthly_limit

                monthly_history.append(MonthlyUsage(
                    month=month,
                    month_name=month_names[month - 1],
                    used=month_used,
                    is_current=is_current,
                    is_past=is_past,
                    is_completed=is_completed
                ))

            channel_status.append(ChannelStatus(
                category=category,
                monthly_limit=monthly_limit,
                description=channel.get("description"),
                used_this_month=used_this_month,
                remaining=max(Decimal(0), monthly_limit - used_this_month),
                monthly_history=monthly_history
            ))

    # Calculate year-end projections
    carryover_limit = wallet.carryover_limit or Decimal(0)
    must_spend = max(Decimal(0), balance - carryover_limit)
    months_remaining = 12 - current_month + 1

    monthly_capacity = sum(
        Decimal(str(c.get("monthly_limit", 0)))
        for c in (wallet.redemption_channels or [])
    )
    max_spendable = monthly_capacity * months_remaining
    on_track = max_spendable >= must_spend

    # Get card info
    card = db.query(CreditCard).filter(CreditCard.id == wallet.card_id).first()
    card_info = CardBasicForWallet(
        id=card.id,
        name=card.name,
        color=card.color
    ) if card else None

    return WalletWithDetails(
        id=wallet.id,
        owner_id=wallet.owner_id,
        card_id=wallet.card_id,
        currency_name=wallet.currency_name,
        carryover_limit=wallet.carryover_limit,
        redemption_channels=wallet.redemption_channels,
        current_balance=balance,
        created_at=wallet.created_at,
        card=card_info,
        transactions=[TransactionResponse.model_validate(t) for t in transactions],
        monthly_channel_status=channel_status,
        must_spend_by_year_end=must_spend,
        months_remaining=months_remaining,
        max_spendable_this_year=max_spendable,
        on_track=on_track
    )
