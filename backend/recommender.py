from __future__ import annotations

from datetime import date, datetime
from typing import Any

SKILL_ALIAS_MAP = {
    "react": "React",
    "jsx": "React",
    "javascript": "JavaScript",
    "js": "JavaScript",
    "typescript": "TypeScript",
    "type script": "TypeScript",
    "ts": "TypeScript",
    "python": "Python",
    "py": "Python",
    "c++": "C++",
    "cpp": "C++",
    "java": "Java",
    "node": "Node.js",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "api": "APIs",
    "apis": "APIs",
    "backend": "Backend",
    "frontend": "Frontend",
    "machine learning": "Machine Learning",
    "ml": "Machine Learning",
    "ai/ml": "Machine Learning",
    "nlp": "NLP",
    "data structures": "Data Structures",
    "algorithms": "Data Structures",
    "devops": "DevOps",
    "testing": "Testing",
    "tests": "Testing",
    "documentation": "Documentation",
    "docs": "Documentation",
    "security": "Security",
    "data science": "Data Science",
}

INTEREST_SKILL_MAP = {
    "AI/ML": {"Machine Learning", "NLP", "Python", "Data Science"},
    "Frontend": {"React", "JavaScript", "TypeScript", "Frontend"},
    "Backend": {"Python", "Node.js", "Java", "APIs", "Backend"},
    "DevTools": {"Node.js", "TypeScript", "Testing", "DevOps", "Documentation"},
    "Open Source": {"Documentation", "Testing", "APIs", "Node.js", "React", "Python"},
    "Security": {"Security", "Backend", "APIs", "Testing"},
    "Systems": {"C++", "Java", "Data Structures", "DevOps", "Backend"},
    "Data Science": {"Python", "Machine Learning", "Data Science", "NLP"},
    "Documentation": {"Documentation", "Frontend", "APIs"},
}

SKILL_TO_INTEREST_MAP = {
    "React": "Frontend",
    "JavaScript": "Frontend",
    "TypeScript": "Frontend",
    "Frontend": "Frontend",
    "Python": "Backend",
    "Node.js": "Backend",
    "Java": "Backend",
    "APIs": "Backend",
    "Backend": "Backend",
    "Machine Learning": "AI/ML",
    "NLP": "AI/ML",
    "Data Science": "Data Science",
    "DevOps": "DevTools",
    "Testing": "Open Source",
    "Documentation": "Documentation",
    "Security": "Security",
    "C++": "Systems",
    "Data Structures": "Systems",
}

DIFFICULTY_ORDER = {
    "Good First Issue": 0,
    "Beginner": 1,
    "Intermediate": 2,
    "Challenging": 3,
}


def normalize_token(value: str) -> str:
    return value.strip().lower()


def canonicalize_skill(value: str) -> str | None:
    normalized = normalize_token(value)
    return SKILL_ALIAS_MAP.get(normalized)


def clamp_percentage(value: Any) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        return 0
    return max(0, min(number, 100))


def normalize_datetime(value: str | None) -> date:
    if not value:
        return date.today()

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return date.today()


def derive_focus_areas(
    required_skills: list[str] | set[str],
    labels: list[str] | set[str],
    explicit_focus_areas: list[str] | set[str] | None = None,
) -> list[str]:
    focus_areas: set[str] = set(explicit_focus_areas or [])
    normalized_labels = {normalize_token(label) for label in labels}

    for skill in required_skills:
        interest = SKILL_TO_INTEREST_MAP.get(skill)
        if interest:
            focus_areas.add(interest)

    if {"help wanted", "good first issue", "first-timers-only"} & normalized_labels:
        focus_areas.add("Open Source")

    if "documentation" in normalized_labels:
        focus_areas.add("Documentation")

    if "security" in normalized_labels:
        focus_areas.add("Security")

    return sorted(focus_areas)


