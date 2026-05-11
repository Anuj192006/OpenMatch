# OpenMatch AI

OpenMatch AI is a full-stack GitHub issue recommendation system that helps developers find open-source issues they can realistically solve based on skill strength, experience, interests, and preferred difficulty.

It is designed as a real product workflow, not a static landing page. The app pairs a deterministic FastAPI recommendation engine with a polished React onboarding experience and an optional Groq-powered explanation layer.

## Why This Project Exists

Finding a first or next open-source issue is usually noisy. Developers often browse dozens of repositories before finding something that matches both their technical skills and their actual confidence level.

OpenMatch AI reduces that friction by:

- collecting a focused contributor profile
- fetching live open issues from real GitHub repositories and organizations
- ranking issues with transparent scoring based on skill percentages
- explaining why an issue is a fit
- keeping the core recommendation engine fully usable without any LLM dependency

## Features

- Multi-step onboarding flow for skills, skill confidence percentages, experience, interests, difficulty preference, and optional GitHub source URL
- Real GitHub issue fetching from repository URLs, repository issues URLs, and organization URLs
- Deterministic recommendation engine with transparent weighted scoring
- Ranked issue dashboard with match score, effort, labels, and fit rationale
- Match breakdown drawer with skill strength, difficulty fit, interest alignment, issue quality, and recency/activity
- Local mock issue dataset used as a safe fallback if no GitHub URL is provided or the GitHub API fails
- Optional GitHub token support for higher API limits, stored locally in the browser only
- Optional Groq enhancement for richer explanation text and suggested first steps
- Single-command local development for frontend and backend together
- No database and no backend persistence

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn/ui-style components, Framer Motion, Lucide React
- Backend: FastAPI, Python
- Data: live GitHub REST API + local JSON fallback dataset, in-memory recommendation flow
- Optional API enhancements: GitHub token for rate limits, Groq API key for explanation enhancement

## Architecture

```text
frontend/                React + Vite client
  src/
    components/
    lib/

backend/                 FastAPI API
  main.py                API routes
  github_client.py       GitHub REST API fetch + normalization layer
  recommender.py         Deterministic ranking engine
  groq_client.py         Optional Groq enhancement client
  data/issues.json       Local mock issue fallback dataset

package.json             Root scripts for single-command install/dev
```

### Frontend Flow

1. User completes onboarding with skill percentages.
2. User optionally pastes a GitHub repository, issues, or organization URL.
3. Frontend sends the request to `POST /recommend-from-github` when a GitHub URL is present, or `POST /recommend` for the local fallback dataset.
4. The backend fetches real open issues, infers issue metadata, and ranks matches.
5. Recommendations render in a ranked dashboard.
6. User can open a score breakdown drawer for transparent scoring details.
7. If the user adds a Groq API key, they can request an enhanced explanation for any issue.

### Backend Flow

1. FastAPI loads `backend/data/issues.json` into memory.
2. `github_client.py` parses repo/org URLs and fetches public open issues through the GitHub REST API.
3. Pull requests are filtered out from the GitHub issues response.
4. The backend infers required skills, difficulty, effort, quality, and focus areas for live GitHub issues.
5. `recommender.py` calculates a weighted match score for each issue.
6. Only issues above the 35-point threshold are returned.
7. If GitHub fetching fails, OpenMatch falls back to the local mock dataset instead of breaking the app.
8. Groq is used only when the user explicitly requests explanation enhancement.

## Recommendation Scoring Formula

Match scores are normalized to a 0-100 scale using deterministic weights:

- 45% weighted skill strength
- 20% difficulty fit
- 15% interest alignment
- 10% issue quality
- 10% recency / activity

### Skill Percentage Matching

Selected skills are stored as percentages, for example:

```json
{
  "skills": {
    "React": 80,
    "TypeScript": 60,
    "Backend": 45
  }
}
```

If an issue requires `React` and `TypeScript`, OpenMatch averages the user’s available skill percentages. Missing required skills count as `0`.

### GitHub Issue Inference

For live GitHub issues, OpenMatch infers:

- `required_skills`
- `difficulty`
- `estimated_effort`
- `issue_quality_score`

The inference uses issue title/body text, labels, repository language, topics, issue comments, and recency.

### Core Functions

