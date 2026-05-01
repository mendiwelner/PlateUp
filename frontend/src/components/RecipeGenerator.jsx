import { useState, useEffect } from "react";
import api from "../api/axios";

function RecipeGenerator() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ingredients, setIngredients] = useState({});
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      const response = await api.get("/ai/ingredients");
      setIngredients(response.data);
    } catch (err) {
      console.error("Failed to fetch ingredients:", err);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const toggleIngredient = (ingredient) => {
    setSelectedIngredients(prev =>
      prev.includes(ingredient)
        ? prev.filter(item => item !== ingredient)
        : [...prev, ingredient]
    );
  };

  const clearAllIngredients = () => {
    setSelectedIngredients([]);
  };

  const generateRecipesFromIngredients = async () => {
    if (selectedIngredients.length === 0) {
      setError("אנא בחר לפחות מצרך אחד");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await api.post("/ai/generate-recipes-from-ingredients", {
        ingredients: selectedIngredients
      });
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

      {/* Ingredient Selection */}
      <div className="mt-6">
        <h3 className="text-lg font-medium text-slate-900 mb-4">בחר מצרכים:</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(ingredients).map(([category, categoryIngredients]) => (
            <div key={category} className="border border-slate-200 rounded-lg p-4">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full text-left font-medium text-slate-900 hover:text-purple-600 flex justify-between items-center"
              >
                {category.replace(/_/g, ' ')}
                <span className="text-sm">
                  {expandedCategories[category] ? '▼' : '▶'}
                </span>
              </button>

              {expandedCategories[category] && (
                <div className="mt-3 space-y-2">
                  {categoryIngredients.map((ingredient) => (
                    <label key={ingredient} className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="checkbox"
                        checked={selectedIngredients.includes(ingredient)}
                        onChange={() => toggleIngredient(ingredient)}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-slate-700">{ingredient}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedIngredients.length > 0 && (
          <div className="mt-4 p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900">מצרכים שנבחרו:</h4>
              <button
                onClick={clearAllIngredients}
                className="text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded-md transition-colors"
                title="מחק את כל המצרכים"
              >
                מחק הכל
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedIngredients.map((ingredient) => (
                <div
                  key={ingredient}
                  className="inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-purple-200 text-sm text-slate-700"
                >
                  <span>{ingredient}</span>
                  <button
                    onClick={() => toggleIngredient(ingredient)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-1 transition-colors"
                    title="הסר מצרך"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6">
        <button
          type="button"
          onClick={generateRecipesFromIngredients}
          disabled={loading || selectedIngredients.length === 0}
          className="w-full rounded-lg bg-purple-600 text-white px-6 py-3 font-medium hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          הצע מתכונים מהמצרכים שנבחרו
        </button>
      </div>

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
