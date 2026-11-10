// GA4 Analytics wrapper — safe no-op when gtag not loaded
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA_MEASUREMENT_ID = "G-XXXXXXXXXX"; // Replace with real ID before go-live

export function initGA() {
  if (typeof window === "undefined" || window.gtag) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
}

export function trackPageView(path: string) {
  window.gtag?.("config", GA_MEASUREMENT_ID, { page_path: path });
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.("event", name, params);
}
