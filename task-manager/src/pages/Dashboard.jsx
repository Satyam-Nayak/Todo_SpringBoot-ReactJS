import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Welcome
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {user?.email}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/calendar")}
              className="px-3 py-2 rounded-md border text-sm"
            >
              Calendar
            </button>
            <button
              onClick={() => navigate("/tasks")}
              className="px-3 py-2 rounded-md border text-sm"
            >
              Tasks
            </button>
            <button
              onClick={handleSignOut}
              className="px-3 py-2 rounded-md bg-red-600 text-white text-sm"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="mt-6">
          <section className="space-y-3">
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-700">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                This is a starter dashboard. From here you can go to Calendar or Tasks.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
