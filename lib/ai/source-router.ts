/**
 * Classifies assistant questions into DATABASE, WEB, or COMBINED *before*
 * any tool or grounding call. This is the gate that prevents the model from
 * searching the Internet for facts that live in TerraDairy's PostgreSQL.
 *
 * Classification uses the **latest user question only**. Prior turns must not
 * pollute routing (e.g. a prior "What causes mastitis?" must not force COMBINED
 * on a later "How many animals are on my farm?").
 */

export type SourceRouteKind = "DATABASE" | "WEB" | "COMBINED";

export interface SourceRoute {
  kind: SourceRouteKind;
  /** Human-readable signals that drove the classification (for logs/tests). */
  reasons: string[];
}

const FARM_POSSESSIVE =
  /\b(my|our|we|the farm|my farm|our farm|on my farm|in my|our records|terradairy|did we|we have|we vaccinated|for my farm)\b/i;

const ANIMAL_TAG = /\b[A-Z]{2,5}[-]?\w?[-]?\d{2,}\b/;

const DATABASE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bhow many\b.*\b(animals?|cows?|calves?|pregnant|lactating|vaccinated|died|deceased)\b/i, reason: "herd count/statistics" },
  { pattern: /\bhow many\b.*\b(on|in)\b.*\b(farm|herd)\b/i, reason: "farm count question" },
  { pattern: /\b(which|who)\b.*\b(cow|animal|calf)\b.*\b(produced|most milk|highest|top)\b/i, reason: "production ranking" },
  { pattern: /\b(which|who)\b.*\b(pregnant|lactating|in heat|bred|vaccinated)\b/i, reason: "herd status filter" },
  { pattern: /\b(pregnant|lactating|in heat)\b.*\b(cows?|animals?|how many)\b/i, reason: "reproductive status count" },
  { pattern: /\boverdue\b.*\bvaccin/i, reason: "vaccination overdue records" },
  { pattern: /\b(how much|what do i have|what do we have)\b.*\b(inventory|medicine|medicines|stock|supplies)\b/i, reason: "inventory quantity question" },
  { pattern: /\b(my|our)\b.*\b(inventory|medicine|medicines|stock|supplies)\b/i, reason: "farm inventory question" },
  { pattern: /\bmilk\b.*\b(produced|production|last month|this month|today|yesterday)\b/i, reason: "milk production records" },
  { pattern: /\b(bred|breeding|calving|vaccinated|vaccination)\b.*\b(in|during|last month|this month|august|september|\d{4})\b/i, reason: "dated farm event records" },
  { pattern: /\b(complete|full)\b.*\bhistory\b/i, reason: "animal history request" },
  { pattern: /\bshow me\b.*\b(tag|animal|#)/i, reason: "specific animal lookup" },
  { pattern: ANIMAL_TAG, reason: "specific animal tag/id" },
  { pattern: /\bhealth risk report\b.*\b(farm|my)\b/i, reason: "farm health report" },
  { pattern: /\bgenerate\b.*\b(report|daily|weekly|monthly)\b/i, reason: "report generation from farm data" },
  { pattern: /\b(dashboard|notifications?|farm capacity|herd overview)\b/i, reason: "dashboard/farm summary" },
  { pattern: /\b(deceased|died|sold|retired)\b.*\b(this year|last year|\d{4})\b/i, reason: "mortality/disposal records" },
  {
    pattern: /\b(which|how many)\b.*\b(animals?|cows?|calves?)\b.*\b(had|have|with|diagnosed|showing)\b/i,
    reason: "animal health/status records",
  },
  {
    pattern: /\b(mastitis|disease|health incident|treatment|diagnos\w*)\b.*\b(record|records|history|log|logs)\b/i,
    reason: "farm health record lookup",
  },
  {
    pattern: /\b(record|records|history|log|logs)\b.*\b(mastitis|disease|health|treatment|vaccin)\b/i,
    reason: "farm health record lookup",
  },
];

const WEB_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(symptoms? of|signs of)\b/i, reason: "clinical symptoms (general knowledge)" },
  { pattern: /\bwhat causes\b/i, reason: "disease etiology" },
  { pattern: /\b(normal|average|typical)\b.*\b(gestation|pregnancy length)\b/i, reason: "general gestation knowledge" },
  { pattern: /\bgestation period\b/i, reason: "general gestation knowledge" },
  { pattern: /\b(recommended|standard|normal)\b.*\b(vaccination|protocol|schedule|dosage|dose)\b/i, reason: "general veterinary protocol" },
  { pattern: /\blatest\b.*\b(research|recommend|regulation|guidance|protocol|practice)\b/i, reason: "current external guidance" },
  { pattern: /\b(nutritional requirements?|feeding guidelines?)\b/i, reason: "nutrition knowledge" },
  { pattern: /\b(treatment approach|treatment for|how to treat)\b/i, reason: "treatment guidance" },
  { pattern: /\bhow much milk should\b.*\b(calf|calves|newborn|\d+[- ]day)\b/i, reason: "calf feeding guidance (general)" },
  { pattern: /\bwhat is the recommended\b/i, reason: "general recommendation" },
  { pattern: /\bketosis\b/i, reason: "disease knowledge" },
  { pattern: /\bmastitis\b/i, reason: "disease knowledge" },
  { pattern: /\bcalf diarrhea\b/i, reason: "disease knowledge" },
  { pattern: /\bmarket (price|information|trends?)\b/i, reason: "external market data" },
];

