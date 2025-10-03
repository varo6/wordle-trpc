import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, Trophy, RotateCcw, Home, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { clearGameState } from "@/lib/cookies";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

interface GameResult {
  won: boolean;
  tries: number;
  board: Array<
    Array<{ letter: string; status: "ok" | "almost" | "no" | null }>
  >;
  targetWord?: string;
}

export const Route = createFileRoute("/result")({
  component: ResultComponent,
});

function ResultComponent() {
  const navigate = useNavigate();
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  const { data: wordExplanation } = useQuery(
    trpc.word.getWordExplanation.queryOptions(gameResult?.targetWord || ""),
  );
  useEffect(() => {
    // Try to get game result from localStorage
    const savedResult = localStorage.getItem("wordleGameResult");
    if (savedResult) {
      try {
        const result = JSON.parse(savedResult);
        setGameResult(result);
      } catch (error) {
        console.error("Failed to parse game result:", error);
        // Redirect back to game if no valid result
        setTimeout(() => navigate({ to: "/words" }), 100);
      }
    } else {
      // No result found, redirect back to game
      setTimeout(() => navigate({ to: "/words" }), 100);
    }
  }, [navigate]);

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

  const generateEmojiBoard = (): string => {
    if (!gameResult) return "";

    return gameResult.board
      .slice(0, gameResult.tries) // Only show the rows that were actually used
      .map((row) => row.map((cell) => getEmojiForStatus(cell.status)).join(""))
      .join("\n");
  };

  const handlePlayAgain = () => {
    // Clear the saved result and cookies
    //localStorage.removeItem("wordleGameResult");
    //clearGameState();
    navigate({ to: "/words" });
  };

  const handleGoHome = () => {
    // Clear the saved result when going home (but keep cookies for now)
    localStorage.removeItem("wordleGameResult");
    navigate({ to: "/" });
  };

  const copyResults = async () => {
    if (!gameResult) return;

    const statusText = gameResult.won ? `${gameResult.tries}/6` : "X/6";
    const text = `Word Game ${statusText}\n\n${generateEmojiBoard()}`;

    try {
      await navigator.clipboard.writeText(text);
      // Show a brief success message
      const button = document.querySelector(
        "[data-copy-button]",
      ) as HTMLElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = "¡COPIADO!";
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
      } catch (fallbackError) {
        console.error("Fallback copy failed:", fallbackError);
      }
      document.body.removeChild(textArea);
    }
  };

  if (!gameResult) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Code2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="font-mono text-blue-700">CARGANDO_RESULTADOS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Game Container */}
      <main className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Status Bar */}
        <div className="mb-4 sm:mb-8 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono">
            <Code2 className="w-4 h-4 text-blue-600" />
            <span className="text-blue-700">ESTADO DEL SISTEMA:</span>
            <span className="text-green-600 animate-pulse">
              JUEGO_COMPLETADO
            </span>
          </div>
        </div>

        {wordExplanation && wordExplanation.explanation && (
          <Card className="max-w-2xl mx-auto mb-4 sm:mb-8 border-2 bg-blue-50 border-blue-300">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl font-mono text-blue-700">
                <Info className="w-5 h-5 sm:w-6 sm:h-6" />
                EXPLICACIÓN_DE_LA_PALABRA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white p-4 sm:p-6 rounded-lg border border-blue-200">
                <h3 className="text-base sm:text-xl font-mono font-bold text-blue-800 mb-2 uppercase">
                  {wordExplanation.word}
                </h3>
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                  {wordExplanation.explanation}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Card */}
        <Card className="max-w-2xl mx-auto mb-4 sm:mb-8 border-2 bg-white border-blue-200">
          <CardHeader className="text-center pb-2 sm:pb-4">
            <div className="flex justify-center mb-4">
              <Trophy
                className={`w-12 h-12 sm:w-16 sm:h-16 ${gameResult.won ? "text-yellow-500" : "text-gray-500"}`}
              />
            </div>
            <CardTitle className="bg-white text-xl sm:text-3xl font-mono text-blue-700 mb-2">
              {gameResult.won ? "¡VICTORIA LOGRADA!" : "MISIÓN INCOMPLETA"}
            </CardTitle>
            <p className="text-sm sm:text-lg font-mono text-blue-600">
              {gameResult.won
                ? `¡Palabra adivinada en ${gameResult.tries} ${gameResult.tries === 1 ? "intento" : "intentos"}!`
                : `Juego completado en ${gameResult.tries} intentos`}
            </p>
            {!gameResult.won && gameResult.targetWord && (
              <p className="text-sm sm:text-md font-mono text-red-600 mt-2">
                La palabra era:{" "}
                <span className="font-bold uppercase">
                  {gameResult.targetWord}
                </span>
              </p>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Stats */}
            <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
              <div className="flex justify-center gap-4 sm:gap-8">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-mono font-bold text-blue-700">
                    {gameResult.tries}
                  </div>
                  <div className="text-xs sm:text-sm font-mono text-blue-600">
                    INTENTOS
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-mono font-bold text-blue-700">
                    6
                  </div>
                  <div className="text-xs sm:text-sm font-mono text-blue-600">
                    MÁXIMO_INTENTOS
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-xl sm:text-2xl font-mono font-bold ${gameResult.won ? "text-green-600" : "text-red-600"}`}
                  >
                    {gameResult.won
                      ? Math.round(((6 - gameResult.tries + 1) / 6) * 100)
                      : 0}
                    %
                  </div>
                  <div className="text-xs sm:text-sm font-mono text-blue-600">
                    {gameResult.won ? "EFICIENCIA" : "TASA_ÉXITO"}
                  </div>
                </div>
              </div>
            </div>

            {/* Emoji Board */}
            <div className="text-center">
              <h3 className="text-base sm:text-lg font-mono text-blue-700 mb-2 sm:mb-4">
                TABLERO_JUEGO:
              </h3>
              <div className="bg-gray-50 p-3 sm:p-6 rounded-lg border-2 border-gray-200 inline-block shadow-inner">
                <pre className="font-mono text-lg sm:text-xl leading-relaxed whitespace-pre tracking-wider">
                  {generateEmojiBoard()}
                </pre>
              </div>
            </div>

            {/* Share Button */}
            <div className="text-center mt-4 sm:mt-0">
              <Button
                onClick={copyResults}
                variant="outline"
                className="font-mono border-blue-300 text-blue-700 hover:bg-blue-50 transition-all duration-200 text-sm sm:text-base px-3 sm:px-4 py-2"
                data-copy-button
              >
                <Code2 className="w-4 h-4 mr-2" />
                COPIAR_RESULTADOS
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4">
              <Button
                onClick={handlePlayAgain}
                className="font-mono bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base transition-all duration-200 hover:shadow-lg hover:scale-105"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Ver tablero
              </Button>
              <Button
                onClick={handleGoHome}
                variant="outline"
                className="font-mono border-blue-300 text-blue-700 hover:bg-blue-50 px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base transition-all duration-200 hover:shadow-md hover:scale-105"
              >
                <Home className="w-4 h-4 mr-2" />
                INICIO
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tech decoration */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-blue-600">
            <span className="animate-pulse">▓</span>
            <span>MISIÓN_CUMPLIDA</span>
            <span className="animate-pulse">▓</span>
          </div>
        </div>
      </main>
    </div>
  );
}
