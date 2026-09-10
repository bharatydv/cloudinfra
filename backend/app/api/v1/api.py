from fastapi import APIRouter

from app.api.v1.routers import (
    admin,
    articles,
    auth,
    certifications,
    contact,
    courses,
    learning,
    lessons,
    payments,
    search,
    site,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(courses.router)
api_router.include_router(lessons.router)
api_router.include_router(certifications.router)
api_router.include_router(articles.router)
api_router.include_router(learning.router)
api_router.include_router(search.router)
api_router.include_router(contact.router)
api_router.include_router(payments.router)
api_router.include_router(site.router)
api_router.include_router(admin.router)

# robots.txt / sitemap.xml live at the site root, not under /api.
seo_router = site.seo_router
