from __future__ import annotations

import json
from typing import Any

import httpx


async def generate_enhanced_explanation(
    api_key: str,
    user_profile: dict[str, Any],
    selected_issue: dict[str, Any],
    score_breakdown: dict[str, Any],
    fallback: dict[str, Any],
) -> dict[str, Any]:
    if not api_key:
        return {
            **fallback,
            "mode": "fallback",
            "message": "Add a Groq API key to enable enhanced explanations.",
        }

    prompt = {
        "user_profile": {
            "skills": user_profile.get("skills", []),
            "experience_level": user_profile.get("experience_level"),
            "open_source_experience": user_profile.get("open_source_experience"),
            "interests": user_profile.get("interests", []),
            "preferred_difficulty": user_profile.get("preferred_difficulty"),
        },
        "issue": {
            "repository": selected_issue.get("repository"),
            "issue_title": selected_issue.get("issue_title"),
            "issue_description": selected_issue.get("issue_description"),
            "required_skills": selected_issue.get("required_skills", []),
            "difficulty": selected_issue.get("difficulty"),
        },
        "score_breakdown": score_breakdown,
    }

    async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.1-8b-instant",
                "temperature": 0.2,
                "max_tokens": 220,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You explain why a GitHub issue matches a developer. "
                            "Return strict JSON with keys enhanced_summary, personalized_reason, suggested_first_step."
                        ),
                    },
                    {
                        "role": "user",
                        "content": json.dumps(prompt),
                    },
                ],
            },
        )
        response.raise_for_status()
        payload = response.json()
        content = payload["choices"][0]["message"]["content"].strip()
        content = content.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(content)

    return {
        "enhanced_summary": parsed.get("enhanced_summary", fallback["enhanced_summary"]),
        "personalized_reason": parsed.get("personalized_reason", fallback["personalized_reason"]),
        "suggested_first_step": parsed.get("suggested_first_step", fallback["suggested_first_step"]),
        "mode": "groq",
    }

