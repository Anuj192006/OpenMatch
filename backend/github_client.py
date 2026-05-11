from __future__ import annotations

import asyncio
import re
from typing import Any
from urllib.parse import urlparse

import httpx

from backend.recommender import canonicalize_skill, derive_focus_areas, normalize_token

GITHUB_API_BASE = "https://api.github.com"

GOOD_FIRST_KEYWORDS = {
    "good first issue",
    "beginner",
    "first-timers-only",
    "easy",
    "starter",
}
BEGINNER_KEYWORDS = {"docs", "typo", "documentation", "small fix", "ui polish"}
INTERMEDIATE_KEYWORDS = {"bug", "enhancement", "refactor", "test", "api"}
CHALLENGING_KEYWORDS = {"performance", "architecture", "security", "database", "compiler", "migration", "breaking change"}

SKILL_KEYWORDS = {
    "React": {"react", "component", "hook", "jsx", "frontend", "ui", "next.js"},
    "JavaScript": {"javascript", "frontend", "browser", "dom"},
    "TypeScript": {"typescript", "type", "interface", "typed"},
    "Python": {"python", "fastapi", "django", "flask", "pandas", "pytest"},
    "C++": {"c++", "cpp", "clang", "compiler"},
    "Java": {"java", "jvm", "spring", "gradle", "maven"},
    "Node.js": {"node", "node.js", "nodejs", "npm", "cli"},
    "APIs": {"api", "endpoint", "rest", "graphql", "request", "response"},
    "Backend": {"api", "endpoint", "server", "auth", "database", "backend", "service"},
    "Frontend": {"frontend", "ui", "ux", "component", "layout", "css"},
    "Machine Learning": {"model", "training", "embedding", "inference", "dataset", "machine learning"},
    "NLP": {"nlp", "token", "language model", "classifier", "text", "entity"},
    "Data Structures": {"data structure", "algorithm", "graph", "tree", "cache", "queue"},
    "DevOps": {"docker", "ci", "github actions", "deployment", "kubernetes", "infra"},
    "Testing": {"test", "unit test", "integration test", "jest", "pytest", "coverage"},
    "Documentation": {"docs", "readme", "typo", "documentation", "guide", "example"},
    "Security": {"xss", "csrf", "auth", "vulnerability", "token", "security", "jwt"},
    "Data Science": {"pandas", "notebook", "analytics", "dataframe", "feature engineering", "data science"},
}

REPO_LANGUAGE_SKILLS = {
    "typescript": ["TypeScript", "Frontend"],
    "javascript": ["JavaScript", "Frontend"],
    "python": ["Python", "Backend"],
    "java": ["Java", "Backend"],
    "c++": ["C++", "Data Structures"],
    "go": ["Backend", "APIs"],
    "rust": ["Systems", "Backend"],
}


class GitHubClientError(Exception):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def contains_keyword(text: str, keyword: str) -> bool:
    pattern = rf"(^|[^a-z0-9]){re.escape(keyword.lower())}($|[^a-z0-9])"
    return re.search(pattern, text.lower()) is not None


def parse_github_url(github_url: str | None) -> dict[str, str]:
    if not github_url or not github_url.strip():
        parsed_result = {"type": "mock", "source": "Sample Issues"}
        print(f"[github] parsed URL type=mock source={parsed_result['source']}")
        return parsed_result

    parsed = urlparse(github_url.strip())
    if parsed.netloc not in {"github.com", "www.github.com"}:
        raise GitHubClientError("Paste a valid GitHub repository, issues, or organization URL.")

    parts = [part for part in parsed.path.split("/") if part]
    if not parts:
        raise GitHubClientError("Paste a valid GitHub repository, issues, or organization URL.")

    if parts[0] == "orgs":
        if len(parts) >= 2 and (len(parts) == 2 or parts[2] == "repositories"):
            parsed_result = {"type": "org", "owner": parts[1], "source": f"GitHub · {parts[1]}"}
            print(f"[github] parsed URL type=org owner={parts[1]}")
            return parsed_result
        raise GitHubClientError("Paste a GitHub organization repositories page, repository, or issues URL.")

    if len(parts) == 1:
        parsed_result = {"type": "org", "owner": parts[0], "source": f"GitHub · {parts[0]}"}
        print(f"[github] parsed URL type=org owner={parts[0]}")
        return parsed_result

    owner = parts[0]
    repo = parts[1].removesuffix(".git")
    if len(parts) == 2 or (len(parts) >= 3 and parts[2] == "issues"):
        parsed_result = {"type": "repo", "owner": owner, "repo": repo, "source": f"GitHub · {owner}/{repo}"}
        print(f"[github] parsed URL type=repo owner={owner} repo={repo}")
        return parsed_result

    raise GitHubClientError("Paste a GitHub repository, repository issues, or organization URL.")