def extract_user_profile(profile: dict[str, Any]) -> dict[str, Any]:
    raw_skills = profile.get("skills", {})
    normalized_skills: dict[str, int] = {}

    if isinstance(raw_skills, dict):
        for skill, value in raw_skills.items():
            canonical_skill = canonicalize_skill(skill)
            if canonical_skill:
                normalized_skills[canonical_skill] = clamp_percentage(value)
    elif isinstance(raw_skills, list):
        for skill in raw_skills:
            canonical_skill = canonicalize_skill(skill)
            if canonical_skill:
                normalized_skills[canonical_skill] = 70

    interests = profile.get("interests", [])
    normalized_interests = {normalize_token(interest) for interest in interests}

    interest_skill_tokens: set[str] = set()
    for interest in interests:
        interest_skill_tokens.update(INTEREST_SKILL_MAP.get(interest, set()))

    preferred_difficulty = profile.get("preferred_difficulty", "Good First Issue")

    return {
        "skills": normalized_skills,
        "interests": normalized_interests,
        "interest_skill_tokens": interest_skill_tokens,
        "experience_level": profile.get("experience_level", "Beginner"),
        "open_source_experience": profile.get("open_source_experience", "Never Contributed"),
        "preferred_difficulty": preferred_difficulty,
        "difficulty_rank": DIFFICULTY_ORDER.get(preferred_difficulty, 0),
        "github_username": profile.get("github_username", ""),
    }


def extract_issue_features(issue: dict[str, Any]) -> dict[str, Any]:
    required_skills = []
    for skill in issue.get("required_skills", []):
        canonical_skill = canonicalize_skill(skill)
        if canonical_skill and canonical_skill not in required_skills:
            required_skills.append(canonical_skill)

    raw_focus_areas = issue.get("focus_areas", [])
    normalized_focus_areas = {normalize_token(area) for area in raw_focus_areas}
    labels = {normalize_token(label) for label in issue.get("labels", [])}

    derived_focus_areas = derive_focus_areas(required_skills, issue.get("labels", []), raw_focus_areas)
    normalized_focus_areas.update(normalize_token(area) for area in derived_focus_areas)

    created_at = issue.get("created_at", date.today().isoformat())
    updated_at = issue.get("updated_at", created_at)

    return {
        "required_skills": required_skills,
        "required_skill_set": set(required_skills),
        "focus_areas_display": derived_focus_areas,
        "focus_areas": normalized_focus_areas,
        "labels": labels,
        "difficulty": issue.get("difficulty", "Good First Issue"),
        "difficulty_rank": DIFFICULTY_ORDER.get(issue.get("difficulty", "Good First Issue"), 0),
        "quality_score": float(issue.get("issue_quality_score", 50)),
        "created_at": created_at,
        "updated_at": updated_at,
        "comments": int(issue.get("comments", 0) or 0),
    }


def calculate_weighted_skill_match(
    user_skills: dict[str, int], issue_required_skills: list[str]
) -> tuple[float, dict[str, int], list[str], list[str]]:
    if not issue_required_skills:
        return 0.55, {}, [], []

    skill_scores: dict[str, int] = {}
    matched_skills: list[str] = []
    missing_skills: list[str] = []

    total_score = 0.0
    for skill in issue_required_skills:
        skill_score = clamp_percentage(user_skills.get(skill, 0))
        skill_scores[skill] = skill_score
        total_score += skill_score
        if skill_score > 0:
            matched_skills.append(skill)
        else:
            missing_skills.append(skill)

    average_score = total_score / len(issue_required_skills)
    return average_score / 100.0, skill_scores, matched_skills, missing_skills


def difficulty_fit_score(user_rank: int, issue_rank: int) -> float:
    distance = abs(user_rank - issue_rank)
    return {
        0: 1.0,
        1: 0.74,
        2: 0.42,
        3: 0.18,
    }.get(distance, 0.1)


def issue_quality_score(issue_features: dict[str, Any]) -> float:
    return max(0.0, min(issue_features["quality_score"] / 100.0, 1.0))


def recency_activity_score(issue_features: dict[str, Any]) -> tuple[float, int, int]:
    created_date = normalize_datetime(issue_features["created_at"])
    updated_date = normalize_datetime(issue_features["updated_at"])
    comments = issue_features["comments"]

    days_open = max((date.today() - created_date).days, 0)
    days_since_update = max((date.today() - updated_date).days, 0)

    if days_since_update <= 7:
        recency_score = 1.0
    elif days_since_update <= 30:
        recency_score = 0.86
    elif days_since_update <= 90:
        recency_score = 0.68
    elif days_since_update <= 180:
        recency_score = 0.5
    else:
        recency_score = 0.32

    if comments == 0:
        activity_score = 0.55
    elif comments <= 2:
        activity_score = 0.72
    elif comments <= 8:
        activity_score = 0.9
    elif comments <= 20:
        activity_score = 1.0
    else:
        activity_score = 0.82

    combined = (recency_score * 0.7) + (activity_score * 0.3)
    return combined, days_open, days_since_update


