import { useCallback, useEffect, useState } from "react";
import type { QuizOption, QuizQuestion } from "./types";

const FALLBACK_QUESTIONS: QuizQuestion[] = [
  {
    id: "engine-basics",
    prompt: "Which engine powers the Voxento world you are exploring?",
    options: [
      { id: "engine-phaser", label: "Phaser" },
      { id: "engine-unity", label: "Unity" },
      { id: "engine-godot", label: "Godot" },
    ],
    correctOptionId: "engine-phaser",
    category: "Gameplay",
    difficulty: "easy",
  },
  {
    id: "movement-keys",
    prompt: "Which keys let you jump in the current build?",
    options: [
      { id: "jump-space", label: "Space or Up Arrow" },
      { id: "jump-enter", label: "Enter" },
      { id: "jump-shift", label: "Shift" },
    ],
    correctOptionId: "jump-space",
    category: "Controls",
    difficulty: "easy",
  },
  {
    id: "health-reward",
    prompt: "How much health can you gain for answering a quiz correctly?",
    options: [
      { id: "heal-five", label: "+5" },
      { id: "heal-ten", label: "+10" },
      { id: "heal-twenty", label: "+20" },
    ],
    correctOptionId: "heal-ten",
    category: "Systems",
    difficulty: "medium",
  },
  {
    id: "planet-count",
    prompt: "How many planets are in our solar system?",
    options: [
      { id: "planets-seven", label: "Seven" },
      { id: "planets-eight", label: "Eight" },
      { id: "planets-nine", label: "Nine" },
    ],
    correctOptionId: "planets-eight",
    category: "General Knowledge",
    difficulty: "easy",
  },
  {
    id: "water-boiling",
    prompt: "At what temperature (in °C) does water boil at sea level?",
    options: [
      { id: "water-90", label: "90°C" },
      { id: "water-95", label: "95°C" },
      { id: "water-100", label: "100°C" },
    ],
    correctOptionId: "water-100",
    category: "Science",
    difficulty: "easy",
  },
  {
    id: "largest-continent",
    prompt: "Which is the largest continent by land area?",
    options: [
      { id: "continent-africa", label: "Africa" },
      { id: "continent-asia", label: "Asia" },
      { id: "continent-north-america", label: "North America" },
    ],
    correctOptionId: "continent-asia",
    category: "Geography",
    difficulty: "medium",
  },
];

const parseApiQuestions = (payload: unknown): QuizQuestion[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  const result: QuizQuestion[] = [];

  payload.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const raw = entry as Record<string, unknown>;

    const prompt =
      typeof raw.prompt === "string"
        ? raw.prompt
        : typeof raw.question === "string"
        ? raw.question
        : typeof raw.title === "string"
        ? raw.title
        : null;

    if (!prompt) {
      return;
    }

    const id =
      typeof raw.id === "string"
        ? raw.id
        : typeof raw.slug === "string"
        ? raw.slug
        : `api-question-${index}`;

    const optionSource =
      Array.isArray(raw.options) && raw.options.length > 0
        ? (raw.options as unknown[])
        : Array.isArray(raw.answers)
        ? (raw.answers as unknown[])
        : Array.isArray(raw.choices)
        ? (raw.choices as unknown[])
        : null;

    if (!optionSource) {
      return;
    }

    const options: QuizOption[] = [];

    optionSource.forEach((item, optionIndex) => {
      if (typeof item === "string") {
        options.push({
          id: `${id}-option-${optionIndex}`,
          label: item,
        });
        return;
      }

      if (item && typeof item === "object") {
        const rawOption = item as Record<string, unknown>;
        const optionId =
          typeof rawOption.id === "string"
            ? rawOption.id
            : typeof rawOption.key === "string"
            ? rawOption.key
            : `${id}-option-${optionIndex}`;

        const label =
          typeof rawOption.label === "string"
            ? rawOption.label
            : typeof rawOption.text === "string"
            ? rawOption.text
            : typeof rawOption.title === "string"
            ? rawOption.title
            : null;

        if (!label) {
          return;
        }

        const metadata =
          rawOption.metadata && typeof rawOption.metadata === "object"
            ? (rawOption.metadata as Record<string, unknown>)
            : undefined;

        options.push({
          id: optionId,
          label,
          metadata,
        });
      }
    });

    if (options.length < 2) {
      return;
    }

    const resolveOptionByIndex = (candidateIndex: unknown) => {
      if (typeof candidateIndex === "number" && candidateIndex >= 0) {
        return options[candidateIndex]?.id;
      }
      return undefined;
    };

    const resolveFlaggedOptionId = () => {
      if (!Array.isArray(raw.options)) {
        return undefined;
      }

      const flagged = (raw.options as unknown[]).find((option) => {
        if (!option || typeof option !== "object") {
          return false;
        }
        const candidate = option as Record<string, unknown>;
        return candidate.correct === true || candidate.isCorrect === true;
      });

      if (!flagged) {
        return undefined;
      }

      const candidate = flagged as Record<string, unknown>;

      if (typeof candidate.id === "string") {
        return candidate.id;
      }

      const flaggedIndex = (raw.options as unknown[]).indexOf(flagged);
      return resolveOptionByIndex(flaggedIndex);
    };

    const preferredCorrectId =
      (typeof raw.correctOptionId === "string" && raw.correctOptionId) ||
      (typeof raw.correctAnswerId === "string" && raw.correctAnswerId) ||
      (typeof raw.correct === "string" && raw.correct) ||
      (typeof raw.answer === "string" &&
        options.find((option) => option.label === raw.answer)?.id) ||
      resolveFlaggedOptionId() ||
      resolveOptionByIndex(raw.correctIndex) ||
      resolveOptionByIndex(raw.correctAnswerIndex);

    if (!preferredCorrectId) {
      return;
    }

    const normalizedCorrectId =
      options.find((option) => option.id === preferredCorrectId)?.id ??
      options.find((option) => option.label === preferredCorrectId)?.id;

    if (!normalizedCorrectId) {
      return;
    }

    result.push({
      id,
      prompt,
      options,
      correctOptionId: normalizedCorrectId,
      category: typeof raw.category === "string" ? raw.category : undefined,
      difficulty:
        typeof raw.difficulty === "string" ? raw.difficulty : undefined,
      explanation:
        typeof raw.explanation === "string" ? raw.explanation : undefined,
      source: typeof raw.source === "string" ? raw.source : undefined,
    });
  });

  return result;
};

export function useQuizQuestions() {
  const [questions, setQuestions] =
    useState<QuizQuestion[]>(FALLBACK_QUESTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    const endpoint = import.meta.env.VITE_QUIZ_API_URL;
    if (!endpoint) {
      setQuestions(FALLBACK_QUESTIONS);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to load quiz data (${response.status})`);
      }

      const payload = await response.json();
      const parsed = parseApiQuestions(payload);

      if (parsed.length === 0) {
        throw new Error("Quiz API returned no valid questions");
      }

      setQuestions(parsed);
      setError(null);
    } catch (err) {
      console.error("[Quiz] Question load failed", err);
      setQuestions(FALLBACK_QUESTIONS);
      setError(err instanceof Error ? err.message : "Unknown quiz load error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions().catch((err) => {
      console.error("[Quiz] Unexpected loader failure", err);
    });
  }, [loadQuestions]);

  return {
    questions,
    loading,
    error,
    reload: loadQuestions,
  } as const;
}
