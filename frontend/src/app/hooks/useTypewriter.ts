import { useState, useEffect } from "react";

interface UseTypewriterProps {
  text: string;
  speed?: number;
  startDelay?: number;
}

export function useTypewriter({
  text,
  speed = 20,
  startDelay = 0,
}: UseTypewriterProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const [prevText, setPrevText] = useState(text);

  if (text !== prevText) {
    setPrevText(text);
    setDisplayed("");
    setDone(false);
  }

  useEffect(() => {
    let isCancelled = false;
    let index = 0;
    let timer: NodeJS.Timeout;

    const startTimer = setTimeout(() => {
      if (isCancelled) return;

      const type = () => {
        if (isCancelled) return;
        
        setDisplayed(() => {
          const next = text.slice(0, index + 1);
          index++;
          if (index >= text.length) {
            setDone(true);
            return text;
          }
          timer = setTimeout(type, speed);
          return next;
        });
      };

      type();
    }, startDelay);

    return () => {
      isCancelled = true;
      clearTimeout(startTimer);
      clearTimeout(timer);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}
