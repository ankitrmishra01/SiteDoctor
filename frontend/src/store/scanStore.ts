import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { ScanResult, ScanStatus, CheckEventPayload, Category, Severity, Finding } from "../types.js";

interface ScanStoreState {
  theme: "dark" | "light";
  socketConnected: boolean;
  socket: Socket | null;
  sessionId: string;
  
  currentScan: ScanResult | null;
  scanStatus: ScanStatus;
  completedChecks: CheckEventPayload[];
  liveFindings: Finding[];
  failureReason: string | null;
  rateLimitError: { message: string; retryAfterMinutes: number } | null;

  selectedCategory: Category;
  selectedSeverity: Severity | "all";
  selectedPriority: "all" | "quick_win" | "plan_next" | "nice_to_have";
  searchFilter: string;

  history: ScanResult[];
  githubConnected: boolean;
  githubRepoUrl: string;

  // Actions
  setTheme: (theme: "dark" | "light") => void;
  toggleTheme: () => void;
  initSocket: () => void;
  startScan: (params: {
    url: string;
    type: "frontend" | "backend" | "both";
    openApiUrl?: string;
    consent: boolean;
  }) => Promise<void>;
  fetchHistory: (url?: string) => Promise<void>;
  setSelectedCategory: (cat: Category) => void;
  setSelectedSeverity: (sev: Severity | "all") => void;
  setSelectedPriority: (priority: "all" | "quick_win" | "plan_next" | "nice_to_have") => void;
  setSearchFilter: (query: string) => void;
  setGithubSession: (connected: boolean, repoUrl?: string) => void;
  loadScanResult: (scan: ScanResult) => void;
  clearScan: () => void;
}

export const useScanStore = create<ScanStoreState>((set, get) => {
  // Theme initialization
  const savedTheme = (typeof window !== "undefined" && localStorage.getItem("sitedoctor-theme")) as "dark" | "light" || "dark";
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", savedTheme);
  }

  // Session ID for volatile memory isolation
  const sessionId = typeof window !== "undefined" 
    ? (sessionStorage.getItem("sitedoctor-session-id") || `sess_${Math.random().toString(36).substring(2, 10)}`)
    : "default_session";
  if (typeof window !== "undefined") {
    sessionStorage.setItem("sitedoctor-session-id", sessionId);
  }

  return {
    theme: savedTheme,
    socketConnected: false,
    socket: null,
    sessionId,

    currentScan: null,
    scanStatus: "idle",
    completedChecks: [],
    liveFindings: [],
    failureReason: null,
    rateLimitError: null,

    selectedCategory: "all",
    selectedSeverity: "all",
    selectedPriority: "all",
    searchFilter: "",

    history: [],
    githubConnected: false,
    githubRepoUrl: "",

    setTheme: (theme) => {
      localStorage.setItem("sitedoctor-theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
      set({ theme });
    },

    toggleTheme: () => {
      const nextTheme = get().theme === "dark" ? "light" : "dark";
      get().setTheme(nextTheme);
    },

    initSocket: () => {
      if (get().socket) return;

      const socket = io(window.location.origin, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10
      });

      socket.on("connect", () => {
        set({ socketConnected: true });
      });

      socket.on("disconnect", () => {
        set({ socketConnected: false });
      });

      socket.on("scan:started", () => {
        set({ scanStatus: "running", failureReason: null, rateLimitError: null });
      });

      socket.on("scan:check_completed", (payload: CheckEventPayload) => {
        set((state) => {
          // Merge findings avoiding duplicates
          const existingIds = new Set(state.liveFindings.map(f => f.id));
          const newFindings = payload.findings.filter(f => !existingIds.has(f.id));
          return {
            completedChecks: [...state.completedChecks, payload],
            liveFindings: [...state.liveFindings, ...newFindings]
          };
        });
      });

      socket.on("scan:completed", (result: ScanResult) => {
        set({
          scanStatus: "completed",
          currentScan: result,
          liveFindings: result.findings,
          failureReason: null
        });
        get().fetchHistory(result.targetUrl);
      });

      socket.on("scan:failed_unreachable", (data: { failureReason: string }) => {
        set({
          scanStatus: "failed_unreachable",
          failureReason: data.failureReason,
          currentScan: null
        });
      });

      socket.on("scan:failed_error", (data: { failureReason: string }) => {
        set({
          scanStatus: "failed_error",
          failureReason: data.failureReason,
          currentScan: null
        });
      });

      set({ socket });
    },

    startScan: async ({ url, type, openApiUrl, consent }) => {
      set({
        scanStatus: "queued",
        currentScan: null,
        completedChecks: [],
        liveFindings: [],
        failureReason: null,
        rateLimitError: null
      });

      const { socket, sessionId, githubRepoUrl } = get();

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            type,
            openApiUrl: openApiUrl || undefined,
            consent,
            sessionId,
            repoUrl: githubRepoUrl || undefined
          })
        });

        if (res.status === 429) {
          const rateData = await res.json();
          set({
            scanStatus: "idle",
            rateLimitError: {
              message: rateData.message || "Rate limit reached. Please wait before scanning again.",
              retryAfterMinutes: rateData.retryAfterMinutes || 60
            }
          });
          return;
        }

        if (!res.ok) {
          const errData = await res.json();
          set({
            scanStatus: "failed_error",
            failureReason: errData.error || (errData.issues ? errData.issues.join(", ") : "Scan initiation failed.")
          });
          return;
        }

        const data = await res.json();
        const jobId = data.jobId;

        // Subscribe to socket room for this scan
        if (socket) {
          socket.emit("scan:subscribe", jobId);
        }

        // Also initiate history load for this URL
        get().fetchHistory(url);
      } catch (err: any) {
        set({
          scanStatus: "failed_error",
          failureReason: `Network error connecting to scan engine: ${err.message}`
        });
      }
    },

    fetchHistory: async (url) => {
      try {
        const query = url ? `?url=${encodeURIComponent(url)}` : "";
        const res = await fetch(`/api/history${query}`);
        if (res.ok) {
          const data = await res.json();
          const historyList: ScanResult[] = data.history || [];
          set({ history: historyList });
          
          // On initial page load when idle and no active scan, auto-populate dashboard with latest completed scan
          const state = get();
          if (!state.currentScan && state.scanStatus === "idle" && historyList.length > 0) {
            const latest = historyList[0];
            set({
              currentScan: latest,
              scanStatus: "completed",
              liveFindings: latest.findings || []
            });
          }
        }
      } catch (err) {
        console.warn("Failed to fetch history:", err);
      }
    },

    setSelectedCategory: (cat) => set({ selectedCategory: cat }),
    setSelectedSeverity: (sev) => set({ selectedSeverity: sev }),
    setSelectedPriority: (priority) => set({ selectedPriority: priority }),
    setSearchFilter: (query) => set({ searchFilter: query }),
    setGithubSession: (connected, repoUrl) => set({ githubConnected: connected, githubRepoUrl: repoUrl || "" }),
    loadScanResult: (scan) => set({
      currentScan: scan,
      scanStatus: "completed",
      liveFindings: scan.findings || [],
      failureReason: null
    }),
    clearScan: () => set({ scanStatus: "idle", currentScan: null, completedChecks: [], liveFindings: [], failureReason: null })
  };
});

if (typeof window !== "undefined") {
  (window as any).useScanStore = useScanStore;
}
