const API_URL = "http://127.0.0.1:8000";

export async function predictEvent(index: number = 0) {
  const response = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ index }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch prediction");
  }

  return response.json();
}