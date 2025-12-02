import { useMemo } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { PhaserGame } from "./PhaserGame";
import { ToastContainer } from "react-toastify";

function App() {
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: "dark",
          primary: { main: "#90caf9" },
          secondary: { main: "#f48fb1" },
          background: {
            default: "#050505",
            paper: "#121212",
          },
        },
        shape: { borderRadius: 10 },
        components: {
          MuiDialog: {
            styleOverrides: {
              paper: {
                backgroundImage: "none",
              },
            },
          },
        },
      }),
    []
  );

  return (
    <ThemeProvider theme={theme}>
      <ToastContainer
        position="top-right"
        autoClose={2000}
        hideProgressBar
        newestOnTop
        rtl={false}
        pauseOnFocusLoss
        pauseOnHover
        stacked
      />
      <CssBaseline />
      <PhaserGame />
    </ThemeProvider>
  );
}

export default App;