def build_headers(token: str | None) -> dict[str, str]:
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def fetch_json(
    client: httpx.AsyncClient,
    path: str,
    *,
    params: dict[str, Any] | None = None,
) -> Any:
    response = await client.get(f"{GITHUB_API_BASE}{path}", params=params)
    if response.status_code >= 400:
        try:
            payload = response.json()
            message = payload.get("message", "GitHub API request failed.")
        except Exception:
            message = "GitHub API request failed."

        remaining = response.headers.get("x-ratelimit-remaining")
        if response.status_code == 403 and remaining == "0":
            raise GitHubClientError(
                "GitHub API rate limit reached. Add a GitHub token in settings or try again later.",
                status_code=response.status_code,
            )

        raise GitHubClientError(message, status_code=response.status_code)

    return response.json()


def infer_required_skills(issue: dict[str, Any], repo_data: dict[str, Any]) -> list[str]:
    labels = [label["name"] if isinstance(label, dict) else str(label) for label in issue.get("labels", [])]
    topics = repo_data.get("topics", []) or []
    repo_language = (repo_data.get("language") or "").lower()
    repo_name = repo_data.get("full_name", "")
    text = " ".join(
        [
            issue.get("title", ""),
            issue.get("body", "") or "",
            " ".join(labels),
            " ".join(topics),
            repo_name,
            repo_data.get("description", "") or "",
            repo_language,
        ]
    ).lower()

    scores: dict[str, float] = {}

    for skill, keywords in SKILL_KEYWORDS.items():
        skill_score = 0.0
        for keyword in keywords:
            if contains_keyword(text, keyword):
                skill_score += 1.0
            if contains_keyword(" ".join(labels).lower(), keyword):
                skill_score += 1.4
            if contains_keyword(" ".join(topics).lower(), keyword):
                skill_score += 0.8
        if skill_score > 0:
            scores[skill] = scores.get(skill, 0.0) + skill_score

    for skill in REPO_LANGUAGE_SKILLS.get(repo_language, []):
        canonical = canonicalize_skill(skill)
        if canonical:
            scores[canonical] = scores.get(canonical, 0.0) + 1.3

    if contains_keyword(text, "docs") or contains_keyword(text, "documentation") or contains_keyword(text, "readme"):
        scores["Documentation"] = scores.get("Documentation", 0.0) + 1.5

    if contains_keyword(text, "security") or contains_keyword(text, "vulnerability"):
        scores["Security"] = scores.get("Security", 0.0) + 1.5

    if contains_keyword(text, "api") or contains_keyword(text, "endpoint"):
        scores["APIs"] = scores.get("APIs", 0.0) + 1.3
        scores["Backend"] = scores.get("Backend", 0.0) + 1.0

    if not scores:
        if repo_language in REPO_LANGUAGE_SKILLS:
            inferred = [skill for skill in REPO_LANGUAGE_SKILLS[repo_language] if canonicalize_skill(skill)]
            return inferred[:3]
        return ["Backend"]

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    return [skill for skill, _score in ranked[:4]]


