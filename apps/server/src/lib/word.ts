/**
 * Compara dos cadenas del mismo tamaño y devuelve un arreglo
 * de estados: 'ok' si la letra coincide en la posición,
 * 'almost' si la letra existe en la cadena pero posición distinta,
 * 'no' si la letra no existe en la cadena.
 */
export function compareStrings(
  secret: string,
  guess: string,
): ("ok" | "almost" | "no")[] {
  if (secret.length !== guess.length) {
    throw new Error("Las cadenas deben tener la misma longitud");
  }

  const length = secret.length;
  // Inicialmente llenamos con 'no'
  const result: ("ok" | "almost" | "no")[] = Array(length).fill("no");

  // Contar letras de secret que NO estén ya emparejadas como 'ok'
  const letterCounts: Record<string, number> = {};
  for (let i = 0; i < length; i++) {
    if (secret[i] !== guess[i]) {
      letterCounts[secret[i]] = (letterCounts[secret[i]] || 0) + 1;
    }
  }

  // Primera pasada: marcar 'ok'
  for (let i = 0; i < length; i++) {
    if (guess[i] === secret[i]) {
      result[i] = "ok";
    }
  }

  // Segunda pasada: marcar 'almost' o mantener 'no'
  for (let i = 0; i < length; i++) {
    if (result[i] === "ok") {
      continue;
    }
    const char = guess[i];
    if (letterCounts[char]) {
      result[i] = "almost";
      letterCounts[char]--;
    }
  }

  return result;
}
