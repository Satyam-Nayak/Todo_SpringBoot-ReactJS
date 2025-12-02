import React, { useState } from "react";
import { supabase } from "../utils/supabase";
import { useNavigate } from "react-router-dom";

export default function SignInSignUp() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // success/info
  const [error, setError] = useState(null);

  const clearStates = () => {
    setError(null);
    setMessage(null);
  };

  const handleSignUp = async (e) => {
    e?.preventDefault();
    clearStates();
    if (!email || !password) return setError("Provide email and password.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) setError(error.message);
      else setMessage("Sign up successful. Check your email for confirmation (if enabled).");
    } catch (err) {
      setError(err.message || "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e?.preventDefault();
    clearStates();
    if (!email || !password) return setError("Provide email and password.");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError(error.message);
      else {
        // sign-in successful
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e) => {
    e?.preventDefault();
    clearStates();
    if (!email) return setError("Provide an email for magic link.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) setError(error.message);
      else setMessage("Magic link sent — check your email.");
    } catch (err) {
      setError(err.message || "Failed to send magic link.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e?.preventDefault();
    clearStates();
    if (!email) return setError("Provide email to reset password.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth",
      });
      if (error) setError(error.message);
      else setMessage("Password reset link sent to your email.");
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow p-6">
        <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-100">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-300 mb-4">
          Lightweight auth with Supabase — pick a method below.
        </p>

        {error && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}
        {message && (
          <div className="mb-3 text-sm text-green-700 bg-green-50 p-2 rounded">{message}</div>
        )}

        <form
          onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
          className="space-y-3"
        >
          <label className="block">
            <span className="text-sm text-slate-700 dark:text-slate-200">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 px-3 py-2 focus:outline-none"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-700 dark:text-slate-200">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 px-3 py-2 focus:outline-none"
              placeholder={mode === "signin" ? "Your password" : "Choose a password"}
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-md bg-slate-900 text-white hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                clearStates();
              }}
              className="py-2 px-3 rounded-md border border-slate-200 dark:border-slate-700 text-sm"
            >
              {mode === "signin" ? "New? Sign up" : "Have an account? Sign in"}
            </button>
          </div>
        </form>

        <div className="mt-4 border-t pt-4 space-y-3">
          <button
            onClick={handleMagicLink}
            className="w-full py-2 rounded-md border border-slate-300 dark:border-slate-700 text-sm"
            disabled={loading}
          >
            Send magic link
          </button>

          <div className="flex items-center gap-2">
            <input
              id="reset"
              className="w-4 h-4"
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) handleResetPassword();
                else clearStates();
              }}
            />
            <label htmlFor="reset" className="text-sm text-slate-600 dark:text-slate-300">
              Send password reset to email (check above)
            </label>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          By continuing you agree to our simple terms. This example uses Supabase anonymous keys — do not expose server secrets in client code.
        </div>
      </div>
    </div>
  );
}
