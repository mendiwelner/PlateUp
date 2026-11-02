import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { fallbackIngredients, recipes } from "../data/recipes";

const WEEKDAYS = ["יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת", "יום א׳"];
const CUISINES = ["הכל", ...new Set(recipes.map((recipe) => recipe.cuisine))];
const MEAL_TYPES = ["הכל", ...new Set(recipes.map((recipe) => recipe.mealType))];
const DIET_FILTERS = [
  { id: "vegetarian", label: "צמחוני" },
  { id: "dairyFree", label: "ללא חלב" },
  { id: "glutenFree", label: "ללא גלוטן" },
];

function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayFromMonday);
  return start;
}

function dateLabel(date, options = { weekday: "long", day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("he-IL", options).format(date);
}

function makeCalendarDays(anchor, view) {
  if (view === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }

  const start = startOfWeek(anchor);
  const count = view === "twoWeeks" ? 14 : 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function RecipeCard({ recipe, selected, onToggle, compact = false }) {
  return (
    <article className={`recipe-card ${compact ? "recipe-card-compact" : ""}`}>
      <button
        className={`recipe-art recipe-art-${recipe.accent}`}
        type="button"
        onClick={() => onToggle(recipe.id)}
        aria-label={`${selected ? "הסר" : "הוסף"} ${recipe.title}`}
      >
        <span className="recipe-emoji" aria-hidden="true">{recipe.emoji}</span>
        <span className={`recipe-select ${selected ? "is-selected" : ""}`} aria-hidden="true">
          {selected ? "✓" : "+"}
        </span>
      </button>
      <div className="recipe-card-body">
        <div className="recipe-card-meta">
          <span>{recipe.mealType}</span>
          <span className="meta-dot" />
          <span>{recipe.minutes} דק׳</span>
        </div>
        <h3>{recipe.title}</h3>
        <div className="recipe-card-bottom">
          <span className="cuisine-pill">{recipe.cuisine}</span>
          <button
            className={`text-select ${selected ? "selected" : ""}`}
            type="button"
            onClick={() => onToggle(recipe.id)}
          >
            {selected ? "נבחר ✓" : "בחירה +"}
          </button>
        </div>
      </div>
    </article>
  );
}

function RecipeGrid({ items, selectedIds, onToggle, emptyText }) {
  if (!items.length) return <div className="empty-recipes">{emptyText}</div>;
  return (
    <div className="recipe-grid">
      {items.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          selected={selectedIds.includes(recipe.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [screen, setScreen] = useState("discover");
  const [selectedIds, setSelectedIds] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [plannerStatus, setPlannerStatus] = useState("loading");
  const [plannerError, setPlannerError] = useState("");
  const [plannerErrorKind, setPlannerErrorKind] = useState("");
  const [plannerReady, setPlannerReady] = useState(false);
  const [legacyPlanner, setLegacyPlanner] = useState(null);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const saveTimeoutRef = useRef(null);
  const [ingredientGroups, setIngredientGroups] = useState(fallbackIngredients);
  const [favoriteIngredients, setFavoriteIngredients] = useState([]);
  const [expandedIngredientGroups, setExpandedIngredientGroups] = useState({ ירקות: true });
  const [timeFilter, setTimeFilter] = useState("all");
  const [cuisineFilter, setCuisineFilter] = useState("הכל");
  const [mealFilter, setMealFilter] = useState("הכל");
  const [dietFilters, setDietFilters] = useState([]);
  const [calendarView, setCalendarView] = useState("week");
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [modalDate, setModalDate] = useState(null);
  const [recipesToAdd, setRecipesToAdd] = useState([]);

  useEffect(() => {
    api.get("/ai/ingredients")
      .then(({ data }) => {
        if (data && typeof data === "object" && Object.keys(data).length) setIngredientGroups(data);
      })
      .catch(() => {
        // The curated ingredient list keeps the planner usable when the API is offline.
      });
  }, []);

  useEffect(() => {
    let active = true;
    setPlannerReady(false);
    setPlannerStatus("loading");
    setPlannerError("");
    setPlannerErrorKind("");
    setShowImportPrompt(false);
    setLegacyPlanner(null);
    setSelectedIds([]);
    setSchedule({});

    api.get("/planner/me")
      .then(({ data }) => {
        if (!active) return;

        const serverHasPlanner = Boolean(data.updated_at);
        const storedIds = readStorage("plateup-selected-recipes", []);
        const storedSchedule = readStorage("plateup-meal-schedule", {});
        const legacyData = {
          selectedIds: Array.isArray(storedIds) ? storedIds : [],
          schedule: storedSchedule && typeof storedSchedule === "object" && !Array.isArray(storedSchedule) ? storedSchedule : {},
        };
        const hasLegacyData = legacyData.selectedIds.length > 0 || Object.keys(legacyData.schedule).length > 0;

        if (serverHasPlanner) {
          setSelectedIds(Array.isArray(data.selected_recipe_ids) ? data.selected_recipe_ids : []);
          setSchedule(data.schedule && typeof data.schedule === "object" ? data.schedule : {});
        } else if (hasLegacyData) {
          setSelectedIds(legacyData.selectedIds);
          setSchedule(legacyData.schedule);
          setLegacyPlanner(legacyData);
          setShowImportPrompt(true);
        }

        setPlannerReady(true);
        setPlannerStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setPlannerError("לא הצלחנו לטעון את התכנון מהשרת. בדקו את החיבור ונסו שוב.");
        setPlannerErrorKind("load");
        setPlannerStatus("error");
      });

    return () => {
      active = false;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [user?.id]);

  const savePlannerNow = async (nextSelectedIds, nextSchedule) => {
    setPlannerStatus("saving");
    setPlannerError("");
    setPlannerErrorKind("");
    try {
      await api.put("/planner/me", {
        selected_recipe_ids: nextSelectedIds,
        schedule: nextSchedule,
      });
      setPlannerStatus("saved");
      return true;
    } catch {
      setPlannerError("השמירה לשרת נכשלה. נסו שוב בעוד רגע.");
      setPlannerErrorKind("save");
      setPlannerStatus("error");
      return false;
    }
  };

  const queuePlannerSave = (nextSelectedIds, nextSchedule) => {
    if (!plannerReady || showImportPrompt) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setPlannerStatus("saving");
    saveTimeoutRef.current = setTimeout(() => {
      savePlannerNow(nextSelectedIds, nextSchedule);
    }, 500);
  };

  const importLegacyPlanner = async () => {
    if (!legacyPlanner) return;
    const saved = await savePlannerNow(legacyPlanner.selectedIds, legacyPlanner.schedule);
    if (!saved) return;

    localStorage.removeItem("plateup-selected-recipes");
    localStorage.removeItem("plateup-meal-schedule");
    setShowImportPrompt(false);
    setLegacyPlanner(null);
  };

  const discardLegacyPlanner = () => {
    localStorage.removeItem("plateup-selected-recipes");
    localStorage.removeItem("plateup-meal-schedule");
    setSelectedIds([]);
    setSchedule({});
    setShowImportPrompt(false);
    setLegacyPlanner(null);
    setPlannerStatus("ready");
  };

  const retryPlannerLoad = () => {
    if (plannerErrorKind === "save") {
      savePlannerNow(selectedIds, schedule);
      return;
    }

    setPlannerReady(false);
    setPlannerStatus("loading");
    setPlannerError("");
    api.get("/planner/me")
      .then(({ data }) => {
        const serverHasPlanner = Boolean(data.updated_at);
        const storedIds = readStorage("plateup-selected-recipes", []);
        const storedSchedule = readStorage("plateup-meal-schedule", {});
        const legacyData = {
          selectedIds: Array.isArray(storedIds) ? storedIds : [],
          schedule: storedSchedule && typeof storedSchedule === "object" && !Array.isArray(storedSchedule) ? storedSchedule : {},
        };
        const hasLegacyData = legacyData.selectedIds.length > 0 || Object.keys(legacyData.schedule).length > 0;

        if (serverHasPlanner) {
          setSelectedIds(Array.isArray(data.selected_recipe_ids) ? data.selected_recipe_ids : []);
          setSchedule(data.schedule && typeof data.schedule === "object" ? data.schedule : {});
        } else if (hasLegacyData) {
          setSelectedIds(legacyData.selectedIds);
          setSchedule(legacyData.schedule);
          setLegacyPlanner(legacyData);
          setShowImportPrompt(true);
        } else {
          setSelectedIds([]);
          setSchedule({});
        }
        setPlannerErrorKind("");
        setPlannerReady(true);
        setPlannerStatus("ready");
      })
      .catch(() => {
        setPlannerError("לא הצלחנו לטעון את התכנון מהשרת. בדקו את החיבור ונסו שוב.");
        setPlannerErrorKind("load");
        setPlannerStatus("error");
      });
  };

  const selectedRecipes = useMemo(
    () => recipes.filter((recipe) => selectedIds.includes(recipe.id)),
    [selectedIds]
  );

  const toggleRecipe = (id) => {
    const nextSelectedIds = selectedIds.includes(id)
      ? selectedIds.filter((recipeId) => recipeId !== id)
      : [...selectedIds, id];
    setSelectedIds(nextSelectedIds);
    queuePlannerSave(nextSelectedIds, schedule);
  };

  const toggleIngredient = (ingredient) => {
    setFavoriteIngredients((current) => current.includes(ingredient)
      ? current.filter((item) => item !== ingredient)
      : [...current, ingredient]);
  };

  const toggleDietFilter = (filter) => {
    setDietFilters((current) => current.includes(filter)
      ? current.filter((item) => item !== filter)
      : [...current, filter]);
  };

  const matchesFilters = useCallback((recipe) => {
    const matchesTime = timeFilter === "all"
      || (timeFilter === "30" && recipe.minutes <= 30)
      || (timeFilter === "45" && recipe.minutes <= 45)
      || (timeFilter === "over45" && recipe.minutes > 45);
    const matchesCuisine = cuisineFilter === "הכל" || recipe.cuisine === cuisineFilter;
    const matchesMeal = mealFilter === "הכל" || recipe.mealType === mealFilter;
    const matchesDiet = dietFilters.every((filter) => recipe[filter]);
    return matchesTime && matchesCuisine && matchesMeal && matchesDiet;
  }, [timeFilter, cuisineFilter, mealFilter, dietFilters]);

  const filteredRecipes = useMemo(() => recipes.filter(matchesFilters), [matchesFilters]);
  const featuredRecipes = recipes.filter((recipe) => recipe.featured);
  const personalizedRecipes = useMemo(() => {
    const matchesIngredients = (recipe) => favoriteIngredients.length === 0
      || recipe.ingredients.some((ingredient) => favoriteIngredients.includes(ingredient));
    return recipes.filter((recipe) => matchesFilters(recipe) && matchesIngredients(recipe));
  }, [favoriteIngredients, matchesFilters]);

  const calendarDays = useMemo(
    () => makeCalendarDays(calendarAnchor, calendarView),
    [calendarAnchor, calendarView]
  );

  const navigateCalendar = (direction) => {
    setCalendarAnchor((current) => {
      const next = new Date(current);
      if (calendarView === "month") next.setMonth(next.getMonth() + direction);
      else next.setDate(next.getDate() + direction * (calendarView === "twoWeeks" ? 14 : 7));
      return next;
    });
  };

  const openAddModal = (date) => {
    setModalDate(dateKey(date));
    setRecipesToAdd([]);
  };

  const addRecipesToSchedule = () => {
    if (!modalDate || !recipesToAdd.length) return;
    const nextSchedule = {
      ...schedule,
      [modalDate]: [...new Set([...(schedule[modalDate] || []), ...recipesToAdd])],
    };
    setSchedule(nextSchedule);
    queuePlannerSave(selectedIds, nextSchedule);
    setModalDate(null);
    setRecipesToAdd([]);
  };

  const removeFromSchedule = (dayKey, recipeId) => {
    const nextSchedule = {
      ...schedule,
      [dayKey]: (schedule[dayKey] || []).filter((id) => id !== recipeId),
    };
    setSchedule(nextSchedule);
    queuePlannerSave(selectedIds, nextSchedule);
  };

  const finishSelection = () => setScreen("calendar");
  const modalDateValue = modalDate ? new Date(`${modalDate}T12:00:00`) : null;
  const displayName = user?.full_name || user?.email || "הטבח/ית";

  return (
    <div className="planner-app" dir="rtl">
      <aside className="planner-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">P</span>
          <span className="brand-name">plate<span>up</span></span>
        </div>

        <div className="sidebar-caption">תכנון הארוחות שלך</div>
        <nav className="sidebar-nav" aria-label="ניווט ראשי">
          <button className={`nav-link ${screen === "discover" ? "active" : ""}`} onClick={() => setScreen("discover")} type="button">
            <span className="nav-icon">✳</span><span>בחירת מתכונים</span>
          </button>
          <button className={`nav-link ${screen === "calendar" ? "active" : ""}`} onClick={() => setScreen("calendar")} type="button">
            <span className="nav-icon">▦</span><span>הלו״ז השבועי</span>
            {Object.values(schedule).flat().length > 0 && <span className="nav-count">{Object.values(schedule).flat().length}</span>}
          </button>
        </nav>

        <div className="sidebar-selection">
          <div className="selection-count">{String(selectedRecipes.length).padStart(2, "0")}</div>
          <div>
            <strong>מתכונים נבחרו</strong>
            <span>מוכנים לתכנון השבועי</span>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="user-chip">
            <span className="user-avatar">{displayName.slice(0, 1).toUpperCase()}</span>
            <span className="user-name">{displayName}</span>
          </div>
          <button className="logout-button" type="button" onClick={logout}>יציאה מהחשבון ↗</button>
        </div>
      </aside>

      <main className="planner-main">
        <header className="planner-topbar">
          <div className="mobile-brand"><span className="brand-mark">P</span><span className="brand-name">plate<span>up</span></span></div>
          <div className="breadcrumb"><span>התכנון שלי</span><span className="breadcrumb-separator">/</span><strong>{screen === "discover" ? "בחירת מתכונים" : "לוח הארוחות"}</strong></div>
          {screen === "discover" ? (
            <button type="button" className="primary-button top-action" onClick={finishSelection}>
              מעבר ללוח השבועי <span>←</span>
            </button>
          ) : (
            <button type="button" className="outline-button top-action" onClick={() => setScreen("discover")}>
              <span>＋</span> בחירת מתכונים
            </button>
          )}
          <div className={`planner-sync-status sync-${plannerStatus}`} aria-live="polite">
            {plannerStatus === "loading" && "טוענים את התכנון…"}
            {plannerStatus === "ready" && "התכנון מוכן"}
            {plannerStatus === "saving" && "שומרים…"}
            {plannerStatus === "saved" && "נשמר בענן ✓"}
            {plannerStatus === "error" && <><span>{plannerError}</span><button type="button" onClick={retryPlannerLoad}>נסה שוב</button></>}
          </div>
        </header>

        {screen === "discover" ? (
          <div className="page-content discovery-page">
            <section className="welcome-banner">
              <div className="welcome-copy">
                <span className="eyebrow">הארוחות שלך, בדרך שלך</span>
                <h1>מה מבשלים השבוע?</h1>
                <p>בוחרים מתכונים שאוהבים, ואנחנו נעזור להפוך אותם לשבוע טעים ומאורגן.</p>
              </div>
              <div className="welcome-illustration" aria-hidden="true"><span>🥬</span><span>🍅</span><span>🥕</span></div>
              <div className="welcome-step"><span>שלב 01</span><strong>בוחרים מה לאכול</strong><i>01 — 02</i></div>
            </section>

            <section className="content-section">
              <div className="section-heading">
                <div className="section-title-wrap"><span className="section-number">01</span><div><h2>מתכונים נבחרים</h2><p>כמה רעיונות אהובים להתחיל מהם</p></div></div>
                <span className="section-count">{featuredRecipes.length} מתכונים</span>
              </div>
              <RecipeGrid items={featuredRecipes} selectedIds={selectedIds} onToggle={toggleRecipe} emptyText="אין מתכונים להצגה." />
            </section>

            <section className="content-section category-section">
              <div className="section-heading">
                <div className="section-title-wrap"><span className="section-number">02</span><div><h2>לפי הקטגוריות שלך</h2><p>מצאו מתכון לפי זמן, מטבח או סוג ארוחה</p></div></div>
              </div>
              <div className="filter-panel">
                <label className="filter-control"><span>זמן הכנה</span><select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)}><option value="all">כל הזמנים</option><option value="30">עד 30 דקות</option><option value="45">עד 45 דקות</option><option value="over45">מעל 45 דקות</option></select></label>
                <label className="filter-control"><span>מטבח / מוצא</span><select value={cuisineFilter} onChange={(event) => setCuisineFilter(event.target.value)}>{CUISINES.map((item) => <option key={item} value={item}>{item === "הכל" ? "כל המטבחים" : item}</option>)}</select></label>
                <div className="filter-control meal-filter"><span>סוג ארוחה</span><div className="pill-options">{MEAL_TYPES.map((item) => <button key={item} type="button" className={mealFilter === item ? "filter-pill chosen" : "filter-pill"} onClick={() => setMealFilter(item)}>{item}</button>)}</div></div>
              </div>
              <RecipeGrid items={filteredRecipes} selectedIds={selectedIds} onToggle={toggleRecipe} emptyText="לא מצאנו מתכונים שמתאימים לסינון. נסו לשנות את הבחירות." />
            </section>

            <section className="content-section personal-section">
              <div className="section-heading">
                <div className="section-title-wrap"><span className="section-number">03</span><div><h2>בדיוק לפי הטעם שלך</h2><p>בחרו מצרכים אהובים וסננו לפי העדפות תזונתיות</p></div></div>
                {favoriteIngredients.length > 0 && <button className="clear-link" type="button" onClick={() => setFavoriteIngredients([])}>ניקוי מצרכים ×</button>}
              </div>

              <div className="personal-panel">
                <div className="ingredient-picker">
                  <div className="subsection-heading"><span className="subsection-icon">♡</span><div><strong>מה תמיד כיף לך לאכול?</strong><span>בחרו מצרך אחד או יותר</span></div></div>
                  <div className="ingredient-groups">
                    {Object.entries(ingredientGroups).map(([group, items]) => (
                      <div className="ingredient-group" key={group}>
                        <button className="ingredient-group-toggle" type="button" onClick={() => setExpandedIngredientGroups((current) => ({ ...current, [group]: !current[group] }))}>
                          <span>{String(group).replace(/_/g, " ")}</span><span>{expandedIngredientGroups[group] ? "−" : "+"}</span>
                        </button>
                        {expandedIngredientGroups[group] && <div className="ingredient-chips">{items.map((ingredient) => <button key={ingredient} type="button" className={`ingredient-chip ${favoriteIngredients.includes(ingredient) ? "selected" : ""}`} onClick={() => toggleIngredient(ingredient)}>{favoriteIngredients.includes(ingredient) && <span>✓ </span>}{ingredient}</button>)}</div>}
                      </div>
                    ))}
                  </div>
                  <div className="diet-filter-block"><strong>העדפות תזונתיות</strong><div className="diet-options">{DIET_FILTERS.map((filter) => <label key={filter.id} className={`diet-option ${dietFilters.includes(filter.id) ? "active" : ""}`}><input type="checkbox" checked={dietFilters.includes(filter.id)} onChange={() => toggleDietFilter(filter.id)} /><span className="custom-check">✓</span>{filter.label}</label>)}</div></div>
                </div>

                <div className="personal-results">
                  <div className="personal-results-heading"><div><span className="eyebrow">ההתאמה שלך</span><h3>{favoriteIngredients.length ? "מצאנו רעיונות בשבילך" : "השראה לפי ההעדפות שלך"}</h3></div><span className="match-icon">✦</span></div>
                  {favoriteIngredients.length > 0 && <div className="chosen-ingredients">{favoriteIngredients.map((item) => <span key={item}>{item}<button type="button" onClick={() => toggleIngredient(item)} aria-label={`הסרת ${item}`}>×</button></span>)}</div>}
                  <RecipeGrid items={personalizedRecipes.slice(0, 4)} selectedIds={selectedIds} onToggle={toggleRecipe} emptyText={favoriteIngredients.length ? "אין כרגע מתכונים עם המצרכים והסינון שבחרתם. נסו להסיר סינון." : "בחרו מצרכים כדי לקבל התאמות אישיות."} />
                </div>
              </div>
            </section>

            <div className="finish-bar">
              <div><strong>{selectedRecipes.length ? `${selectedRecipes.length} מתכונים מחכים לכם בלוח` : "הבחירות שלכם נשמרות אוטומטית"}</strong><span>אפשר להוסיף, להסיר ולשנות גם בהמשך</span></div>
              <button type="button" className="primary-button" onClick={finishSelection}>סיום ומעבר ללו״ז השבועי <span>←</span></button>
            </div>
          </div>
        ) : (
          <div className="page-content calendar-page">
            <section className="calendar-intro">
              <div><span className="eyebrow">שבוע טעים מתחיל כאן</span><h1>לוח הארוחות</h1><p>תכנון קטן מראש, הרבה יותר שקט במהלך השבוע.</p></div>
              <div className="calendar-summary"><span className="summary-icon">✦</span><div><strong>{Object.values(schedule).flat().length} ארוחות מתוכננות</strong><span>{selectedRecipes.length} מתכונים ברשימה שלך</span></div></div>
            </section>

            <section className="calendar-panel">
              <div className="calendar-toolbar">
                <div className="calendar-period"><div className="period-title">{calendarView === "month" ? dateLabel(calendarAnchor, { month: "long", year: "numeric" }) : `${dateLabel(calendarDays[0], { day: "numeric", month: "short" })} — ${dateLabel(calendarDays[calendarDays.length - 1], { day: "numeric", month: "long", year: "numeric" })}`}</div><div className="period-controls"><button type="button" onClick={() => navigateCalendar(-1)} aria-label="תקופה קודמת">›</button><button type="button" onClick={() => setCalendarAnchor(new Date())}>היום</button><button type="button" onClick={() => navigateCalendar(1)} aria-label="תקופה הבאה">‹</button></div></div>
                <div className="view-switch" role="group" aria-label="תצוגת לוח שנה"><button className={calendarView === "week" ? "active" : ""} onClick={() => setCalendarView("week")} type="button">שבועי</button><button className={calendarView === "twoWeeks" ? "active" : ""} onClick={() => setCalendarView("twoWeeks")} type="button">דו־שבועי</button><button className={calendarView === "month" ? "active" : ""} onClick={() => setCalendarView("month")} type="button">חודשי</button></div>
              </div>

              <div className={`calendar-grid ${calendarView === "month" ? "month-view" : ""} ${calendarView === "twoWeeks" ? "two-week-view" : ""}`}>
                {WEEKDAYS.map((day) => <div className="weekday-heading" key={day}>{day}</div>)}
                {calendarDays.map((date) => {
                  const key = dateKey(date);
                  const dayRecipes = (schedule[key] || []).map((id) => recipes.find((recipe) => recipe.id === id)).filter(Boolean);
                  const isToday = key === dateKey(new Date());
                  const isOutsideMonth = calendarView === "month" && date.getMonth() !== calendarAnchor.getMonth();
                  return (
                    <div className={`calendar-day ${isToday ? "today" : ""} ${isOutsideMonth ? "outside-month" : ""}`} key={key}>
                      <div className="day-heading"><span className="day-number">{date.getDate()}</span>{isToday && <span className="today-label">היום</span>}</div>
                      <div className="day-events">{dayRecipes.map((recipe) => <div className={`calendar-event event-${recipe.accent}`} key={recipe.id}><span>{recipe.emoji}</span><span className="event-title">{recipe.title}</span><button type="button" onClick={() => removeFromSchedule(key, recipe.id)} aria-label={`הסרת ${recipe.title} מהלו״ז`}>×</button></div>)}</div>
                      <button className="add-event-button" type="button" onClick={() => openAddModal(date)}><span>＋</span><span>הוספת מתכון</span></button>
                    </div>
                  );
                })}
              </div>

              <div className="calendar-footer"><span><i className="today-dot" /> היום</span><span>{selectedRecipes.length ? `אפשר להוסיף מתוך ${selectedRecipes.length} מתכונים שנבחרו` : "עדיין אין מתכונים ברשימה"}</span></div>
            </section>
          </div>
        )}
      </main>

      {screen === "calendar" && modalDate && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalDate(null); }}>
          <section className="recipe-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" dir="rtl">
            <div className="modal-header"><div><span className="eyebrow">מוסיפים משהו טעים</span><h2 id="modal-title">מה מבשלים ב{modalDateValue ? dateLabel(modalDateValue, { weekday: "long", day: "numeric", month: "long" }) : "יום הזה"}?</h2></div><button className="modal-close" type="button" onClick={() => setModalDate(null)} aria-label="סגירה">×</button></div>
            {selectedRecipes.length ? (
              <>
                <p className="modal-description">בחרו מתכון אחד או יותר מתוך הרשימה שלכם.</p>
                <div className="modal-recipe-list">{selectedRecipes.map((recipe) => {
                  const checked = recipesToAdd.includes(recipe.id);
                  return <button className={`modal-recipe-option ${checked ? "checked" : ""}`} type="button" key={recipe.id} onClick={() => setRecipesToAdd((current) => checked ? current.filter((id) => id !== recipe.id) : [...current, recipe.id])}><span className={`modal-recipe-emoji recipe-art-${recipe.accent}`}>{recipe.emoji}</span><span className="modal-recipe-copy"><strong>{recipe.title}</strong><small>{recipe.minutes} דקות · {recipe.cuisine}</small></span><span className="modal-checkbox">{checked ? "✓" : ""}</span></button>;
                })}</div>
                <div className="modal-actions"><button className="text-button" type="button" onClick={() => setScreen("discover")}>＋ בחירת מתכונים נוספים</button><button className="primary-button" type="button" disabled={!recipesToAdd.length} onClick={addRecipesToSchedule}>הוספה ללוח <span>←</span></button></div>
              </>
            ) : (
              <div className="modal-empty"><span>🍽️</span><h3>הרשימה שלך עדיין ריקה</h3><p>בחרו כמה מתכונים, ואז תוכלו לשבץ אותם כאן בלוח.</p><button className="primary-button" type="button" onClick={() => setScreen("discover")}>מעבר לבחירת מתכונים <span>←</span></button></div>
            )}
          </section>
        </div>
      )}

      {(plannerStatus === "loading" || (plannerStatus === "error" && plannerErrorKind === "load")) && (
        <div className="modal-backdrop planner-gate" role="presentation">
          <section className="planner-gate-card" role="alertdialog" aria-modal="true" aria-labelledby="planner-gate-title" dir="rtl">
            <span className="planner-gate-icon">{plannerStatus === "loading" ? "◌" : "!"}</span>
            <h2 id="planner-gate-title">{plannerStatus === "loading" ? "טוענים את התכנון שלך…" : "לא הצלחנו להתחבר לתכנון"}</h2>
            <p>{plannerStatus === "loading" ? "רק רגע, מביאים את המתכונים והלו״ז שלך." : plannerError}</p>
            {plannerStatus === "error" && <button className="primary-button" type="button" onClick={retryPlannerLoad}>ניסיון חוזר</button>}
          </section>
        </div>
      )}

      {showImportPrompt && legacyPlanner && (
        <div className="modal-backdrop import-backdrop" role="presentation">
          <section className="recipe-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" dir="rtl">
            <div className="modal-header"><div><span className="eyebrow">מצאנו תכנון קודם</span><h2 id="import-title">לייבא את המתכונים והלו״ז?</h2></div></div>
            <p className="modal-description">נמצא מידע שנשמר בדפדפן. הוא עדיין לא משויך לחשבון מסוים. אם זה התכנון שלך, אפשר לייבא אותו לחשבון {displayName}; אחרת אפשר להתחיל מחדש.</p>
            <div className="import-summary"><span>{legacyPlanner.selectedIds.length} מתכונים נבחרו</span><span>{Object.values(legacyPlanner.schedule).flat().length} ארוחות בלוח</span></div>
            {plannerStatus === "error" && <p className="import-error">{plannerError}</p>}
            <div className="modal-actions"><button className="text-button" type="button" onClick={discardLegacyPlanner}>התחלה מחדש</button><button className="primary-button" type="button" disabled={plannerStatus === "saving"} onClick={importLegacyPlanner}>{plannerStatus === "saving" ? "מייבאים…" : "ייבוא לחשבון"}<span>←</span></button></div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Dashboard;