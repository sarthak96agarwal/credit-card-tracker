"""Show database structure and data."""
from app.database import SessionLocal
from app.models import Benefit, BenefitUsage
from sqlalchemy import inspect

db = SessionLocal()

# Show benefit_usages table structure
print('=== BENEFIT_USAGES TABLE STRUCTURE ===')
inspector = inspect(BenefitUsage)
for column in inspector.columns:
    print(f'{column.name}: {column.type}')

print('\n=== ALL BENEFIT USAGES (chronological) ===')
usages = db.query(BenefitUsage).order_by(BenefitUsage.period_start).all()
for u in usages:
    print(f'Benefit: {u.benefit.name} ({u.benefit.card.name})')
    print(f'  Period: {u.period_start.strftime("%Y-%m-%d")} to {u.period_end.strftime("%Y-%m-%d")}')
    print(f'  Used: ${u.used_amount}')
    print(f'  Date used: {u.used_at.strftime("%Y-%m-%d")}')
    print()

# Find auto-use benefits
print('=== AUTO-USE BENEFITS ===')
auto_benefits = db.query(Benefit).filter(Benefit.is_auto_use == True).all()
if auto_benefits:
    for b in auto_benefits:
        print(f'{b.name} ({b.card.name})')
        print(f'  Period: {b.period}, Value: ${b.value}')
        print(f'  Number of usage records: {len(b.usages)}')
        for usage in b.usages:
            print(f'    - {usage.period_start.strftime("%Y-%m")}: ${usage.used_amount}')
        print()
else:
    print('No auto-use benefits found')

db.close()
