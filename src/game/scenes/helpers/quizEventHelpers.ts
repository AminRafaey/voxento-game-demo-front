import {
  QUIZ_EVENT_ANSWERED,
  QUIZ_EVENT_CLOSED,
  QUIZ_EVENT_OPENED,
  type QuizAnsweredDetail,
} from "../../../quiz/events";

export type QuizEventBindings = {
  opened: () => void;
  closed: () => void;
  answered: (event: CustomEvent<QuizAnsweredDetail>) => void;
};

export function registerQuizEventListeners({
  onOpened,
  onClosed,
  onAnswered,
}: {
  onOpened: () => void;
  onClosed: () => void;
  onAnswered: (event: CustomEvent<QuizAnsweredDetail>) => void;
}): QuizEventBindings {
  window.addEventListener(QUIZ_EVENT_OPENED, onOpened);
  window.addEventListener(QUIZ_EVENT_CLOSED, onClosed);
  window.addEventListener(QUIZ_EVENT_ANSWERED, onAnswered);

  return {
    opened: onOpened,
    closed: onClosed,
    answered: onAnswered,
  };
}

export function unregisterQuizEventListeners(bindings?: QuizEventBindings) {
  if (!bindings) {
    return;
  }

  window.removeEventListener(QUIZ_EVENT_OPENED, bindings.opened);
  window.removeEventListener(QUIZ_EVENT_CLOSED, bindings.closed);
  window.removeEventListener(QUIZ_EVENT_ANSWERED, bindings.answered);
}
