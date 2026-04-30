import { useState } from "react";
import api from "../api/axios";

function RecipeGenerator() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateRecipes = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/ai/generate-recipes");
      setRecipes(Array.isArray(response.data?.recipes) ? response.data.recipes : []);
    } catch (err) {
      setRecipes([]);
      setError(err.response?.data?.detail || "לא הצלחנו ליצור מתכונים כרגע.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-slate-900">מחולל מתכונים חכם</h2>
      <button
        type="button"
        onClick={generateRecipes}
        disabled={loading}
        className="mt-4 rounded-lg bg-purple-600 text-white px-4 py-2 font-medium hover:bg-purple-700 disabled:opacity-60"
      >
        הצע לי מתכונים מהמועדפים שלי
      </button>

      {loading && <p className="mt-3 text-sm text-slate-600">השף חושב...</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {recipes.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe, index) => (
            <article key={`${recipe.title}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">{recipe.title}</h3>
              <div className="mt-3">
                <p className="text-sm font-semibold text-slate-700">מרכיבים:</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-700 space-y-1">
                  {(recipe.ingredients || []).map((item, itemIndex) => (
                    <li key={`${item}-${itemIndex}`}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold text-slate-700">הוראות הכנה:</p>
                <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700 space-y-1">
                  {(recipe.instructions || []).map((step, stepIndex) => (
                    <li key={`${step}-${stepIndex}`}>{step}</li>
                  ))}
                </ol>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default RecipeGenerator;
