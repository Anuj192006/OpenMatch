import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Github, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

const steps = ["Skills", "Experience", "Interests", "Review"];

const skillOptions = [
  "React",
  "JavaScript",
  "TypeScript",
  "Python",
  "C++",
  "Java",
  "Node.js",
  "APIs",
  "Backend",
  "Frontend",
  "Machine Learning",
  "NLP",
  "Data Science",
  "Data Structures",
  "DevOps",
  "Testing",
  "Documentation",
  "Security",
];

const experienceOptions = ["Beginner", "Intermediate", "Advanced"];
const openSourceOptions = [
  "Never Contributed",
  "Beginner Contributor",
  "Intermediate Contributor",
  "Experienced Contributor",
];
const interestOptions = [
  "AI/ML",
  "Frontend",
  "Backend",
  "DevTools",
  "Open Source",
  "Security",
  "Systems",
  "Data Science",
  "Documentation",
];
const difficultyOptions = ["Good First Issue", "Beginner", "Intermediate", "Challenging"];

type OnboardingPanelProps = {
  profile: UserProfile;
  githubUrl: string;
  loading: boolean;
  onChange: (patch: Partial<UserProfile>) => void;
  onGitHubUrlChange: (value: string) => void;
  onSubmit: () => Promise<void>;
};

function getSkillLevelLabel(value: number) {
  if (value <= 30) {
    return "Beginner";
  }

  if (value <= 60) {
    return "Intermediate";
  }

  if (value <= 85) {
    return "Strong";
  }

  return "Advanced";
}

