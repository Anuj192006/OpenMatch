export type SkillMap = Record<string, number>;

export type UserProfile = {
  skills: SkillMap;
  experience_level: string;
  open_source_experience: string;
  interests: string[];
  preferred_difficulty: string;
  github_username: string;
};

export type ScoreSection = {
  score: number;
  weighted_points: number;
  matched_skills?: string[];
  missing_skills?: string[];
  skill_scores?: Record<string, number>;
  avg_skill_strength?: number;
  matched_interests?: string[];
  focus_areas?: string[];
  user_preference?: string;
  issue_difficulty?: string;
  issue_quality_score?: number;
  labels_count?: number;
  days_open?: number;
  days_since_update?: number;
  comments?: number;
};

export type ScoreBreakdown = {
  skill_strength: ScoreSection;
  difficulty_fit: ScoreSection;
  interest_alignment: ScoreSection;
  issue_quality: ScoreSection;
  recency_activity: ScoreSection;
};

export type IssueRecommendation = {
  repository: string;
  issue_title: string;
  issue_description: string;
  labels: string[];
  required_skills: string[];
  difficulty: string;
  estimated_effort: string;
  url: string;
  created_at: string;
  updated_at: string;
  comments: number;
  state: string;
  author_association: string;
  issue_quality_score: number;
  focus_areas: string[];
  repo_language?: string;
  repo_topics?: string[];
  source_kind?: string;
  match_score: number;
  why_recommended: string;
  score_breakdown: ScoreBreakdown;
};

export type RecommendationResponse = {
  recommendations: IssueRecommendation[];
  source: string;
  issues_count: number;
  issues_fetched: number;
  used_fallback: boolean;
  fallback_reason?: string | null;
  source_kind: string;
  message?: string | null;
};

export type IssueFetchResponse = {
  source: string;
  issues_count: number;
  issues_fetched: number;
  issues: IssueRecommendation[];
  used_fallback: boolean;
  fallback_reason?: string | null;
  source_kind: string;
  message?: string | null;
};

export type SourceMeta = {
  source: string;
  issuesCount: number;
  issuesFetched: number;
  usedFallback: boolean;
  fallbackReason?: string;
  sourceKind: string;
  message?: string;
};

export type EnhancedExplanation = {
  enhanced_summary: string;
  personalized_reason: string;
  suggested_first_step: string;
  mode: "groq" | "fallback";
  message?: string;
};

export type SettingsValues = {
  groqKey: string;
  githubToken: string;
};
