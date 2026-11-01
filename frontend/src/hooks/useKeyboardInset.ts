import { useEffect, useState } from "react";

export function useKeyboardInset() {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function update() {
      if (!viewport) return;
      const gap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setBottomInset(gap);
    }

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return bottomInset;
}