export function OnboardingPanel({
  profile,
  githubUrl,
  loading,
  onChange,
  onGitHubUrlChange,
  onSubmit,
}: OnboardingPanelProps) {
  const [step, setStep] = React.useState(0);
  const [error, setError] = React.useState("");

  function toggleInterest(value: string) {
    const current = profile.interests;
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    onChange({ interests: next });
  }

  function toggleSkill(value: string) {
    const currentSkills = { ...profile.skills };

    if (value in currentSkills) {
      delete currentSkills[value];
    } else {
      currentSkills[value] = 60;
    }

    onChange({ skills: currentSkills });
  }

  function updateSkillValue(skill: string, value: number) {
    onChange({
      skills: {
        ...profile.skills,
        [skill]: value,
      },
    });
  }

  function validateStep(currentStep: number) {
    if (currentStep === 0 && Object.keys(profile.skills).length === 0) {
      setError("Choose at least one skill so OpenMatch can score issue fit accurately.");
      return false;
    }

    if (currentStep === 2 && profile.interests.length === 0) {
      setError("Pick at least one interest to steer recommendations toward the work you want to do.");
      return false;
    }

    setError("");
    return true;
  }

  async function handleNext() {
    if (!validateStep(step)) {
      return;
    }

    if (step === steps.length - 1) {
      await onSubmit();
      return;
    }

    setStep((current) => current + 1);
  }

  function handlePrevious() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  const selectedSkills = skillOptions.filter((skill) => skill in profile.skills);

  return (
    <Card id="match-form" className="border-white/80 bg-white/90 backdrop-blur-sm">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">Developer profile</p>
            <CardTitle className="mt-2 text-2xl">Start Matching</CardTitle>
          </div>
          <div className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
            Step {step + 1} of {steps.length}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{steps[step]}</span>
            <span>{Math.round(((step + 1) / steps.length) * 100)}%</span>
          </div>
          <Progress value={((step + 1) / steps.length) * 100} />
        </div>
        <CardDescription>
          Build a profile once, then let OpenMatch rank issues that fit your actual contribution path.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-6"
          >
            {step === 0 && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Choose your core skills</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      OpenMatch uses weighted skill strength as the strongest ranking signal.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skillOptions.map((skill) => {
                      const selected = skill in profile.skills;
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                            selected
                              ? "border-primary/15 bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-accent"
                          )}
                        >
                          {selected && <Check className="h-3.5 w-3.5" />}
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selectedSkills.length > 0 && (
                  <div className="space-y-3 rounded-[24px] border border-border/80 bg-muted/40 p-4">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">How confident are you in this skill?</h4>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        OpenMatch uses your confidence percentages to weight issue fit more realistically.
                      </p>
                    </div>
                    <div className="space-y-4">
                      {selectedSkills.map((skill) => {
                        const value = profile.skills[skill] ?? 0;
                        return (
                          <div key={skill} className="space-y-3 rounded-[22px] border border-border bg-card/80 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-foreground">{skill}</p>
                                <p className="text-sm text-muted-foreground">Confidence drives weighted skill-strength scoring.</p>
                              </div>
                              <div className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
                                {value}% • {getSkillLevelLabel(value)}
                              </div>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={value}
                              onChange={(event) => updateSkillValue(skill, Number(event.target.value))}
                              className="skill-slider"
                            />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>0%</span>
                              <span>30%</span>
                              <span>60%</span>
                              <span>85%</span>
                              <span>100%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="rounded-[24px] border border-border/80 bg-muted/40 p-4">
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <Github className="h-4 w-4 text-muted-foreground" />
                    GitHub username
                  </label>
                  <Input
                    placeholder="Optional"
                    value={profile.github_username}
                    onChange={(event) => onChange({ github_username: event.target.value })}
                  />
                </div>
                <div className="rounded-[24px] border border-border/80 bg-muted/40 p-4">
                  <label className="mb-2 block text-sm font-medium text-foreground">Paste a GitHub repo or organization URL</label>
                  <Input
                    placeholder="https://github.com/vercel/next.js or https://github.com/vercel"
                    value={githubUrl}
                    onChange={(event) => onGitHubUrlChange(event.target.value)}
                  />
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Supports repository URLs, repository issues URLs, and organization URLs. Leave blank to use the local mock issue dataset.
                  </p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">How experienced are you?</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      These selections help keep the recommendations realistic, not aspirational.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {experienceOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onChange({ experience_level: option })}
                        className={cn(
                          "rounded-[22px] border p-4 text-left transition-all",
                          profile.experience_level === option
                            ? "border-primary/20 bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:border-primary/20 hover:bg-accent/70"
                        )}
                      >
                        <div className="font-semibold text-foreground">{option}</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {option === "Beginner" && "You are still building confidence with production code."}
                          {option === "Intermediate" && "You can ship scoped features and debug across modules."}
                          {option === "Advanced" && "You are comfortable navigating larger systems and tradeoffs."}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">Open-source contribution history</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {openSourceOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onChange({ open_source_experience: option })}
                        className={cn(
                          "rounded-[22px] border p-4 text-left transition-all",
                          profile.open_source_experience === option
                            ? "border-primary/20 bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:border-primary/20 hover:bg-accent/70"
                        )}
                      >
                        <div className="font-semibold text-foreground">{option}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">What kinds of work interest you?</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Interest alignment helps prevent technically valid but unmotivating recommendations.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((interest) => {
                      const selected = profile.interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                            selected
                              ? "border-primary/15 bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-accent"
                          )}
                        >
                          {selected && <Check className="h-3.5 w-3.5" />}
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">Preferred difficulty</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {difficultyOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onChange({ preferred_difficulty: option })}
                        className={cn(
                          "rounded-[22px] border p-4 text-left transition-all",
                          profile.preferred_difficulty === option
                            ? "border-primary/20 bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:border-primary/20 hover:bg-accent/70"
                        )}
                      >
                        <div className="font-semibold text-foreground">{option}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="rounded-[24px] border border-border bg-muted/40 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Ready to rank issues
                  </div>
                  <div className="mt-4 space-y-4 text-sm">
                    <div>
                      <p className="font-medium text-foreground">Skills</p>
                      <p className="mt-1 leading-6 text-muted-foreground">
                        {selectedSkills.map((skill) => `${skill} ${profile.skills[skill]}%`).join(", ")}
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="font-medium text-foreground">Experience level</p>
                        <p className="mt-1 text-muted-foreground">{profile.experience_level}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Open-source experience</p>
                        <p className="mt-1 text-muted-foreground">{profile.open_source_experience}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Interests</p>
                        <p className="mt-1 leading-6 text-muted-foreground">{profile.interests.join(", ")}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Difficulty target</p>
                        <p className="mt-1 text-muted-foreground">{profile.preferred_difficulty}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="font-medium text-foreground">Issue source</p>
                        <p className="mt-1 leading-6 text-muted-foreground">
                          {githubUrl || "Local mock issue dataset"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {loading
              ? "Fetching issues and ranking them against your skill confidence profile..."
              : "You can adjust your profile and rerun matches anytime."}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={handlePrevious} disabled={step === 0 || loading}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button type="button" onClick={handleNext} disabled={loading}>
              {step === steps.length - 1 ? "Find Matching Issues" : "Continue"}
              {!loading && <ArrowRight className="h-4 w-4" />}
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
