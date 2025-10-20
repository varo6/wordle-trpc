import { Button } from "@/components/ui/button";
import { saveGameState, loadGameState, hasSavedGame } from "@/lib/cookies";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Binary, Code2, Terminal, Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BoardCell = { letter: string; status: "ok" | "almost" | "no" | null };
type GameBoard = Array<Array<BoardCell>>;

const createEmptyBoard = (): GameBoard =>
  Array(6)
    .fill(null)
    .map(() =>
      Array(5)
        .fill(null)
        .map(() => ({
          letter: "",
          status: null as "ok" | "almost" | "no" | null,
        })),
    );

const getEmojiForStatus = (status: "ok" | "almost" | "no" | null): string => {
  switch (status) {
    case "ok":
      return "🟩";
    case "almost":
      return "🟨";
    case "no":
      return "⬛";
    default:
      return "⬜";
  }
};

export const Route = createFileRoute("/words")({
  component: WordsRoute,
});

export function WordsRoute() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const isFeria = routerState.location.pathname.startsWith("/feriaciencia");
  const [word, setWord] = useState("");
  const [result, setResult] = useState<boolean | string | null>(null);
  const [showSavedGameNotice, setShowSavedGameNotice] = useState(false);

  // Game state
  const [currentRow, setCurrentRow] = useState(0);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameBoard, setGameBoard] = useState<GameBoard>(createEmptyBoard());

  // Keyboard state - tracking which keys have been used and their status
  const [keyStatus, setKeyStatus] = useState<
    Record<string, "ok" | "almost" | "no" | undefined>
  >({});

  // Shake animation state
  const [shakeRow, setShakeRow] = useState<number | null>(null);

  // Game over state
  const [gameOver, setGameOver] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false); // Flag for completed games
  const [won, setWon] = useState(false); // Flag to track if won
  const [feriaGameId, setFeriaGameId] = useState<string | null>(null);
  const [isStartingFeriaGame, setIsStartingFeriaGame] = useState(false);

  // Ref to store error message timeout
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const keyboard = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DEL"],
  ];

  const dailyTryWordMutation = useMutation(
    trpc.word.tryWord.mutationOptions({}),
  );
  const feriaTryWordMutation = useMutation(
    trpc.feriaciencia.tryWord.mutationOptions({}),
  );
  const startFeriaGameMutation = useMutation(
    trpc.feriaciencia.startGame.mutationOptions({}),
  );

  // Get time until next epoch for cookie expiration
  const { data: minutesToEpochData } = useQuery({
    ...trpc.word.timeToEpoch.queryOptions(),
    enabled: !isFeria,
  });
  const minutesToEpoch = !isFeria
    ? minutesToEpochData ?? 1440
    : undefined;

  // Get today's word for showing correct answer on loss
  const { data: todaysWord } = useQuery({
    ...trpc.word.getTodaysWord.queryOptions(),
    enabled: !isFeria,
  });

  const {
    data: feriaExplanationData,
    isFetching: isFetchingFeriaExplanation,
  } = useQuery({
    ...trpc.word.getWordExplanation.queryOptions(word || ""),
    enabled: isFeria && isCompleted && !!word,
  });

  const feriaEmojiBoard = useMemo(() => {
    if (!isFeria || !isCompleted) {
      return "";
    }
    const usedRows = Math.min(currentRow, gameBoard.length);
    return gameBoard
      .slice(0, usedRows)
      .map((row) => row.map((cell) => getEmojiForStatus(cell.status)).join(""))
      .join("\n");
  }, [isFeria, isCompleted, gameBoard, currentRow]);

  const resetGameState = useCallback(() => {
    setCurrentRow(0);
    setCurrentGuess("");
    setGameBoard(createEmptyBoard());
    setKeyStatus({});
    setShakeRow(null);
    setGameOver(false);
    setIsCompleted(false);
    setWon(false);
    setResult(null);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  }, []);

  const startFeriaGame = useCallback(() => {
    if (!isFeria) return;

    setIsStartingFeriaGame(true);
    setShowSavedGameNotice(false);
    setFeriaGameId(null);
    setWord("");
    resetGameState();

    startFeriaGameMutation.mutate(undefined, {
      onSuccess: (data) => {
        setFeriaGameId(data.gameId);
        setWord(data.word.toLowerCase());
      },
      onError: () => {
        setResult("No se pudo iniciar el juego. Intenta nuevamente.");
      },
      onSettled: () => {
        setIsStartingFeriaGame(false);
      },
    });
  }, [isFeria, resetGameState, startFeriaGameMutation]);

  useEffect(() => {
    if (isFeria && !feriaGameId && !isStartingFeriaGame) {
      startFeriaGame();
    }
  }, [isFeria, feriaGameId, isStartingFeriaGame, startFeriaGame]);

  // Handle try word with the current guess
  const handleTryWord = () => {
    const canSubmit =
      currentGuess.length === 5 &&
      !gameOver &&
      !isCompleted &&
      (!isFeria || (!!feriaGameId && !isStartingFeriaGame));

    if (!canSubmit) {
      if (isFeria && !feriaGameId && !isStartingFeriaGame) {
        setResult("Preparando nueva palabra...");
      }
      return;
    }

    const submittedGuess = currentGuess;
    const submittedRowIndex = currentRow;

    const handleSuccess = (data: {
      isValid: boolean;
      isCorrect: boolean;
      result: ("ok" | "almost" | "no")[];
      error?: string;
    }) => {
      if (!data.isValid) {
        setResult(
          data.error ?? "Palabra no encontrada en el diccionario",
        );
        // Clear any existing error timeout
        if (errorTimeoutRef.current) {
          clearTimeout(errorTimeoutRef.current);
        }
        // Trigger shake animation for invalid word
        setShakeRow(submittedRowIndex);
        setTimeout(() => setShakeRow(null), 600); // Remove shake after animation
        // Auto-dismiss error message after 4 seconds
        errorTimeoutRef.current = setTimeout(() => {
          setResult(null);
          errorTimeoutRef.current = null;
        }, 4000);
        return;
      }

      // Update the game board with results
      const newBoard = [...gameBoard];
      const guessArray = submittedGuess.split("");

      // Update the row with letter statuses
      const updatedRow = guessArray.map((letter, index) => ({
        letter,
        status: data.result[index],
      }));

      newBoard[submittedRowIndex] = updatedRow;
      setGameBoard(newBoard);

      // Update keyboard status
      const newKeyStatus = { ...keyStatus };
      guessArray.forEach((letter, index) => {
        const status = data.result[index];
        // Only update if the new status is better than existing
        // Priority: ok > almost > no
        const currentStatus = newKeyStatus[letter];
        if (
          !currentStatus ||
          (currentStatus === "no" && (status === "almost" || status === "ok")) ||
          (currentStatus === "almost" && status === "ok")
        ) {
          newKeyStatus[letter] = status;
        }
      });

      setKeyStatus(newKeyStatus);

      // Handle row advancement or win/loss
      setResult(null);
      if (data.isCorrect) {
        const victoryMessage =
          isFeria && word
            ? `¡Ganaste! La palabra era: ${word.toUpperCase()}`
            : "¡Ganaste! ¡Felicitaciones!";
        setResult(victoryMessage);
        setGameOver(true);
        setIsCompleted(true);
        setWon(true);
        // Move to next row and reset current guess
        const finalRow = currentRow + 1;
        setCurrentRow(finalRow);
        setCurrentGuess("");

        // Save game result for daily mode
        if (!isFeria) {
          const gameResult = {
            won: true,
            tries: finalRow,
            board: newBoard,
            targetWord: submittedGuess,
          };

          localStorage.setItem("wordleGameResult", JSON.stringify(gameResult));

          saveGameState(
            {
              currentRow: finalRow,
              gameBoard: newBoard,
              keyStatus: newKeyStatus,
              gameOver: true,
              currentGuess: "",
              lastSaved: Date.now(),
              isCompleted: true,
              won: true,
            },
            minutesToEpoch ?? 1440,
          );

          // Show loading message before redirect
          setTimeout(() => {
            setResult("Preparing results...");
          }, 1500);

          // Redirect after showing the win message and loading state
          setTimeout(() => {
            navigate({ to: "/result" });
          }, 2500);
        }
      } else {
        const nextRow = currentRow + 1;
        // Move to next row and reset current guess
        setCurrentRow(nextRow);
        setCurrentGuess("");
        // Check if we've reached maximum attempts (6 rows)
        if (nextRow >= 6) {
          setGameOver(true);
          setIsCompleted(true);
          setWon(false);
          setResult("¡Juego terminado! Mejor suerte la próxima vez.");

          const targetWordForResult = isFeria ? word : todaysWord;

          if (!isFeria) {
            const gameResult = {
              won: false,
              tries: nextRow,
              board: newBoard,
              targetWord: targetWordForResult,
            };

            localStorage.setItem(
              "wordleGameResult",
              JSON.stringify(gameResult),
            );

            saveGameState(
              {
                currentRow: nextRow,
                gameBoard: newBoard,
                keyStatus: newKeyStatus,
                gameOver: true,
                currentGuess: "",
                lastSaved: Date.now(),
                isCompleted: true,
                won: false,
              },
              minutesToEpoch ?? 1440,
            );

            // Show loading message before redirect
            setTimeout(() => {
              setResult("Preparando resultados...");
            }, 1500);

            // Redirect after showing the loss message and loading state
            setTimeout(() => {
              navigate({ to: "/result" });
            }, 2500);
          } else if (targetWordForResult) {
            setResult(
              `¡Juego terminado! La palabra era: ${targetWordForResult.toUpperCase()}`,
            );
          }
        }
      }
    };

    if (isFeria) {
      feriaTryWordMutation.mutate(
        {
          gameId: feriaGameId as string,
          guess: submittedGuess,
        },
        { onSuccess: handleSuccess },
      );
    } else {
      dailyTryWordMutation.mutate(submittedGuess, {
        onSuccess: handleSuccess,
      });
    }
  };

  // Handle key press (from physical keyboard or virtual keyboard)
  const handleKeyPress = (key: string) => {
    // Don't allow input if game is over or completed
    if (
      gameOver ||
      isCompleted ||
      (isFeria && (!feriaGameId || isStartingFeriaGame))
    )
      return;

    // Process different key types
    if (key === "ENTER") {
      // Only submit if we have 5 letters
      if (currentGuess.length === 5) {
        // Call handleTryWord - it will handle row increment and guess reset
        handleTryWord();
      }
    } else if (key === "DEL" || key === "BACKSPACE") {
      // Remove the last character from current guess
      setCurrentGuess((prev) => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key)) {
      // Add letter if we haven't filled all 5 spots
      if (currentGuess.length < 5) {
        setCurrentGuess((prev) => prev + key);
      }
    }
  };

  // Update the game board display to show the current guess while typing
  useEffect(() => {
    // Only update if we're in an active game and within bounds
    if (currentRow >= 6 || isCompleted) return;

    // Check if the current row already has submitted results (has status)
    const currentRowData = gameBoard[currentRow];
    const hasSubmittedResults =
      currentRowData && currentRowData.some((cell) => cell.status !== null);

    // Don't overwrite submitted results - only update for typing preview
    if (hasSubmittedResults) return;

    // Create new row with current guess (for typing preview only)
    const newRow = Array(5)
      .fill(null)
      .map((_, index) => ({
        letter: currentGuess[index] || "",
        status: null as "ok" | "almost" | "no" | null,
      }));

    // Update the board for typing preview
    setGameBoard((prevBoard) => {
      const newBoard = [...prevBoard];
      newBoard[currentRow] = newRow;
      return newBoard;
    });
  }, [currentGuess, currentRow, isCompleted]);

  // Load saved game state when component mounts
  useEffect(() => {
    if (isFeria) {
      return;
    }
    // Check if there's a saved game in cookies
    if (hasSavedGame()) {
      const savedState = loadGameState();
      if (savedState) {
        setCurrentRow(savedState.currentRow);
        setGameBoard(savedState.gameBoard);
        setKeyStatus(savedState.keyStatus);
        setGameOver(savedState.gameOver);
        setCurrentGuess(savedState.currentGuess || "");
        setIsCompleted(savedState.isCompleted || false);
        setWon(savedState.won || false);
        setShowSavedGameNotice(true);
        console.log("Loaded saved game from cookies");

        // Set result based on completed state
        if (savedState.isCompleted) {
          setResult(
            savedState.won
              ? "¡Ganaste! ¡Felicitaciones!"
              : "¡Juego terminado! Mejor suerte la próxima vez.",
          );
        }

        // Hide the notice after 5 seconds
        setTimeout(() => setShowSavedGameNotice(false), 5000);
      }
    }
  }, []);

  // Recrear localStorage para resultados si el juego está completado (para el botón "Ver Resultados")
  useEffect(() => {
    if (isFeria) {
      return;
    }
    if (isCompleted && gameBoard && currentRow > 0) {
      let targetWord = todaysWord || ""; // Default para losses
      let tries = won ? currentRow : 6;

      if (won) {
        // Para wins, extraer el targetWord de la última fila completada
        const lastRow = gameBoard[currentRow - 1]; // currentRow es el siguiente después del win
        targetWord = lastRow.map((cell) => cell.letter).join("");
      }

      const gameResult = {
        won,
        tries,
        board: gameBoard,
        targetWord,
      };

      localStorage.setItem("wordleGameResult", JSON.stringify(gameResult));
    }
  }, [isFeria, isCompleted, won, gameBoard, currentRow, todaysWord]);

  // Save game state to cookies whenever it changes
  useEffect(() => {
    if (isFeria) {
      return;
    }
    if (currentRow > 0 || Object.keys(keyStatus).length > 0) {
      const gameState = {
        currentRow,
        gameBoard,
        keyStatus,
        gameOver,
        currentGuess,
        lastSaved: Date.now(),
        isCompleted,
        won,
      };
      saveGameState(gameState, minutesToEpoch);
    }
  }, [
    currentRow,
    gameBoard,
    keyStatus,
    gameOver,
    currentGuess,
    isCompleted,
    won,
    minutesToEpoch,
    isFeria,
  ]);

  // Listen for physical keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let key = e.key.toUpperCase();

      // Map backspace key to DEL
      if (key === "BACKSPACE") key = "DEL";

      // Only process valid keys: letters, ENTER, or DEL
      if (key === "ENTER" || key === "DEL" || /^[A-Z]$/.test(key)) {
        handleKeyPress(key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentGuess,
    currentRow,
    gameBoard,
    gameOver,
    isCompleted,
    isFeria,
    feriaGameId,
    isStartingFeriaGame,
  ]);

  // Cleanup error timeout on component unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="mobile-layout min-h-screen bg-white w-full overflow-x-hidden">
      {/* CSS for shake animation */}
      <style>{`
        @keyframes shake {
          0% { transform: translateX(0); }
          10% { transform: translateX(-5px); }
          20% { transform: translateX(5px); }
          30% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          50% { transform: translateX(-5px); }
          60% { transform: translateX(5px); }
          70% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
          90% { transform: translateX(-5px); }
          100% { transform: translateX(0); }
        }
        .animate-shake {
          animation: shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>

      {/* Game Container */}
      <main className="mobile-content w-full max-w-full mx-auto overflow-x-hidden">
        <div className="mobile-game-section">
          {/* Status Bar */}
          <div className="mobile-status-bar mb-4 sm:mb-6 lg:mb-8 mt-2 sm:mt-4 lg:mt-6 p-3 sm:p-4 lg:p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex flex-col items-center sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 lg:gap-6">
              <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 text-sm sm:text-base lg:text-lg font-mono text-center sm:text-left">
                <Code2 className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-600" />
                <span className="text-blue-700">ESTADO DEL SISTEMA:</span>
                <span className="text-blue-600 animate-pulse">
                  LISTO_PARA_ENTRADA
                </span>
              </div>
              {!isFeria && minutesToEpoch && (
                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 text-sm sm:text-base lg:text-lg font-mono text-center sm:text-left">
                  <Terminal className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-600" />
                  <span className="text-blue-700">PRÓXIMA_PALABRA_EN:</span>
                  <span className="text-blue-600 font-bold">
                    {Math.floor(minutesToEpoch / 60)}h {minutesToEpoch % 60}m
                  </span>
                </div>
              )}
              {isFeria && (
                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 text-sm sm:text-base lg:text-lg font-mono text-center sm:text-left">
                  <Terminal className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-600" />
                  <span className="text-blue-700">MODO:</span>
                  <span className="text-blue-600 font-bold uppercase">
                    {isStartingFeriaGame ? "Generando..." : "Palabra aleatoria"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Saved Game Notice */}
          {!isFeria && showSavedGameNotice && (
            <div className="pc-saved-notice mb-4 sm:mb-6 lg:mb-8 mt-2 sm:mt-4 lg:mt-6 p-3 sm:p-4 lg:p-6 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex flex-col items-center sm:flex-row sm:items-center gap-2 sm:gap-3 lg:gap-4 text-sm sm:text-base lg:text-lg font-mono text-center sm:text-left">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Binary className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-green-600" />
                  <span className="text-green-700">JUEGO_RESTAURADO:</span>
                </div>
                <span className="text-green-600">
                  Sesión anterior cargada desde caché
                </span>
              </div>
            </div>
          )}

          {/* Game Board */}
          {(!isFeria || !isCompleted) && (
            <div className="mobile-game-board mb-2 sm:mb-4 flex justify-center w-full px-1 sm:px-4">
              <div className="wordle-board grid grid-rows-6 gap-1 sm:gap-3 w-full max-w-[300px] sm:max-w-[500px] lg:max-w-[400px] mx-auto">
                {gameBoard.map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className={`wordle-row grid grid-cols-5 gap-1 sm:gap-3 ${
                      shakeRow === rowIndex ? "animate-shake" : ""
                    }`}
                  >
                    {row.map((cell, cellIndex) => {
                      let cellClasses = ["wordle-cell"];

                      // Add state-specific classes
                      if (cell.status === "ok") {
                        cellClasses.push("correct");
                      } else if (cell.status === "almost") {
                        cellClasses.push("almost");
                      } else if (cell.status === "no" && cell.letter) {
                        cellClasses.push("wrong");
                      } else if (cell.letter && cell.status === null) {
                        cellClasses.push("filled");
                      }

                      // Add responsive and interaction classes
                      cellClasses.push(
                        "aspect-square",
                        "border-2",
                        "rounded-lg",
                        "flex",
                        "items-center",
                        "justify-center",
                        "font-mono",
                        "text-xl",
                        "sm:text-2xl",
                        "lg:text-2xl",
                        "font-bold",
                        "transition-all",
                        "duration-300",
                        "hover:border-blue-300",
                        "relative",
                        "overflow-hidden",
                        "group",
                        "min-h-[50px]",
                        "min-w-[50px]",
                        "sm:min-h-[70px]",
                        "sm:min-w-[70px]",
                        "lg:min-h-[60px]",
                        "lg:min-w-[60px]",
                      );

                      // Add current row border if typing
                      if (
                        rowIndex === currentRow &&
                        !isCompleted &&
                        cell.status === null
                      ) {
                        cellClasses.push("border-blue-400");
                      }

                      return (
                        <div key={cellIndex} className={cellClasses.join(" ")}>
                          {/* Hacky grid effect */}
                          <div className="absolute inset-0 opacity-5">
                            <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(59,130,246,0.05)_25%,rgba(59,130,246,0.05)_26%,transparent_27%,transparent_74%,rgba(59,130,246,0.05)_75%,rgba(59,130,246,0.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(59,130,246,0.05)_25%,rgba(59,130,246,0.05)_26%,transparent_27%,transparent_74%,rgba(59,130,246,0.05)_75%,rgba(59,130,246,0.05)_76%,transparent_77%,transparent)] bg-[length:20px_20px]" />
                          </div>

                          {/* Letter display */}
                          <span className="relative z-10">{cell.letter}</span>

                          {/* Glitch effect on hover */}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="absolute inset-0 bg-blue-400 opacity-10 animate-pulse" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Game Message and View Results Button */}
          {isCompleted && (
            <div className="pc-message-container mb-4 sm:mb-6 lg:mb-8 mt-4 sm:mt-6 lg:mt-8 p-3 sm:p-4 lg:p-6 border rounded-lg bg-green-50 border-green-200 text-center">
              <p className="font-mono text-sm sm:text-base lg:text-lg text-green-700">
                {result}
              </p>

              {isFeria && (
                <div className="mt-4 sm:mt-6 text-left">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    <span className="font-mono text-sm sm:text-base text-blue-700">
                      EXPLICACIÓN_DE_LA_PALABRA
                    </span>
                  </div>
                  <div className="bg-white border border-blue-200 rounded-lg p-3 sm:p-4">
                    <h3 className="font-mono text-base sm:text-lg font-bold text-blue-700 uppercase mb-2">
                      {((feriaExplanationData?.word ?? word) || "").toUpperCase()}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                      {isFetchingFeriaExplanation
                        ? "Cargando explicación..."
                        : feriaExplanationData?.explanation ??
                          "No hay explicación disponible para esta palabra."}
                    </p>
                    {feriaEmojiBoard && (
                      <pre className="mt-4 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 font-mono text-base sm:text-lg leading-[1.7] whitespace-pre-wrap">
                        {feriaEmojiBoard}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              <Button
                onClick={() => {
                  if (isFeria) {
                    startFeriaGame();
                  } else {
                    navigate({ to: "/result" });
                  }
                }}
                disabled={isFeria && isStartingFeriaGame}
                className="mt-3 sm:mt-4 lg:mt-6 font-mono bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base lg:text-lg px-4 py-2 lg:px-6 lg:py-3 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isFeria ? "Jugar de nuevo" : "Ver Resultados"}
              </Button>
            </div>
          )}

          {/* Error Message */}
          {result !== null &&
            typeof result === "string" &&
            result !== "¡Ganaste! ¡Felicitaciones!" &&
            !isCompleted && (
              <div className="pc-message-container mb-4 sm:mb-6 lg:mb-8 mt-4 sm:mt-6 lg:mt-8 p-3 sm:p-4 lg:p-6 border rounded-lg bg-red-50 border-red-200 text-center">
                <p className="font-mono text-sm sm:text-base lg:text-lg text-red-700">
                  {result}
                </p>
              </div>
            )}
        </div>

        {/* Virtual Keyboard (disabled if completed) */}
        {(!isFeria || !isCompleted) && (
          <div className="mobile-keyboard-section w-full sm:max-w-4xl lg:max-w-2xl mx-auto px-1 sm:px-4 overflow-x-hidden">
            <div className="mobile-keyboard space-y-1 sm:space-y-3">
              {keyboard.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="flex w-full gap-0.5 sm:gap-2 justify-center"
                >
                  {row.map((key) => {
                    const status = keyStatus[key];
                    let bgColor = "bg-white";
                    let borderColor = "border-gray-300";

                    if (status === "ok") {
                      bgColor = "bg-blue-500";
                      borderColor = "border-blue-600";
                    } else if (status === "almost") {
                      bgColor = "bg-blue-200";
                      borderColor = "border-blue-300";
                    } else if (status === "no") {
                      bgColor = "bg-gray-200";
                      borderColor = "border-gray-300";
                    }

                    return (
                      <button
                        key={key}
                        onClick={() => handleKeyPress(key)}
                        disabled={gameOver || isCompleted}
                        className={`
                         ${key === "ENTER" || key === "DEL" ? "flex-[1.5] sm:px-3 lg:px-4 min-w-[50px] sm:min-w-[70px] max-w-[80px]" : "flex-1 sm:w-10 lg:w-12 min-w-[32px] max-w-[50px]"}
                          h-10 sm:h-16 lg:h-12 ${bgColor} border-2 ${borderColor} rounded-lg
                          font-mono font-semibold text-xs sm:text-lg lg:text-base text-gray-900
                         ${gameOver || isCompleted ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-50 hover:border-blue-400 hover:shadow-md active:scale-95"}
                         transition-all duration-150
                         relative overflow-hidden group
                          min-h-[44px] sm:min-h-[64px] lg:min-h-[48px] touch-manipulation
                       `}
                      >
                        {/* Tech pattern overlay */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-transparent" />
                        </div>

                        <span className="relative z-10">{key}</span>

                        {/* Corner accent */}
                        <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 sm:mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-8 text-center px-2 sm:px-0">
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-10 sm:h-10 bg-blue-500 rounded border-2 border-blue-600" />
                <span className="text-sm sm:text-base font-mono text-gray-600">
                  CORRECTO (OK)
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-10 sm:h-10 bg-blue-200 rounded border-2 border-blue-300" />
                <span className="text-sm sm:text-base font-mono text-gray-600">
                  POSICIÓN_INCORRECTA (CASI)
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-10 sm:h-10 bg-gray-200 rounded border-2 border-gray-300" />
                <span className="text-sm sm:text-base font-mono text-gray-600">
                  NO_ENCONTRADA (NO)
                </span>
              </div>
            </div>

            {/* Tech decoration */}
            <div className="mt-4 sm:mt-6 text-center">
              <div className="inline-flex items-center gap-2 text-sm font-mono text-blue-600">
                <span className="animate-pulse">▓</span>
                <span>TERMINAL.LISTO</span>
                <span className="animate-pulse">▓</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
