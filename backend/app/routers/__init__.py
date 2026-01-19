from .owners import router as owners_router
from .cards import router as cards_router
from .card_templates import router as card_templates_router
from .benefits import router as benefits_router
from .benefit_usages import router as benefit_usages_router
from .multipliers import router as multipliers_router
from .dashboard import router as dashboard_router

__all__ = [
    "owners_router",
    "cards_router",
    "card_templates_router",
    "benefits_router",
    "benefit_usages_router",
    "multipliers_router",
    "dashboard_router",
]
