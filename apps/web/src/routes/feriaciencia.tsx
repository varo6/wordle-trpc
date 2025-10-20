import { createFileRoute } from "@tanstack/react-router";
import { WordsRoute } from "./words";

export const Route = createFileRoute("/feriaciencia")({
  component: WordsRoute,
});
