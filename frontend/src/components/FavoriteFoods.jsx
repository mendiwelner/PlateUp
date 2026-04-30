import { useEffect, useState } from "react";
import api from "../api/axios";

function FavoriteFoods() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Food");
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("Food");

  const fetchFoods = async () => {
    setLoading(true);
    try {
      const response = await api.get("/foods");
      setFoods(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "טעינה נכשלה");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFoods();
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await api.post("/foods", { name, category });
      setFoods((prev) => [response.data, ...prev]);
      setName("");
      setCategory("Food");
    } catch (err) {
      setError(err.response?.data?.detail || "שמירה נכשלה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (food) => {
    setEditingId(food.id);
    setEditName(food.name);
    setEditCategory(food.category);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditCategory("Food");
  };

  const saveEdit = async (foodId) => {
    setError("");
    try {
      const response = await api.put(`/foods/${foodId}`, {
        name: editName,
        category: editCategory,
      });
      setFoods((prev) => prev.map((food) => (food.id === foodId ? response.data : food)));
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.detail || "עדכון נכשל");
    }
  };

  const deleteFood = async (foodId) => {
    setError("");
    try {
      await api.delete(`/foods/${foodId}`);
      setFoods((prev) => prev.filter((food) => food.id !== foodId));
      if (editingId === foodId) {
        cancelEdit();
      }
    } catch (err) {
      setError(err.response?.data?.detail || "מחיקה נכשלה");
    }
  };

  const categoryLabel = (value) => (value === "Product" ? "מוצר" : "מאכל");

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-slate-900">מאכלים מועדפים</h2>

      <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={handleCreate}>
        <input
          className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="text"
          placeholder="שם המאכל"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="Food">מאכל</option>
          <option value="Product">מוצר</option>
        </select>
        <button
          className="sm:col-span-3 rounded-lg bg-blue-600 text-white py-2 font-medium hover:bg-blue-700 disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "שומר..." : "הוסף"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        {loading ? (
          <p className="text-slate-500">טוען...</p>
        ) : foods.length === 0 ? (
          <p className="text-slate-500">אין מאכלים מועדפים עדיין.</p>
        ) : (
          <ul className="space-y-2">
            {foods.map((food) => (
              <li key={food.id} className="rounded-lg border border-slate-200 px-4 py-3">
                {editingId === food.id ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      placeholder="שם המאכל"
                    />
                    <select
                      className="rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={editCategory}
                      onChange={(event) => setEditCategory(event.target.value)}
                    >
                      <option value="Food">מאכל</option>
                      <option value="Product">מוצר</option>
                    </select>
                    <div className="sm:col-span-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(food.id)}
                        className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm hover:bg-emerald-700"
                      >
                        שמור
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-md bg-slate-200 text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-300"
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{food.name}</p>
                      <p className="text-xs text-slate-500">
                        סוג: <span className="font-semibold">{categoryLabel(food.category)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(food)}
                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                        aria-label="ערוך"
                      >
                        ✏️ ערוך
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFood(food.id)}
                        className="rounded-md border border-red-300 px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50"
                        aria-label="מחק"
                      >
                        🗑️ מחק
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default FavoriteFoods;
