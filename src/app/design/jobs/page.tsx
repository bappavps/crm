
"use client"

import JobPlanningPage from "../production-planning/page"

/**
 * Redirect or provide the same Job Planning logic for consistency across design routes.
 * Ensures the technical 19-column registry is the master view.
 */
export default function JobsPage() {
  return <JobPlanningPage />
}
