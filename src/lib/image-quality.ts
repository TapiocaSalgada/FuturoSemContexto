function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function withParamVariants(url: string) {
  try {
    const parsed = new URL(url);
    const keys = ["w", "width", "h", "height"];
    let changed = false;

    for (const key of keys) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, "1440");
        changed = true;
      }
    }

    return changed ? [parsed.toString()] : [];
  } catch {
    return [];
  }
}

function variantsFor(url: string) {
  const original = String(url || "").trim();
  if (!original) return [] as string[];

  const variants = [original];

  if (/cdn\.myanimelist\.net/i.test(original)) {
    variants.push(original.replace(/\/r\/\d+x\d+\//i, "/"));
    if (!/l\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(original)) {
      variants.push(original.replace(/\.(jpg|jpeg|png|webp)(\?.*)?$/i, "l.$1$2"));
    }
  }

  if (/image\.tmdb\.org/i.test(original)) {
    variants.push(original.replace(/\/w\d+\//i, "/original/"));
  }

  if (/anilist\.co\/img/i.test(original)) {
    variants.push(original.replace(/\/(small|medium)(?=\b|\/)/i, "/large"));
  }

  if (/uploads\.mangadex\.org/i.test(original)) {
    variants.push(original.replace(/\.(?:256|512)\.(jpg|jpeg|png|webp)(\?.*)?$/i, ".1024.$1$2"));
    variants.push(original.replace(/\.(?:256|512|1024)\.(jpg|jpeg|png|webp)(\?.*)?$/i, ".2048.$1$2"));
  }

  variants.push(...withParamVariants(original));

  return unique(variants);
}

export function buildImageCandidates(...inputs: Array<string | null | undefined>) {
  const all = inputs.flatMap((input) => variantsFor(String(input || "").trim()));
  return unique([...all, "/logo.png"]);
}
