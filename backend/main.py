from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

try:
    from backend.github_client import GitHubClientError, fetch_github_issues_from_url
    from backend.groq_client import generate_enhanced_explanation
    from backend.recommender import rank_issues
except ModuleNotFoundError:
    from github_client import GitHubClientError, fetch_github_issues_from_url
    from groq_client import generate_enhanced_explanation
    from recommender import rank_issues

DATA_PATH = Path(__file__).parent / "data" / "issues.json"


class UserProfile(BaseModel):
    skills: dict[str, int] = Field(default_factory=dict)
    experience_level: str
    open_source_experience: str
    interests: list[str] = Field(default_factory=list)
    preferred_difficulty: str
    github_username: str | None = ""

    @field_validator("skills", mode="before")
    @classmethod
    def normalize_skills(cls, value: Any) -> dict[str, int]:
        if isinstance(value, dict):
            normalized: dict[str, int] = {}
            for skill, score in value.items():
                try:
                    normalized[str(skill)] = max(0, min(int(round(float(score))), 100))
                except (TypeError, ValueError):
                    normalized[str(skill)] = 0
            return normalized

        if isinstance(value, list):
            return {str(skill): 70 for skill in value}

        return {}


class RecommendResponse(BaseModel):
    recommendations: list[dict[str, Any]]
    source: str
    issues_count: int
    issues_fetched: int
    used_fallback: bool = False
    fallback_reason: str | None = None
    source_kind: str = "mock"
    message: str | None = None


class FetchGitHubIssuesResponse(BaseModel):
    source: str
    issues_count: int
    issues_fetched: int
    issues: list[dict[str, Any]]
    used_fallback: bool = False
    fallback_reason: str | None = None
    source_kind: str = "mock"
    message: str | None = None


class EnhanceExplanationRequest(BaseModel):
    user_profile: UserProfile
    selected_issue: dict[str, Any]
    score_breakdown: dict[str, Any]


class FetchGitHubIssuesRequest(BaseModel):
    github_url: str | None = ""
    max_repos: int = Field(default=5, ge=1, le=20)
    max_issues_per_repo: int = Field(default=20, ge=1, le=50)


class RecommendFromGitHubRequest(BaseModel):
    github_url: str | None = ""
    user_profile: UserProfile
    max_repos: int = Field(default=5, ge=1, le=20)
    max_issues_per_repo: int = Field(default=20, ge=1, le=50)


def load_issues() -> list[dict[str, Any]]:
    issues = json.loads(DATA_PATH.read_text())
    normalized_issues: list[dict[str, Any]] = []

    for issue in issues:
        normalized_issues.append(
            {
                **issue,
                "updated_at": issue.get("updated_at", issue.get("created_at")),
                "comments": issue.get("comments", 0),
                "state": issue.get("state", "open"),
                "author_association": issue.get("author_association", "NONE"),
                "source_kind": issue.get("source_kind", "mock"),
            }
        )

    return normalized_issues


ISSUES = load_issues()

app = FastAPI(title="OpenMatch AI API")

cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
custom_cors_origins = os.getenv("CORS_ORIGINS", "").strip()
if custom_cors_origins:
    cors_origins = [origin.strip() for origin in custom_cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/issues")
async def get_issues() -> dict[str, Any]:
    return {"issues": ISSUES, "count": len(ISSUES)}


@app.post("/recommend", response_model=RecommendResponse)
async def recommend(user_profile: UserProfile) -> RecommendResponse:
    recommendations = rank_issues(user_profile.model_dump(), ISSUES)
    return RecommendResponse(
        recommendations=recommendations,
        source="Sample Issues",
        issues_count=len(ISSUES),
        issues_fetched=len(ISSUES),
        used_fallback=False,
        fallback_reason=None,
        source_kind="mock",
        message=None,
    )


@app.post("/fetch-github-issues", response_model=FetchGitHubIssuesResponse)
async def fetch_github_issues(
    payload: FetchGitHubIssuesRequest,
    x_github_token: str | None = Header(default=None),
) -> FetchGitHubIssuesResponse:
    if not payload.github_url:
        return FetchGitHubIssuesResponse(
            source="Sample Issues",
            issues_count=len(ISSUES),
            issues_fetched=len(ISSUES),
            issues=ISSUES,
            used_fallback=True,
            fallback_reason="No GitHub URL was provided, so OpenMatch used the local mock issue dataset.",
            source_kind="mock",
            message="Using sample issues.",
        )

    try:
        github_payload = await fetch_github_issues_from_url(
            payload.github_url,
            max_repos=payload.max_repos,
            max_issues_per_repo=payload.max_issues_per_repo,
            token=x_github_token,
        )
        return FetchGitHubIssuesResponse(
            source=github_payload["source"],
            issues_count=github_payload["issues_count"],
            issues_fetched=github_payload["issues_count"],
            issues=github_payload["issues"],
            used_fallback=False,
            fallback_reason=None,
            source_kind=github_payload["source_kind"],
            message=(
                "No open issues found from this GitHub source."
                if github_payload["issues_count"] == 0
                else None
            ),
        )
    except GitHubClientError as exc:
        raise HTTPException(status_code=exc.status_code or 400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc) or "GitHub issue fetch failed.") from exc


@app.post("/recommend-from-github", response_model=RecommendResponse)
async def recommend_from_github(
    payload: RecommendFromGitHubRequest,
    x_github_token: str | None = Header(default=None),
) -> RecommendResponse:
    if not payload.github_url:
        recommendations = rank_issues(payload.user_profile.model_dump(), ISSUES)
        return RecommendResponse(
            recommendations=recommendations,
            source="Sample Issues",
            issues_count=len(ISSUES),
            issues_fetched=len(ISSUES),
            used_fallback=True,
            fallback_reason="No GitHub URL was provided, so OpenMatch used the local mock issue dataset.",
            source_kind="mock",
            message=None,
        )

    try:
        github_payload = await fetch_github_issues_from_url(
            payload.github_url,
            max_repos=payload.max_repos,
            max_issues_per_repo=payload.max_issues_per_repo,
            token=x_github_token,
        )
        if github_payload["issues_count"] == 0:
            return RecommendResponse(
                recommendations=[],
                source=github_payload["source"],
                issues_count=0,
                issues_fetched=0,
                used_fallback=False,
                fallback_reason=None,
                source_kind=github_payload["source_kind"],
                message="No open issues found from this GitHub source.",
            )

        recommendations = rank_issues(payload.user_profile.model_dump(), github_payload["issues"])
        return RecommendResponse(
            recommendations=recommendations,
            source=github_payload["source"],
            issues_count=github_payload["issues_count"],
            issues_fetched=github_payload["issues_count"],
            used_fallback=False,
            fallback_reason=None,
            source_kind=github_payload["source_kind"],
            message=None,
        )
    except GitHubClientError as exc:
        raise HTTPException(status_code=exc.status_code or 400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc) or "GitHub issue fetch failed.") from exc


@app.post("/enhance-explanation")
async def enhance_explanation(
    payload: EnhanceExplanationRequest,
    x_groq_api_key: str | None = Header(default=None),
) -> dict[str, Any]:
    fallback = {
        "enhanced_summary": payload.selected_issue.get("issue_description", ""),
        "personalized_reason": payload.selected_issue.get("why_recommended", "")
        or "This issue aligns with your stated skills, interests, and contribution goals.",
        "suggested_first_step": (
            "Read the issue, reproduce the current behavior locally, and inspect the files most closely tied to the labels and required skills."
        ),
    }

    try:
        return await generate_enhanced_explanation(
            api_key=x_groq_api_key or "",
            user_profile=payload.user_profile.model_dump(),
            selected_issue=payload.selected_issue,
            score_breakdown=payload.score_breakdown,
            fallback=fallback,
        )
    except Exception:
        return {
            **fallback,
            "mode": "fallback",
            "message": "Groq enhancement was unavailable, so OpenMatch returned a deterministic explanation instead.",
        }
