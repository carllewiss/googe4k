import { useEffect } from "react";
import { usePublicSettings } from "@/hooks/usePublicSettings";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptInjected = false;
function ensureAdScript(client: string) {
  if (typeof document === "undefined") return;
  if (scriptInjected || document.querySelector("script[data-adsense]")) {
    scriptInjected = true;
    return;
  }
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  s.crossOrigin = "anonymous";
  s.setAttribute("data-adsense", "true");
  document.head.appendChild(s);
  scriptInjected = true;
}

type Placement = "sidebar" | "footer" | "article";

const SLOT_KEY: Record<Placement, string> = {
  sidebar: "adsense_slot_sidebar",
  footer: "adsense_slot_footer",
  article: "adsense_slot_article",
};

/**
 * Responsive (auto-sizing) Google AdSense unit. Renders nothing unless AdSense
 * is enabled in settings and a client id + slot id are configured.
 */
export function AdSlot({
  placement,
  className,
  label = true,
}: {
  placement: Placement;
  className?: string;
  label?: boolean;
}) {
  const { data: settings } = usePublicSettings();

  const enabled = settings?.adsense_enabled === "true";
  const client = settings?.adsense_client?.trim() || "";
  const slot = settings?.[SLOT_KEY[placement]]?.trim() || "";
  const ready = enabled && !!client && !!slot;

  useEffect(() => {
    if (!ready) return;
    ensureAdScript(client);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* AdSense may not be ready yet — it will retry on next render */
    }
  }, [ready, client, slot]);

  if (!ready) return null;

  return (
    <div className={className}>
      {label && (
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 text-center">
          Advertisement
        </p>
      )}
      <ins
        key={slot}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