const COMBINED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bwhich of my\b.*\b(underweight|at risk|risk|compared|below|above)\b/i, reason: "compare farm animals to standards" },
  { pattern: /\bmy\b.*\b(calves?|cows?|animals?|pregnant)\b.*\b(what should|how should|prepare|advice|recommend|underweight|at risk)\b/i, reason: "farm data + advisory" },
  { pattern: /\bwhat should i (do|prepare)\b.*\b(my|our|calves?|cows?|pregnant)\b/i, reason: "personalized preparation advice" },
  { pattern: /\bwhat should i prepare\b.*\b(calving|approaching calving)\b/i, reason: "calving prep needs farm context + guidance" },
  { pattern: /\bapproaching calving\b.*\b(prepare|preparation|what should)\b/i, reason: "calving prep needs farm context + guidance" },
  { pattern: /\bprepare\b.*\b(approaching calving|calving)\b/i, reason: "calving prep needs farm context + guidance" },
  { pattern: /\bi have\b.*\b(calf|calves?|\d+[- ]day)\b.*\b(how much|should|feeding|milk)\b/i, reason: "specific animal scenario + feeding guidance" },
  { pattern: /\bhealth risk report\b.*\b(my|our|farm)\b/i, reason: "farm health report + interpretation" },
  { pattern: /\b(give me|generate)\b.*\bhealth risk\b.*\b(farm|my)\b/i, reason: "farm health report + interpretation" },
  { pattern: /\bmy\b.*\b(calves?|animals?)\b.*\b(weight|age)\b.*\b(risk|standard|normal|compare)\b/i, reason: "growth comparison" },
  {
    pattern: /\b(my|our)\b.*\b(animals?|cows?|calves?)\b.*\b(record|records|history|had|have)\b.*\b(signs?|symptoms?|monitor|watch)\b/i,
    reason: "farm health records + clinical guidance",
  },
  {
    pattern: /\b(record|records|history)\b.*\b(and|&)\b.*\b(signs?|symptoms?|monitor|watch|what causes|how to treat)\b/i,
    reason: "farm records plus veterinary guidance",
  },
];

const ADVISORY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(signs? to monitor|symptoms? to watch|what signs|what symptoms)\b/i, reason: "monitoring guidance" },
  { pattern: /\bwhat causes\b/i, reason: "disease etiology" },
  { pattern: /\b(signs? of|symptoms? of)\b/i, reason: "clinical signs" },
  { pattern: /\bhow to treat\b/i, reason: "treatment guidance" },
  { pattern: /\bwhat should i\b/i, reason: "personalized advice" },
  { pattern: /\b(recommended|normal|typical)\b.*\b(protocol|dosage|dose|feeding)\b/i, reason: "general protocol" },
];

const FARM_RECORD_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(record|records|history|log|logs|incident)\b/i, reason: "explicit farm records" },
  {
    pattern: /\b(which|how many)\b.*\b(animals?|cows?|calves?)\b.*\b(had|have|with|diagnosed|showing)\b/i,
    reason: "animal condition lookup",
  },
  { pattern: FARM_POSSESSIVE, reason: "farm-specific possessive language" },
  { pattern: ANIMAL_TAG, reason: "specific animal tag/id" },
];

