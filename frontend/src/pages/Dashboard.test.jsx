import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import api from "../api/axios";
import Dashboard from "./Dashboard";

vi.mock("../context/AuthContext", () => ({
+  useAuth: () => ({
+    user: { id: 7, email: "tester@example.com", full_name: "בודק" },
+    logout: vi.fn(),
+  }),
+}));
+
+vi.mock("../api/axios", () => ({
+  default: {
+    get: vi.fn(),
+    put: vi.fn(),
+  },
+}));
+
+const emptyPlanner = {
+  selected_recipe_ids: [],
+  schedule: {},
+  updated_at: null,
+};
+
+async function renderDashboard() {
+  render(<Dashboard />);
+  await screen.findByText("התכנון מוכן");
+}
+
+describe("recipe planner", () => {
+  beforeEach(() => {
+    localStorage.clear();
+    api.get.mockImplementation((path) => Promise.resolve({
+      data: path === "/planner/me" ? emptyPlanner : {},
+    }));
+    api.put.mockResolvedValue({ data: {} });
+  });
+
+  afterEach(() => {
+    cleanup();
+    vi.clearAllMocks();
+  });
+
+  it("loads server selections into the recipe list", async () => {
+    api.get.mockImplementation((path) => Promise.resolve({
+      data: path === "/planner/me"
+        ? { selected_recipe_ids: ["shakshuka"], schedule: {}, updated_at: "2026-11-02T10:00:00Z" }
+        : {},
+    }));
+
+    await renderDashboard();
+
+    expect(screen.getByRole("button", { name: "נבחר ✓" })).toBeInTheDocument();
+  });
+
+  it("saves selected recipes to the authenticated planner endpoint", async () => {
+    await renderDashboard();
+
+    fireEvent.click(screen.getByRole("button", { name: "הוסף מוקפץ עוף וירקות בטריאקי" }));
+
+    await waitFor(() => {
+      expect(api.put).toHaveBeenCalledWith("/planner/me", {
+        selected_recipe_ids: ["teriyaki-chicken"],
+        schedule: {},
+      });
+    });
+  });
+
+  it("requires confirmation before importing legacy browser data", async () => {
+    localStorage.setItem("plateup-selected-recipes", JSON.stringify(["shakshuka"]));
+    localStorage.setItem("plateup-meal-schedule", JSON.stringify({ "2026-11-02": ["shakshuka"] }));
+
+    await renderDashboard();
+    const dialog = screen.getByRole("dialog", { name: "לייבא את המתכונים והלו״ז?" });
+    fireEvent.click(within(dialog).getByRole("button", { name: /ייבוא לחשבון/ }));
+
+    await waitFor(() => {
+      expect(api.put).toHaveBeenCalledWith("/planner/me", {
+        selected_recipe_ids: ["shakshuka"],
+        schedule: { "2026-11-02": ["shakshuka"] },
+      });
+    });
+    expect(localStorage.getItem("plateup-selected-recipes")).toBeNull();
+    expect(localStorage.getItem("plateup-meal-schedule")).toBeNull();
+  });
+
+  it("adds a selected recipe to a calendar date and saves the schedule", async () => {
+    await renderDashboard();
+    fireEvent.click(screen.getByRole("button", { name: "הוסף מוקפץ עוף וירקות בטריאקי" }));
+    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
+
+    fireEvent.click(screen.getByRole("button", { name: "הלו״ז השבועי" }));
+    fireEvent.click(screen.getAllByRole("button", { name: /הוספת מתכון/ })[0]);
+
+    const dialog = await screen.findByRole("dialog", { name: /מה מבשלים/ });
+    fireEvent.click(within(dialog).getByRole("button", { name: /מוקפץ עוף וירקות בטריאקי/ }));
+    fireEvent.click(within(dialog).getByRole("button", { name: /הוספה ללוח/ }));
+
+    await waitFor(() => {
+      const lastCall = api.put.mock.calls.at(-1);
+      expect(lastCall[0]).toBe("/planner/me");
+      expect(Object.values(lastCall[1].schedule)).toContainEqual(["teriyaki-chicken"]);
+    });
+  });
+});
