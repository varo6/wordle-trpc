export default function handleSetStorage(value: any) {
  localStorage.setItem("wordleGameResult", JSON.stringify(value));
}
