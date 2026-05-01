import { useAuth } from "../context/AuthContext";
import RecipeGenerator from "../components/RecipeGenerator";

function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-2xl rounded-xl bg-white shadow p-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-3 text-slate-700">
          Welcome, <span className="font-semibold">{user?.full_name || user?.email}</span>
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-6 rounded-lg bg-slate-900 text-white px-4 py-2 hover:bg-slate-800"
        >
          Logout
        </button>
        <RecipeGenerator />
      </div>
    </div>
  );
}

export default Dashboard;