Implemented in [backend/recommender.py](/Users/anujupadhyay/Desktop/OpenMatch/backend/recommender.py):

- `extract_user_profile()`
- `extract_issue_features()`
- `calculate_weighted_skill_match()`
- `calculate_match_score()`
- `rank_issues()`
- `explain_match()`

Implemented in [backend/github_client.py](/Users/anujupadhyay/Desktop/OpenMatch/backend/github_client.py):

- `parse_github_url()`
- `fetch_repo_issues()`
- `fetch_org_repositories()`
- `fetch_org_issues()`
- `normalize_issue()`

## GitHub Source Support

OpenMatch accepts:

- repository URLs such as `https://github.com/vercel/next.js`
- repository issues URLs such as `https://github.com/vercel/next.js/issues`
- organization URLs such as `https://github.com/vercel`

When an organization URL is used, OpenMatch fetches public repositories, selects active issue-enabled repositories, and aggregates open issues across them.

## GitHub API Usage

OpenMatch uses the GitHub REST API directly. It does not scrape GitHub pages.

The app fetches only open issues and filters out pull requests returned by the issues API.

## Groq Optional Enhancement

Groq is not required for the product to work.

OpenMatch uses Groq only for:

- enhanced issue summaries
- more personalized explanation text
- a suggested first step for tackling the issue

The ranking engine never depends on Groq.

If the key is missing, invalid, or rate-limited, the backend returns a deterministic fallback explanation so the app keeps working.

## Privacy Note

- Groq API key is stored only in browser localStorage and never saved on the backend.
- GitHub token is stored only in browser localStorage and never saved on the backend.

## API Endpoints

- `GET /health`
  Returns API health status.

- `GET /issues`
  Returns the local mock GitHub issue dataset.

- `POST /recommend`
  Accepts the onboarding profile and returns ranked recommendations from the local mock dataset.

- `POST /fetch-github-issues`
  Accepts a GitHub repository or organization URL and returns normalized open issues from GitHub.

- `POST /recommend-from-github`
  Accepts a GitHub URL plus the user profile and returns ranked recommendations from live GitHub issues.

- `POST /enhance-explanation`
  Accepts the user profile, selected issue, and score breakdown.
  Reads the user-provided Groq key from the `x-groq-api-key` header.

### Optional Headers

- `x-github-token`
  Optional GitHub token for higher rate limits when fetching live issues.

- `x-groq-api-key`
  Optional Groq key for explanation enhancement only.

## Run Locally

### 1. Install everything

```bash
npm run install:all
```

This installs:

- root dev dependencies such as `concurrently`
- frontend dependencies inside `frontend/`
- backend Python dependencies from `backend/requirements.txt`

### 2. Start the full stack

```bash
npm run dev
```

This starts both services together:

- frontend at `http://localhost:5173`
- backend at `http://localhost:8000`

The frontend is already configured to call the backend on `http://localhost:8000`.

## Environment

If you want to override the backend URL for the frontend, create a `.env` file inside `frontend/` based on [frontend/.env.example](/Users/anujupadhyay/Desktop/OpenMatch/frontend/.env.example):

```bash
VITE_API_URL=http://localhost:8000
```

## Mock Dataset Coverage

The fallback dataset includes realistic issues across:

- React
- Python
- Backend APIs
- Machine Learning
- Documentation
- Testing
- DevOps
- Security
- Data Science
- TypeScript
- Open source tooling
- Systems / C++
- Java backend work

## Resume Bullets

- Built OpenMatch AI, a real-time GitHub issue recommendation system that fetches open issues from repositories/organizations and ranks them using weighted skill-strength matching, difficulty inference, and issue-quality scoring.
- Integrated optional Groq-powered explanation generation with user-provided API keys while keeping core recommendations independent of LLM calls.
- Designed a full-stack React + FastAPI system with in-memory data flow, GitHub REST API integration, clean fallback architecture, and a professional onboarding-based recommendation UI.

## Validation Notes

Verified locally with:

- `npm run install:all`
- `npm run build --prefix frontend`
- FastAPI `TestClient` checks for `/health` and `/recommend`
- Live GitHub repo fetch verification against `https://github.com/vercel/next.js`
- Live GitHub org fetch verification against `https://github.com/vercel`
