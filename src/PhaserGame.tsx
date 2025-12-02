import { useLayoutEffect, useRef } from "react";
import Box from "@mui/material/Box";
import StartGame from "./game/main";
import { QuizManager } from "./quiz/QuizManager";

export interface IRefPhaserGame {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

export function PhaserGame() {
  const game = useRef<Phaser.Game | null>(null);

  useLayoutEffect(() => {
    if (game.current === null) {
      game.current = StartGame("game-container");
    }

    return () => {
      if (game.current) {
        game.current.destroy(true);
        if (game.current !== null) {
          game.current = null;
        }
      }
    };
  }, []);

  return (
    <>
      <Box
        id="game-container"
        sx={{
          width: "100%",
          height: "100%",
        }}
      />
      <QuizManager />
    </>
  );
}
