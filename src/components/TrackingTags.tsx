"use client";

import { useEffect } from "react";
import { parseTrackingSnippet } from "@/lib/tracking-tags";

export default function TrackingTags({ snippet, isEnabled }: { snippet: string; isEnabled: boolean }) {
  useEffect(() => {
    if (!isEnabled || !snippet.trim()) return;
    const tags = parseTrackingSnippet(snippet);
    if (tags.length === 0) return;

    const scripts: HTMLScriptElement[] = [];
    for (const tag of tags) {
      if (tag.kind === "src") {
        const s = document.createElement("script");
        s.src = tag.src;
        if (tag.isAsync) s.async = true;
        if (tag.isDefer) s.defer = true;
        if (tag.id) s.id = tag.id;
        document.head.appendChild(s);
        scripts.push(s);
      } else {
        const s = document.createElement("script");
        s.type = "text/javascript";
        s.textContent = tag.code;
        document.head.appendChild(s);
        scripts.push(s);
      }
    }
    return () => {
      for (const s of scripts) {
        if (s.parentNode) s.parentNode.removeChild(s);
      }
    };
  }, [snippet, isEnabled]);

  return null;
}