const FOLLOW_UP_PATTERN =
  /^(what about|and for|how about|same for|last month|this month|yesterday|today|that one|those)\b/i;

function matchesAny(
  text: string,
  patterns: Array<{ pattern: RegExp; reason: string }>,
): string[] {
  return patterns.filter(({ pattern }) => pattern.test(text)).map(({ reason }) => reason);
}

function isFarmRecordQuery(text: string): boolean {
  if (matchesAny(text, DATABASE_PATTERNS).length > 0) return true;
  return matchesAny(text, FARM_RECORD_PATTERNS).length > 0;
}

function hasAdvisoryKnowledgeNeed(text: string): boolean {
  return matchesAny(text, ADVISORY_PATTERNS).length > 0;
}

function getWebKnowledgeReasons(text: string): string[] {
  if (isFarmRecordQuery(text) && !hasAdvisoryKnowledgeNeed(text)) {
    return matchesAny(text, WEB_PATTERNS).filter(
      (reason) => reason !== "disease knowledge",
    );
  }
  return matchesAny(text, WEB_PATTERNS);
}

function resolveLatestQuestion(
  message: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  return message.trim();
}

function isFarmScopedFollowUp(
  text: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): boolean {
  if (!FOLLOW_UP_PATTERN.test(text)) return false;
  return history?.some((m) => m.role === "user" && FARM_POSSESSIVE.test(m.content)) ?? false;
}

/**
 * Route a user question to DATABASE, WEB, or COMBINED.
 * Uses only the latest user turn for pattern matching.
 */
export function classifySourceRoute(
  message: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): SourceRoute {
  const text = resolveLatestQuestion(message, history);
  const normalized = text.toLowerCase();

  const combinedReasons = matchesAny(text, COMBINED_PATTERNS);
  if (combinedReasons.length > 0) {
    return { kind: "COMBINED", reasons: combinedReasons };
  }

  const farmRecord = isFarmRecordQuery(text);
  const advisory = hasAdvisoryKnowledgeNeed(text);

  if (farmRecord && advisory) {
    return {
      kind: "COMBINED",
      reasons: ["farm records + veterinary guidance"],
    };
  }

  if (farmRecord) {
    const databaseReasons = matchesAny(text, DATABASE_PATTERNS);
    return {
      kind: "DATABASE",
      reasons: databaseReasons.length ? databaseReasons : ["farm-specific factual question"],
    };
  }

  const databaseReasons = matchesAny(text, DATABASE_PATTERNS);
  const webReasons = getWebKnowledgeReasons(text);
  const hasFarmRef = FARM_POSSESSIVE.test(text) || ANIMAL_TAG.test(text);

  if (databaseReasons.length > 0 && webReasons.length === 0) {
    return { kind: "DATABASE", reasons: databaseReasons };
  }

  if (webReasons.length > 0 && !hasFarmRef && databaseReasons.length === 0) {
    return { kind: "WEB", reasons: webReasons };
  }

  if (webReasons.length > 0 && databaseReasons.length > 0) {
    return {
      kind: "COMBINED",
      reasons: [...databaseReasons, ...webReasons],
    };
  }

  if (hasFarmRef) {
    return {
      kind: "DATABASE",
      reasons: databaseReasons.length ? databaseReasons : ["farm-specific possessive language"],
    };
  }

  if (
    /\b(what is|what are|how much should|symptoms|causes|recommended|normal|latest|protocol|treatment)\b/i.test(
      text,
    )
  ) {
    return { kind: "WEB", reasons: ["general knowledge question without farm reference"] };
  }

  if (isFarmScopedFollowUp(text, history)) {
    return { kind: "DATABASE", reasons: ["farm-scoped follow-up"] };
  }

  if (/\b(farm|herd|animals?|cows?|calves?|milk|vaccin|breed|pregnant|inventory)\b/i.test(normalized)) {
    return { kind: "DATABASE", reasons: ["farm-domain default"] };
  }

  return { kind: "WEB", reasons: ["general question default"] };
}

export function getLatestUserMessage(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") return history[i].content;
  }
  return "";
}
