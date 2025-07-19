"""
API v1 router configuration
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, products, inventory, barcode, sales, customers, shipping, fleet, analytics

api_router = APIRouter()

# Include authentication routes
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["authentication"]
)

# Include user management routes
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["users"]
)

# Include product management routes
api_router.include_router(
    products.router,
    prefix="/products",
    tags=["products"]
)

# Include inventory management routes
api_router.include_router(
    inventory.router,
    prefix="/inventory",
    tags=["inventory"]
)

# Include barcode management routes
api_router.include_router(
    barcode.router,
    prefix="/barcode",
    tags=["barcode"]
)

# Include sales management routes
api_router.include_router(
    sales.router,
    prefix="/sales",
    tags=["sales"]
)

# Include customer management routes
api_router.include_router(
    customers.router,
    prefix="/customers",
    tags=["customers"]
)

# Include shipping management routes
api_router.include_router(
    shipping.router,
    prefix="/shipping",
    tags=["shipping"]
)

# Include fleet management routes
api_router.include_router(
    fleet.router,
    prefix="/fleet",
    tags=["fleet"]
)

# Include analytics and reporting routes
api_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["analytics"]
)

# TODO: Add other endpoint routers as they are implemented
# 
# api_router.include_router(
#     sales.router,
#     prefix="/sales",
#     tags=["sales"]
# )
# 
# api_router.include_router(
#     barcode.router,
#     prefix="/barcode",
#     tags=["barcode"]
# )
# 
# api_router.include_router(
#     repack.router,
#     prefix="/repack",
#     tags=["repack"]
# )
# 
# api_router.include_router(
#     shipping.router,
#     prefix="/shipping",
#     tags=["shipping"]
# )
# 
# api_router.include_router(
#     alerts.router,
#     prefix="/alerts",
#     tags=["alerts"]
# )
# 
# api_router.include_router(
#     sampling.router,
#     prefix="/sampling",
#     tags=["sampling"]
# )
# 
# api_router.include_router(
#     procurement.router,
#     prefix="/procurement",
#     tags=["procurement"]
# )
# 
# api_router.include_router(
#     analytics.router,
#     prefix="/analytics",
#     tags=["analytics"]
# )
# 
# api_router.include_router(
#     branches.router,
#     prefix="/branches",
#     tags=["branches"]
# )