def infer_difficulty(issue: dict[str, Any], labels: list[str]) -> str:
    label_tokens = {normalize_token(label) for label in labels}
    body = (issue.get("body") or "").lower()
    title = issue.get("title", "").lower()
    text = f"{title} {body}"
    comments = int(issue.get("comments", 0) or 0)

    if GOOD_FIRST_KEYWORDS & label_tokens:
        return "Good First Issue"

    scores = {
        "Good First Issue": 0,
        "Beginner": 0,
        "Intermediate": 0,
        "Challenging": 0,
    }

    for keyword in GOOD_FIRST_KEYWORDS:
        if keyword in text:
            scores["Good First Issue"] += 3

    for keyword in BEGINNER_KEYWORDS:
        if keyword in text or keyword in label_tokens:
            scores["Beginner"] += 2

    for keyword in INTERMEDIATE_KEYWORDS:
        if keyword in text or keyword in label_tokens:
            scores["Intermediate"] += 2

    for keyword in CHALLENGING_KEYWORDS:
        if keyword in text or keyword in label_tokens:
            scores["Challenging"] += 3

    body_length = len(body)
    if body_length <= 220 and comments <= 1:
        scores["Beginner"] += 1
    if body_length >= 900:
        scores["Intermediate"] += 1
        scores["Challenging"] += 1
    if comments >= 8:
        scores["Challenging"] += 2
    elif comments >= 3:
        scores["Intermediate"] += 1

    if "documentation" in label_tokens or "typo" in label_tokens:
        scores["Beginner"] += 2
    if "bug" in label_tokens or "enhancement" in label_tokens or "test" in label_tokens:
        scores["Intermediate"] += 1
    if "security" in label_tokens or "performance" in label_tokens:
        scores["Challenging"] += 2

    return max(scores.items(), key=lambda item: item[1])[0] or "Intermediate"


def estimate_effort(difficulty: str, body: str, comments: int) -> str:
    body_length = len(body)

    if difficulty == "Good First Issue":
        return "1-3 hours" if body_length < 300 and comments < 3 else "2-4 hours"
    if difficulty == "Beginner":
        return "2-5 hours" if body_length < 500 else "3-6 hours"
    if difficulty == "Intermediate":
        return "4-8 hours" if comments < 6 else "6-10 hours"
    return "8-14 hours" if comments < 12 else "10-16 hours"


def calculate_issue_quality_score(issue: dict[str, Any], labels: list[str], body: str) -> int:
    score = 40
    title = issue.get("title", "")
    comments = int(issue.get("comments", 0) or 0)
    author_association = issue.get("author_association", "NONE")

    if len(title) >= 12:
        score += 8
    if len(body) >= 80:
        score += 18
    elif len(body) >= 30:
        score += 10
    if 1 <= len(labels) <= 5:
        score += 14
    elif len(labels) > 5:
        score += 9
    if comments > 0:
        score += 8
    if comments >= 3:
        score += 4
    if author_association in {"MEMBER", "OWNER", "COLLABORATOR"}:
        score += 6
    if "expected" in body.lower() or "reproduce" in body.lower():
        score += 4

    return max(20, min(score, 100))


def normalize_issue(issue: dict[str, Any], repo_data: dict[str, Any]) -> dict[str, Any]:
    labels = [label["name"] if isinstance(label, dict) else str(label) for label in issue.get("labels", [])]
    body = issue.get("body") or "No detailed issue description was provided."
    required_skills = infer_required_skills(issue, repo_data)
    difficulty = infer_difficulty(issue, labels)
    focus_areas = derive_focus_areas(required_skills, labels, [])

    return {
        "repository": repo_data.get("full_name", ""),
        "issue_title": issue.get("title", "Untitled issue"),
        "issue_description": body,
        "labels": labels,
        "required_skills": required_skills,
        "difficulty": difficulty,
        "estimated_effort": estimate_effort(difficulty, body, int(issue.get("comments", 0) or 0)),
        "url": issue.get("html_url", ""),
        "created_at": issue.get("created_at"),
        "updated_at": issue.get("updated_at"),
        "comments": int(issue.get("comments", 0) or 0),
        "state": issue.get("state", "open"),
        "author_association": issue.get("author_association", "NONE"),
        "issue_quality_score": calculate_issue_quality_score(issue, labels, body),
        "focus_areas": focus_areas,
        "repo_language": repo_data.get("language") or "",
        "repo_topics": repo_data.get("topics", []) or [],
        "issue_number": issue.get("number"),
        "source_kind": "github",
    }


async def fetch_repo_details(client: httpx.AsyncClient, owner: str, repo: str) -> dict[str, Any]:
    return await fetch_json(client, f"/repos/{owner}/{repo}")


