export interface QuizOption {
  id: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  category?: string;
  difficulty?: string;
  explanation?: string;
  source?: string;
}
