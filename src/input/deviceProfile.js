export function detectClientProfile() {
  const ua = navigator.userAgent || "";
  const uaDataMobile = Boolean(navigator.userAgentData?.mobile);
  const mobileUa = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(ua);
  const ipadLike = /iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const coarsePointer = mediaMatches("(pointer: coarse)") || mediaMatches("(any-pointer: coarse)");
  const hoverNone = mediaMatches("(hover: none)") || mediaMatches("(any-hover: none)");
  const shortestEdge = Math.min(window.innerWidth, window.innerHeight);
  const viewportLikelyMobile = shortestEdge <= 1024 && window.innerWidth <= 1366;
  const mobileBrowser = uaDataMobile || mobileUa || ipadLike || (coarsePointer && hoverNone && viewportLikelyMobile);
  const orientation = window.innerWidth > window.innerHeight ? "landscape" : "portrait";

  return {
    kind: mobileBrowser ? "mobile" : "desktop",
    touchUi: mobileBrowser,
    orientation,
    coarsePointer,
    hoverNone,
  };
}

export function mediaMatches(query) {
  return window.matchMedia ? window.matchMedia(query).matches : false;
}
