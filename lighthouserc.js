// Lighthouse CI — advisory perf/accessibility budgets. All assertions are
// "warn" so they never fail the job; results upload to a temporary public URL.
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 30000,
      url: ["http://localhost:3000/"],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.5 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.85 }],
      },
    },
    upload: { target: "temporary-public-storage" },
  },
};
