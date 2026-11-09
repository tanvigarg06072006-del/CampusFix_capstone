/**
 * Smart Similar Complaint Detection Algorithm
 * Lightweight, zero-dependency text & metadata similarity engine.
 */

// Common English stopwords to filter out noise
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
  "be", "been", "being", "in", "on", "at", "to", "for", "of", "with",
  "by", "about", "against", "between", "into", "through", "during",
  "before", "after", "above", "below", "from", "up", "down",
  "out", "over", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "any", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "s", "t", "can",
  "will", "just", "don", "should", "now", "my", "our", "ours", "your",
  "their", "his", "her", "its", "it", "this", "that", "these", "those",
  "i", "we", "you", "they", "he", "she", "me", "him", "them", "us",
  "please", "help", "kindly", "having", "facing", "problem", "issue", "complaint"
]);

// Tokenize text into normalized keywords
export function tokenizeText(text) {
  if (!text || typeof text !== "string") return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// Generate character bigrams for fuzzy matching
export function getBigrams(str) {
  const s = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  const bigrams = new Set();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2));
  }
  return bigrams;
}

// Sørensen–Dice coefficient on character bigrams (0 to 1)
export function diceCoefficient(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1.toLowerCase() === str2.toLowerCase()) return 1;
  const b1 = getBigrams(str1);
  const b2 = getBigrams(str2);
  if (b1.size === 0 || b2.size === 0) return 0;
  let intersection = 0;
  for (const item of b1) {
    if (b2.has(item)) intersection++;
  }
  return (2 * intersection) / (b1.size + b2.size);
}

// Token Jaccard similarity with prefix/substring flexibility
export function tokenSimilarity(tokens1, tokens2) {
  if (!tokens1.length || !tokens2.length) return 0;
  const set2 = new Set(tokens2);
  let matches = 0;

  for (const t1 of tokens1) {
    if (set2.has(t1)) {
      matches += 1.0;
    } else {
      let bestMatch = 0;
      for (const t2 of tokens2) {
        if (t1.startsWith(t2) || t2.startsWith(t1)) {
          const sim = Math.min(t1.length, t2.length) / Math.max(t1.length, t2.length);
          if (sim > bestMatch) bestMatch = sim;
        } else {
          const dice = diceCoefficient(t1, t2);
          if (dice > 0.7 && dice > bestMatch) bestMatch = dice * 0.8;
        }
      }
      matches += bestMatch;
    }
  }

  const union = new Set([...tokens1, ...tokens2]).size;
  return matches / Math.max(1, union);
}

// Location similarity based on keyword and room/block identifiers
export function calculateLocationSimilarity(loc1, loc2) {
  if (!loc1 || !loc2) return 0.25;
  const clean1 = loc1.trim().toLowerCase();
  const clean2 = loc2.trim().toLowerCase();
  if (clean1 === clean2) return 1.0;

  const t1 = tokenizeText(loc1);
  const t2 = tokenizeText(loc2);
  if (!t1.length || !t2.length) return 0.25;

  let matches = 0;
  for (const word1 of t1) {
    for (const word2 of t2) {
      if (word1 === word2) {
        matches += /^\d+$/.test(word1) ? 2 : 1;
        break;
      } else if (word1.startsWith(word2) || word2.startsWith(word1)) {
        matches += 0.7;
        break;
      }
    }
  }

  const maxPossible = Math.max(t1.length, t2.length);
  return Math.min(1.0, matches / Math.max(1, maxPossible));
}

// Category similarity
export function calculateCategorySimilarity(cat1, cat2) {
  if (!cat1 || !cat2) return 0.3;
  if (cat1.toLowerCase() === cat2.toLowerCase()) return 1.0;
  if (cat1 === "Other" || cat2 === "Other") return 0.3;
  return 0.0;
}

/**
 * Calculates a composite similarity score (0 to 100) between a draft complaint and an existing complaint
 */
export function calculateComplaintSimilarity(draft, existing) {
  if (!draft || !existing) return 0;

  // Title similarity
  const draftTitleTokens = tokenizeText(draft.title);
  const existingTitleTokens = tokenizeText(existing.title);
  const titleScore = tokenSimilarity(draftTitleTokens, existingTitleTokens);
  const fuzzyTitle = diceCoefficient(draft.title, existing.title);
  const compositeTitle = Math.max(titleScore, fuzzyTitle * 0.85);

  // Description comparison if provided
  let descScore = 0;
  if (draft.description && draft.description.trim().length > 5) {
    const draftDescTokens = tokenizeText(draft.description);
    const existingDescTokens = tokenizeText(existing.description || "");
    descScore = tokenSimilarity(draftDescTokens, existingDescTokens);
  }

  const textScore = descScore > 0 ? (compositeTitle * 0.75 + descScore * 0.25) : compositeTitle;

  // Category match
  const catScore = calculateCategorySimilarity(draft.category, existing.category);

  // Location match
  const locScore = calculateLocationSimilarity(draft.location, existing.location);

  // Dynamic weighting
  const hasLocation = Boolean(draft.location && draft.location.trim().length > 2);
  const hasCategory = Boolean(draft.category && draft.category !== "Other");

  let totalScore = 0;
  if (hasLocation && hasCategory) {
    totalScore = (textScore * 0.50) + (catScore * 0.25) + (locScore * 0.25);
  } else if (hasCategory) {
    totalScore = (textScore * 0.65) + (catScore * 0.35);
  } else if (hasLocation) {
    totalScore = (textScore * 0.65) + (locScore * 0.35);
  } else {
    totalScore = textScore;
  }

  return Math.min(100, Math.max(0, Math.round(totalScore * 100)));
}

/**
 * Find similar complaints among an array of existing complaints
 * Returns sorted list of matches exceeding threshold (default 35%)
 */
export function findSimilarComplaints(draft, complaintsList, threshold = 35) {
  if (!draft || !draft.title || draft.title.trim().length < 3) {
    return [];
  }
  if (!Array.isArray(complaintsList) || complaintsList.length === 0) {
    return [];
  }

  const results = [];

  for (const complaint of complaintsList) {
    const score = calculateComplaintSimilarity(draft, complaint);
    if (score >= threshold) {
      results.push({
        ...complaint,
        similarityScore: score
      });
    }
  }

  // Sort descending by similarity score, then by vote count
  results.sort((a, b) => b.similarityScore - a.similarityScore || (b.voteCount || 0) - (a.voteCount || 0));

  return results.slice(0, 5);
}