async def fetch_repo_issues_internal(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    max_issues_per_repo: int,
    repo_data: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    repo_data = repo_data or await fetch_repo_details(client, owner, repo)
    normalized: list[dict[str, Any]] = []

    per_page = min(max(max_issues_per_repo * 2, 30), 100)
    for page in range(1, 6):
        issues = await fetch_json(
            client,
            f"/repos/{owner}/{repo}/issues",
            params={
                "state": "open",
                "sort": "updated",
                "direction": "desc",
                "per_page": per_page,
                "page": page,
            },
        )

        for issue in issues:
            if "pull_request" in issue:
                continue
            normalized.append(normalize_issue(issue, repo_data))
            if len(normalized) >= max_issues_per_repo:
                print(f"[github] repo={owner}/{repo} real_issues_fetched={len(normalized)}")
                return normalized[:max_issues_per_repo]

        if len(issues) < per_page:
            break

    print(f"[github] repo={owner}/{repo} real_issues_fetched={len(normalized)}")
    return normalized[:max_issues_per_repo]


async def fetch_repo_issues(owner: str, repo: str, max_issues_per_repo: int, token: str | None = None) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=18.0, headers=build_headers(token)) as client:
        return await fetch_repo_issues_internal(client, owner, repo, max_issues_per_repo)


async def fetch_org_repositories(org: str, max_repos: int, token: str | None = None) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=18.0, headers=build_headers(token)) as client:
        try:
            repos = await fetch_json(
                client,
                f"/orgs/{org}/repos",
                params={
                    "type": "public",
                    "sort": "updated",
                    "direction": "desc",
                    "per_page": min(max(max_repos, 1), 100),
                },
            )
        except GitHubClientError as exc:
            if exc.status_code == 404:
                repos = await fetch_json(
                    client,
                    f"/users/{org}/repos",
                    params={
                        "type": "owner",
                        "sort": "updated",
                        "direction": "desc",
                        "per_page": min(max(max_repos, 1), 100),
                    },
                )
            else:
                raise

    filtered = [
        repo
        for repo in repos
        if repo.get("has_issues") and not repo.get("archived") and not repo.get("disabled")
    ]
    selected = filtered[: max(max_repos, 1)]
    print(f"[github] org={org} repos_fetched={len(selected)}")
    return selected


async def fetch_org_issues(org: str, max_repos: int, max_issues_per_repo: int, token: str | None = None) -> list[dict[str, Any]]:
    repos = await fetch_org_repositories(org, max_repos, token)
    if not repos:
        raise GitHubClientError("No public repositories with issues were found for that organization.")

    async with httpx.AsyncClient(timeout=18.0, headers=build_headers(token)) as client:
        tasks = [
            fetch_repo_issues_internal(
                client=client,
                owner=repo["owner"]["login"],
                repo=repo["name"],
                max_issues_per_repo=max_issues_per_repo,
                repo_data=repo,
            )
            for repo in repos
        ]
        issues_by_repo = await asyncio.gather(*tasks)

    flattened = [issue for repo_issues in issues_by_repo for issue in repo_issues]
    flattened.sort(key=lambda item: item.get("updated_at") or item.get("created_at") or "", reverse=True)
    print(f"[github] org={org} total_real_issues_fetched={len(flattened)}")
    return flattened


async def fetch_github_issues_from_url(
    github_url: str | None,
    *,
    max_repos: int = 5,
    max_issues_per_repo: int = 20,
    token: str | None = None,
) -> dict[str, Any]:
    parsed = parse_github_url(github_url)
    if parsed["type"] == "mock":
        return {"source": parsed["source"], "source_kind": "mock", "issues": [], "issues_count": 0}

    if parsed["type"] == "repo":
        issues = await fetch_repo_issues(parsed["owner"], parsed["repo"], max_issues_per_repo, token)
    else:
        issues = await fetch_org_issues(parsed["owner"], max_repos, max_issues_per_repo, token)

    return {
        "source": parsed["source"],
        "source_kind": parsed["type"],
        "issues": issues,
        "issues_count": len(issues),
    }