def interest_alignment_score(user_profile: dict[str, Any], issue_features: dict[str, Any]) -> tuple[float, list[str]]:
    matched_interests = sorted(user_profile["interests"] & issue_features["focus_areas"])
    score = len(matched_interests) / max(len(issue_features["focus_areas"]), 1)

    if not matched_interests:
        required_skills = set(issue_features["required_skills"])
        if user_profile["interest_skill_tokens"] & required_skills:
            score = 0.4

    return min(score, 1.0), matched_interests


def calculate_match_score(user_profile: dict[str, Any], issue: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    user = extract_user_profile(user_profile)
    issue_features = extract_issue_features(issue)

    skill_match, skill_scores, matched_skills, missing_skills = calculate_weighted_skill_match(
        user["skills"], issue_features["required_skills"]
    )
    difficulty_fit = difficulty_fit_score(user["difficulty_rank"], issue_features["difficulty_rank"])
    interest_alignment, matched_interests = interest_alignment_score(user, issue_features)
    quality_score = issue_quality_score(issue_features)
    recency_score, days_open, days_since_update = recency_activity_score(issue_features)

    weighted_score = (
        skill_match * 45
        + difficulty_fit * 20
        + interest_alignment * 15
        + quality_score * 10
        + recency_score * 10
    )

    breakdown = {
        "skill_strength": {
            "score": round(skill_match * 100, 1),
            "weighted_points": round(skill_match * 45, 1),
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "skill_scores": skill_scores,
            "avg_skill_strength": round(skill_match * 100, 1),
        },
        "difficulty_fit": {
            "score": round(difficulty_fit * 100, 1),
            "weighted_points": round(difficulty_fit * 20, 1),
            "user_preference": user["preferred_difficulty"],
            "issue_difficulty": issue["difficulty"],
        },
        "interest_alignment": {
            "score": round(interest_alignment * 100, 1),
            "weighted_points": round(interest_alignment * 15, 1),
            "matched_interests": matched_interests,
            "focus_areas": issue_features["focus_areas_display"],
        },
        "issue_quality": {
            "score": round(quality_score * 100, 1),
            "weighted_points": round(quality_score * 10, 1),
            "issue_quality_score": round(issue_features["quality_score"], 1),
            "labels_count": len(issue.get("labels", [])),
        },
        "recency_activity": {
            "score": round(recency_score * 100, 1),
            "weighted_points": round(recency_score * 10, 1),
            "days_open": days_open,
            "days_since_update": days_since_update,
            "comments": issue_features["comments"],
        },
    }

    return round(weighted_score, 1), breakdown


def explain_match(user_profile: dict[str, Any], issue: dict[str, Any], score_breakdown: dict[str, Any]) -> str:
    skill_section = score_breakdown["skill_strength"]
    difficulty_section = score_breakdown["difficulty_fit"]
    interest_section = score_breakdown["interest_alignment"]

    top_skill_snippets = [
        f"{skill} ({score}%)"
        for skill, score in list(skill_section.get("skill_scores", {}).items())[:3]
        if score > 0
    ]
    skill_text = ", ".join(top_skill_snippets) if top_skill_snippets else "adjacent skills that can grow through this issue"

    interest_text = ", ".join(interest_section.get("matched_interests", [])[:2]) or "your selected focus areas"

    return (
        f"Your current skill strength in {skill_text} maps well to this issue's required stack. "
        f"It also fits your {difficulty_section['user_preference'].lower()} difficulty target and aligns with {interest_text}."
    )


def rank_issues(user_profile: dict[str, Any], issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked: list[dict[str, Any]] = []

    for issue in issues:
        score, breakdown = calculate_match_score(user_profile, issue)
        if score < 35:
            continue

        ranked.append(
            {
                **issue,
                "match_score": score,
                "score_breakdown": breakdown,
                "why_recommended": explain_match(user_profile, issue, breakdown),
            }
        )

    ranked.sort(
        key=lambda item: (
            item["match_score"],
            item["score_breakdown"]["issue_quality"]["score"],
            item["score_breakdown"]["recency_activity"]["score"],
        ),
        reverse=True,
    )
    return ranked
