import { BrowserRouter, Routes, Route } from "react-router-dom";
import SignInSignUp from "./pages/SignInSignUp";
import Dashboard from "./pages/Dashboard";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SignInSignUp />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* add other protected routes similarly: /tasks /calendar */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
