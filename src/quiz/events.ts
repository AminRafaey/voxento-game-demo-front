export const QUIZ_EVENT_OPENED = "voxento.quiz.opened";
export const QUIZ_EVENT_CLOSED = "voxento.quiz.closed";
export const QUIZ_EVENT_ANSWERED = "voxento.quiz.answered";
export const QUIZ_AVAILABILITY_CHANGED = "voxento.quiz.availability";

export interface QuizAnsweredDetail {
  questionId: string;
  optionId: string;
  correct: boolean;
}

export interface QuizAvailabilityDetail {
  available: boolean;
}

declare global {
  interface WindowEventMap {
    "voxento.quiz.opened": CustomEvent<undefined>;
    "voxento.quiz.closed": CustomEvent<undefined>;
    "voxento.quiz.answered": CustomEvent<QuizAnsweredDetail>;
    "voxento.quiz.availability": CustomEvent<QuizAvailabilityDetail>;
  }
}

export type QuizLifecycleEvent =
  | typeof QUIZ_EVENT_OPENED
  | typeof QUIZ_EVENT_CLOSED
  | typeof QUIZ_EVENT_ANSWERED;

export type QuizAnsweredEvent = CustomEvent<QuizAnsweredDetail>;
export type QuizAvailabilityEvent = CustomEvent<QuizAvailabilityDetail>;
