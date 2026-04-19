import { useEffect, useState } from "react";

const getInitialCount = () => {
  const meta = document.querySelector('meta[name="player-count"]');
  return meta ? parseInt(meta.getAttribute("content") ?? "0", 10) : 0;
};

export const usePlayerCount = () => {
  const [count, setCount] = useState(getInitialCount);

  useEffect(() => {
    try {
      const source = new EventSource("/api/status");
      source.onmessage = (e) => {
        const data = JSON.parse(e.data);
        setCount(data.players);
      };
      return () => source.close();
    } catch {
      // EventSource unavailable (e.g. test environment)
    }
  }, []);

  return count;
};
