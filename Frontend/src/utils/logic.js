export function shouldShowQuestion(rules, answers) {
  if (!rules) return true;

  const logic = rules.logic || "AND";
  const list = rules.conditions || [];

  const checks = list.map((c) => {
    const val = answers[c.questionKey];

    if (c.operator === "equals") return val === c.value;
    if (c.operator === "notEquals") return val !== c.value;
    if (c.operator === "contains") return Array.isArray(val) && val.includes(c.value);
    if (c.operator === "exists") return val !== undefined && val !== null && val !== "";

    return false;
  });

  return logic === "AND" ? checks.every(Boolean) : checks.some(Boolean);
}
