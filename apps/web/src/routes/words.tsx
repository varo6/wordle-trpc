import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Terminal, Cpu, Binary, Code2 } from "lucide-react";

import { trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  saveGameState,
  loadGameState,
  clearGameState,
  hasSavedGame,
} from "@/lib/cookies";

export const Route = createFileRoute("/words")({
  component: WordsRoute,
});

function WordsRoute() {
  const navigate = useNavigate();
  const [word, setWord] = useState("");
  const [result, setResult] = useState<boolean | string | null>(null);
  const [showSavedGameNotice, setShowSavedGameNotice] = useState(false);

  // Game state
  const [currentRow, setCurrentRow] = useState(0);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameBoard, setGameBoard] = useState(
    Array(6)
      .fill(null)
      .map(() => Array(5).fill({ letter: "", status: null })),
  );

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

  const keyboard = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DEL"],
  ];

  const tryWordMutation = useMutation(trpc.word.tryWord.mutationOptions({}));

  // Get time until next epoch for cookie expiration
  const { data: minutesToEpochData } = useQuery(
    trpc.word.timeToEpoch.queryOptions(),
  );
  const minutesToEpoch = minutesToEpochData ?? 1440; // Fallback to 1 day if undefined

  // Get today's word for showing correct answer on loss
  const { data: todaysWord } = useQuery(trpc.word.getTodaysWord.queryOptions());

  // Handle try word with the current guess
  const handleTryWord = () => {
    if (currentGuess.length === 5 && !gameOver && !isCompleted) {
      // Capture the current values before they change
      const submittedGuess = currentGuess;
      const submittedRowIndex = currentRow;

      // Pass the current guess to the mutation
      tryWordMutation.mutate(submittedGuess, {
        onSuccess: (data) => {
          console.log("Mutation result:", data);
          console.log(
            "Submitted guess:",
            submittedGuess,
            "Row:",
            submittedRowIndex,
          );

          if (!data.isValid) {
            setResult("Palabra no encontrada en el diccionario");
            // Trigger shake animation for invalid word
            setShakeRow(submittedRowIndex);
            setTimeout(() => setShakeRow(null), 600); // Remove shake after animation
            // Don't advance row for invalid words, keep the word visible
            // Don't clear currentGuess so the word stays visible
            // NO actualizamos gameBoard ni keyStatus aquí
          } else {
            // Solo actualizamos si la palabra es válida
            // Update the game board with results
            const newBoard = [...gameBoard];
            const guessArray = submittedGuess.split("");

            // Update the row with letter statuses
            const updatedRow = guessArray.map((letter, index) => ({
              letter,
              status: data.result[index],
            }));

            newBoard[submittedRowIndex] = updatedRow;
            console.log("Setting board with new row:", updatedRow);
            console.log("Full board after update:", newBoard);

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
                (currentStatus === "no" &&
                  (status === "almost" || status === "ok")) ||
                (currentStatus === "almost" && status === "ok")
              ) {
                newKeyStatus[letter] = status;
              }
            });

            setKeyStatus(newKeyStatus);

            // Handle row advancement or win/loss
            setResult(null);
            if (data.isCorrect) {
              setResult("¡Ganaste! ¡Felicitaciones!");
              setGameOver(true);
              setIsCompleted(true);
              setWon(true);
              // Move to next row and reset current guess
              const finalRow = currentRow + 1;
              setCurrentRow(finalRow);
              setCurrentGuess("");

              // Save game result and redirect to result page
              const gameResult = {
                won: true,
                tries: finalRow,
                board: newBoard,
                targetWord: submittedGuess,
              };

              localStorage.setItem(
                "wordleGameResult",
                JSON.stringify(gameResult),
              );

              // Save the completed state (do not clear)
              saveGameState(
                {
                  currentRow: finalRow,
                  gameBoard: newBoard,
                  keyStatus: newKeyStatus,
                  gameOver: true,
                  currentGuess: "",
                  isCompleted: true,
                  won: true,
                },
                minutesToEpoch,
              );

              // Show loading message before redirect
              setTimeout(() => {
                setResult("Preparing results...");
              }, 1500);

              // Redirect after showing the win message and loading state
              setTimeout(() => {
                navigate({ to: "/result" });
              }, 2500);
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

                // Save game result for loss and redirect to result page
                const gameResult = {
                  won: false,
                  tries: nextRow,
                  board: newBoard,
                  targetWord: todaysWord,
                };

                localStorage.setItem(
                  "wordleGameResult",
                  JSON.stringify(gameResult),
                );

                // Save the completed state (do not clear)
                saveGameState(
                  {
                    currentRow: nextRow,
                    gameBoard: newBoard,
                    keyStatus: newKeyStatus,
                    gameOver: true,
                    currentGuess: "",
                    isCompleted: true,
                    won: false,
                  },
                  minutesToEpoch,
                );

                // Show loading message before redirect
                setTimeout(() => {
                  setResult("Preparando resultados...");
                }, 1500);

                // Redirect after showing the loss message and loading state
                setTimeout(() => {
                  navigate({ to: "/result" });
                }, 2500);
              }
            }
          }
        },
      });
    }
  };

  // Handle key press (from physical keyboard or virtual keyboard)
  const handleKeyPress = (key: string) => {
    // Don't allow input if game is over or completed
    if (gameOver || isCompleted) return;

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

  // Update the game board display to show the current guess
  useEffect(() => {
    // Don't update if game is completed or if we're beyond valid rows
    if (isCompleted || currentRow >= 6) return;

    console.log(
      "useEffect running - currentGuess:",
      currentGuess,
      "currentRow:",
      currentRow,
    );

    const newBoard = [...gameBoard];
    const currentRowData = newBoard[currentRow];

    // Check if current row has already been submitted (has status)
    const rowHasStatus =
      currentRowData && currentRowData.some((cell) => cell.status !== null);

    console.log("Current row has status:", rowHasStatus);

    if (!rowHasStatus) {
      const guessArray = currentGuess.split("");
      const rowToUpdate = Array(5)
        .fill(null)
        .map((_, index) => ({
          letter: guessArray[index] || "",
          status: null,
        }));

      newBoard[currentRow] = rowToUpdate;
      console.log("Updating current row with:", rowToUpdate);
      setGameBoard(newBoard);
    }
  }, [currentGuess, currentRow, isCompleted, gameBoard]);

  // Load saved game state when component mounts
  useEffect(() => {
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
  }, [isCompleted, won, gameBoard, currentRow, todaysWord]);

  // Save game state to cookies whenever it changes
  useEffect(() => {
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
  }, [currentGuess, currentRow, gameBoard, gameOver, isCompleted]);

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
              {minutesToEpoch && (
                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 text-sm sm:text-base lg:text-lg font-mono text-center sm:text-left">
                  <Terminal className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-600" />
                  <span className="text-blue-700">PRÓXIMA_PALABRA_EN:</span>
                  <span className="text-blue-600 font-bold">
                    {Math.floor(minutesToEpoch / 60)}h {minutesToEpoch % 60}m
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Saved Game Notice */}
          {showSavedGameNotice && (
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
          <div className="mobile-game-board mb-2 sm:mb-4 flex justify-center w-full px-1 sm:px-4">
            <div className="wordle-board grid grid-rows-6 gap-1 sm:gap-3 w-full max-w-[300px] sm:max-w-[500px] lg:max-w-[550px] mx-auto">
              {gameBoard.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className={`wordle-row grid grid-cols-5 gap-1 sm:gap-3 ${
                    shakeRow === rowIndex ? "animate-shake" : ""
                  }`}
                >
                  {row.map((cell, cellIndex) => {
                    let bgColor = "bg-white";
                    let textColor = "text-gray-900";
                    let borderColor = "border-gray-300";

                    // Debug: log cell state for completed rows
                    if (rowIndex < currentRow || (isCompleted && cell.letter)) {
                      console.log(
                        `Cell [${rowIndex}][${cellIndex}]: letter="${cell.letter}", status="${cell.status}"`,
                      );
                    }

                    if (rowIndex === currentRow && !isCompleted) {
                      borderColor = "border-blue-400";
                    } else if (cell.status === "ok") {
                      bgColor = "bg-blue-500";
                      textColor = "text-white";
                      borderColor = "border-blue-600";
                    } else if (cell.status === "almost") {
                      bgColor = "bg-blue-200";
                      borderColor = "border-blue-300";
                    } else if (cell.status === "no" && cell.letter) {
                      bgColor = "bg-gray-200";
                      borderColor = "border-gray-300";
                    } else if (!cell.letter) {
                      bgColor = "bg-gray-50";
                    }

                    return (
                      <div
                        key={cellIndex}
                        className={`
                         wordle-cell aspect-square border-2 rounded-lg flex items-center justify-center
                         font-mono text-xl sm:text-2xl lg:text-3xl font-bold transition-all duration-300
                         ${borderColor} ${bgColor} ${textColor}
                         hover:border-blue-300 relative overflow-hidden group
                         min-h-[50px] min-w-[50px] sm:min-h-[70px] sm:min-w-[70px] lg:min-h-[85px] lg:min-w-[85px]
                       `}
                      >
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

          {/* Completed Game Message and View Results Button */}
          {isCompleted && (
            <div className="pc-message-container mb-4 sm:mb-6 lg:mb-8 mt-4 sm:mt-6 lg:mt-8 p-3 sm:p-4 lg:p-6 border rounded-lg bg-green-50 border-green-200 text-center">
              <p className="font-mono text-sm sm:text-base lg:text-lg text-green-700">
                {result}
              </p>
              <Button
                onClick={() => navigate({ to: "/result" })}
                className="mt-3 sm:mt-4 lg:mt-6 font-mono bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base lg:text-lg px-4 py-2 lg:px-6 lg:py-3"
              >
                Ver Resultados
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
        <div className="mobile-keyboard-section w-full sm:max-w-3xl mx-auto px-1 sm:px-4 overflow-x-hidden">
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
                         h-10 sm:h-16 lg:h-18 ${bgColor} border-2 ${borderColor} rounded-lg
                         font-mono font-semibold text-xs sm:text-lg text-gray-900
                         ${gameOver || isCompleted ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-50 hover:border-blue-400 hover:shadow-md active:scale-95"}
                         transition-all duration-150
                         relative overflow-hidden group
                         min-h-[44px] sm:min-h-[64px] lg:min-h-[72px] touch-manipulation
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
      </main>
    </div>
  );
}
