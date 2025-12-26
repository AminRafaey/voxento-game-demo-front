// Modal state management for Phaser-React communication
export type ModalType = "loading" | "lobby" | "results" | null;

export interface LoadingModalState {
  message: string;
}

export interface LobbyModalState {
  title: string;
  message: string;
  playerCount: number;
  isAdmin: boolean;
  countdown: number;
}

export interface ResultsModalState {
  title: string;
  winnerId: string | null;
  results: Array<{
    sessionId: string;
    name: string;
    rank: number;
    result: string;
    score: number;
  }>;
  mySessionId: string;
}

export interface ModalState {
  type: ModalType;
  loading?: LoadingModalState;
  lobby?: LobbyModalState;
  results?: ResultsModalState;
}

class ModalManager {
  private listeners: Array<(state: ModalState) => void> = [];
  private currentState: ModalState = { type: null };

  subscribe(listener: (state: ModalState) => void) {
    this.listeners.push(listener);
    // Immediately send current state to new subscriber
    listener(this.currentState);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private setState(state: ModalState) {
    this.currentState = state;
    this.listeners.forEach((listener) => listener(state));
  }

  // Loading Modal
  showLoading(message: string) {
    this.setState({
      type: "loading",
      loading: { message },
    });
  }

  hideLoading() {
    if (this.currentState.type === "loading") {
      this.setState({ type: null });
    }
  }

  updateLoadingMessage(message: string) {
    if (this.currentState.type === "loading") {
      this.setState({
        type: "loading",
        loading: { message },
      });
    }
  }

  // Lobby Modal
  showLobby(options: LobbyModalState) {
    this.setState({
      type: "lobby",
      lobby: options,
    });
  }

  hideLobby() {
    if (this.currentState.type === "lobby") {
      this.setState({ type: null });
    }
  }

  updateLobby(options: Partial<LobbyModalState>) {
    if (this.currentState.type === "lobby" && this.currentState.lobby) {
      this.setState({
        type: "lobby",
        lobby: {
          ...this.currentState.lobby,
          ...options,
        },
      });
    }
  }

  // Results Modal
  showResults(options: ResultsModalState) {
    this.setState({
      type: "results",
      results: options,
    });
  }

  hideResults() {
    if (this.currentState.type === "results") {
      this.setState({ type: null });
    }
  }

  // General
  hideAll() {
    this.setState({ type: null });
  }

  getState() {
    return this.currentState;
  }
}

// Singleton instance
export const modalManager = new ModalManager();
