import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Stack,
  Chip,
  Card,
  CardContent,
} from "@mui/material";
import {
  EmojiEvents,
  Timer,
  Group,
  PlayArrow,
  Close,
} from "@mui/icons-material";

// Loading Modal
interface LoadingModalProps {
  open: boolean;
  message: string;
}

export function LoadingModal({ open, message }: LoadingModalProps) {
  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "background.paper",
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.05))",
        },
      }}
    >
      <DialogContent>
        <Stack spacing={3} alignItems="center" py={2}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" color="text.primary">
            {message}
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

// Lobby Modal
interface LobbyModalProps {
  open: boolean;
  title: string;
  message: string;
  playerCount: number;
  isAdmin: boolean;
  countdown: number;
  onStartGame?: () => void;
  onClose?: () => void;
}

export function LobbyModal({
  open,
  title,
  message,
  playerCount,
  isAdmin,
  countdown,
  onStartGame,
}: LobbyModalProps) {
  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "background.paper",
          backgroundImage:
            "linear-gradient(135deg, rgba(92, 122, 255, 0.1) 0%, rgba(16, 19, 44, 0.9) 100%)",
          border: "2px solid",
          borderColor: "primary.main",
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Group color="primary" />
          <Typography variant="h5" fontWeight="bold">
            {title}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          <Card
            sx={{
              bgcolor: "rgba(0,0,0,0.3)",
              borderRadius: 2,
            }}
          >
            <CardContent>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {message}
              </Typography>

              <Stack direction="row" spacing={2} mt={2} flexWrap="wrap">
                <Chip
                  icon={<Group />}
                  label={`${playerCount} Players`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  icon={<Timer />}
                  label={`${countdown}s Game Time`}
                  color="secondary"
                  variant="outlined"
                />
                {isAdmin && (
                  <Chip
                    label="You are Admin"
                    color="success"
                    variant="filled"
                    sx={{ fontWeight: "bold" }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>

          {isAdmin && (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                As admin, you can start the game when ready
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        {isAdmin && onStartGame && (
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayArrow />}
            onClick={onStartGame}
            fullWidth
            sx={{
              py: 1.5,
              fontSize: "1.1rem",
              fontWeight: "bold",
              background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
              "&:hover": {
                background: "linear-gradient(45deg, #1976D2 30%, #0097A7 90%)",
              },
            }}
          >
            Start Game
          </Button>
        )}
        {!isAdmin && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", width: "100%" }}
          >
            Waiting for admin to start the game...
          </Typography>
        )}
      </DialogActions>
    </Dialog>
  );
}

// Results Modal
interface PlayerResult {
  sessionId: string;
  name: string;
  rank: number;
  result: string;
  score: number;
}

interface ResultsModalProps {
  open: boolean;
  title: string;
  winnerId: string | null;
  results: PlayerResult[];
  mySessionId: string;
  onClose?: () => void;
}

export function ResultsModal({
  open,
  title,
  winnerId,
  results,
  mySessionId,
  onClose,
}: ResultsModalProps) {
  const sortedResults = [...results].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.score - a.score;
  });

  const myResult = sortedResults.find((r) => r.sessionId === mySessionId);
  const isWinner = myResult?.sessionId === winnerId;

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: "background.paper",
          backgroundImage: isWinner
            ? "linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(16, 19, 44, 0.95) 100%)"
            : "linear-gradient(135deg, rgba(92, 122, 255, 0.1) 0%, rgba(16, 19, 44, 0.9) 100%)",
          border: "2px solid",
          borderColor: isWinner ? "warning.main" : "primary.main",
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <EmojiEvents
            sx={{
              color: isWinner ? "warning.main" : "primary.main",
              fontSize: 32,
            }}
          />
          <Typography variant="h5" fontWeight="bold">
            {title}
          </Typography>
        </Stack>
        {onClose && (
          <Button
            onClick={onClose}
            sx={{ position: "absolute", right: 8, top: 8 }}
            color="inherit"
          >
            <Close />
          </Button>
        )}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {isWinner && (
            <Card
              sx={{
                bgcolor: "rgba(255, 215, 0, 0.1)",
                border: "2px solid",
                borderColor: "warning.main",
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <EmojiEvents sx={{ color: "warning.main", fontSize: 48 }} />
                  <Box>
                    <Typography
                      variant="h5"
                      fontWeight="bold"
                      color="warning.main"
                    >
                      Congratulations!
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      You won the game! 🎉
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Typography variant="h6" gutterBottom>
            Final Standings
          </Typography>

          <Stack spacing={1.5}>
            {sortedResults.map((player, index) => {
              const isMe = player.sessionId === mySessionId;
              const isTop3 = index < 3;

              return (
                <Card
                  key={player.sessionId}
                  sx={{
                    bgcolor: isMe
                      ? "rgba(33, 150, 243, 0.15)"
                      : "rgba(0,0,0,0.3)",
                    border: isMe ? "2px solid" : "1px solid",
                    borderColor: isMe
                      ? "primary.main"
                      : "rgba(255,255,255,0.1)",
                    borderRadius: 2,
                  }}
                >
                  <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor:
                            index === 0
                              ? "warning.main"
                              : index === 1
                              ? "grey.400"
                              : index === 2
                              ? "#CD7F32"
                              : "grey.700",
                          fontWeight: "bold",
                          fontSize: "1.2rem",
                        }}
                      >
                        {isTop3 ? "🏆" : `#${player.rank}`}
                      </Box>

                      <Box flex={1}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body1" fontWeight="bold">
                            {player.name}
                          </Typography>
                          {isMe && (
                            <Chip label="You" size="small" color="primary" />
                          )}
                          {player.sessionId === winnerId && (
                            <Chip
                              label="Winner"
                              size="small"
                              color="warning"
                              sx={{ fontWeight: "bold" }}
                            />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {player.result === "winner"
                            ? "🎉 Champion"
                            : player.result === "finished"
                            ? "✅ Finished"
                            : player.result === "timeout"
                            ? "⏱️ Time's Up"
                            : "❌ Did Not Finish"}
                        </Typography>
                      </Box>

                      <Box textAlign="right">
                        <Typography
                          variant="h6"
                          fontWeight="bold"
                          color="primary"
                        >
                          {player.score}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          points
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        {onClose && (
          <Button
            variant="contained"
            size="large"
            onClick={onClose}
            fullWidth
            sx={{ py: 1.5 }}
          >
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
