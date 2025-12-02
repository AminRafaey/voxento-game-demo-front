import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import QuizIcon from "@mui/icons-material/Quiz";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  QUIZ_EVENT_ANSWERED,
  QUIZ_EVENT_CLOSED,
  QUIZ_EVENT_OPENED,
} from "./events";
import type { QuizQuestion } from "./types";
import { useQuizQuestions } from "./useQuizQuestions";
import { toast } from "react-toastify";

const QUIZ_REWARD_AMOUNT = 10;

export function QuizManager() {
  const { questions, loading, error, reload } = useQuizQuestions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<QuizQuestion | null>(
    null
  );
  const dialogOpenRef = useRef(dialogOpen);

  useEffect(() => {
    dialogOpenRef.current = dialogOpen;
  }, [dialogOpen]);

  useEffect(() => {
    return () => {
      if (dialogOpenRef.current) {
        dispatchEvent(new CustomEvent(QUIZ_EVENT_CLOSED));
      }
    };
  }, []);

  const handleStartQuiz = useCallback(() => {
    if (dialogOpen || loading) {
      return;
    }

    if (questions.length === 0) {
      toast.warning("No quiz questions available right now.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * questions.length);
    const question = questions[randomIndex];

    setActiveQuestion(question);
    setDialogOpen(true);
    dispatchEvent(new CustomEvent(QUIZ_EVENT_OPENED));
  }, [dialogOpen, loading, questions, error]);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen((wasOpen) => {
      if (wasOpen) {
        dispatchEvent(new CustomEvent(QUIZ_EVENT_CLOSED));
      }
      return false;
    });

    setTimeout(() => {
      setActiveQuestion(null);
    }, 200);
  }, []);

  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!activeQuestion) {
        return;
      }

      const correct = optionId === activeQuestion.correctOptionId;

      dispatchEvent(
        new CustomEvent(QUIZ_EVENT_ANSWERED, {
          detail: {
            questionId: activeQuestion.id,
            optionId,
            correct,
          },
        })
      );

      toast(
        correct
          ? `Correct! +${QUIZ_REWARD_AMOUNT} health awarded.`
          : "Close! Try another quiz soon.",
        {
          type: correct ? "success" : "warning",
        }
      );

      handleCloseDialog();
    },
    [activeQuestion, handleCloseDialog]
  );

  const quizTooltip = loading
    ? "Loading quiz questions..."
    : error
    ? "Using fallback questions. Click refresh to retry."
    : "Answer a quiz for a health bonus.";

  const disabled = loading || dialogOpen;

  return (
    <>
      <Box
        sx={{
          position: "absolute",
          bottom: 24,
          right: 24,
          zIndex: (theme) => theme.zIndex.modal - 10,
          pointerEvents: "none",
        }}
      >
        <Stack spacing={1} alignItems="flex-end" sx={{ pointerEvents: "auto" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={quizTooltip} placement="top" arrow>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<QuizIcon />}
                  disabled={disabled || questions.length === 0}
                  onClick={handleStartQuiz}
                >
                  {loading ? "Loading..." : "Take Quiz"}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Reload quiz questions" placement="top" arrow>
              <span>
                <IconButton
                  color="primary"
                  disabled={loading}
                  onClick={reload}
                  size="medium"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          {error ? (
            <Typography variant="caption" color="warning.main">
              Using fallback questions.
            </Typography>
          ) : null}
        </Stack>
      </Box>

      <Dialog
        open={dialogOpen && Boolean(activeQuestion)}
        maxWidth="sm"
        fullWidth
        keepMounted
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" gutterBottom>
                {activeQuestion?.category ?? "Quick Quiz"}
              </Typography>
              <Typography variant="subtitle1" color="text.primary">
                {activeQuestion?.prompt}
              </Typography>
            </Box>
            <IconButton
              onClick={handleCloseDialog}
              edge="end"
              aria-label="Close quiz dialog"
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {activeQuestion ? (
            <List>
              {activeQuestion.options.map((option) => (
                <ListItemButton
                  key={option.id}
                  sx={{ borderRadius: 1, mb: 1 }}
                  onClick={() => handleAnswer(option.id)}
                >
                  <ListItemText primary={option.label} />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No quiz question loaded.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          {activeQuestion?.difficulty ? (
            <Typography variant="caption" color="text.secondary">
              Difficulty: {activeQuestion.difficulty}
            </Typography>
          ) : (
            <span />
          )}
          <Button onClick={handleCloseDialog} color="inherit">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default QuizManager;
