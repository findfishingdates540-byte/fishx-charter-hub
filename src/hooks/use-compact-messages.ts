import * as React from "react";

const COMPACT_MESSAGES_BREAKPOINT = 901;

/** Phone and tablet messaging use the same list-to-thread flow. */
export function useCompactMessages() {
  const [compact, setCompact] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia(`(max-width: ${COMPACT_MESSAGES_BREAKPOINT - 1}px)`);
    const update = () => setCompact(query.matches);
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);

  return compact;
}