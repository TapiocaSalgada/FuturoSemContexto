function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

type ImageCandidateMode = "auto" | "card" | "banner";
type BuildImageOptions = { mode?: ImageCandidateMode };

function normalizeUrl(value: string) {
  const next = String(value || "").trim();
  if (!next) return "";

  if (next.startsWith("//")) {
    return `https:${next}`;
  }

  if (next.startsWith("http://")) {
    return `https://${next.slice("http://".length)}`;
  }

  return next;
}

function resolveTargetWidth(mode: ImageCandidateMode) {
  if (mode === "card") return "640";
  if (mode === "banner") return "1280";
  return "1024";
}

function withParamVariants(url: string, mode: ImageCandidateMode) {
  try {
    const parsed = new URL(url);
    const keys = ["w", "width", "h", "height"];
    let changed = false;
    const widthTarget = resolveTargetWidth(mode);

    for (const key of keys) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, widthTarget);
        changed = true;
      }
    }

    return changed ?[parsed.toString()] : [];
  } catch {
    return [];
  }
}

function supabaseVariants(url: string, mode: ImageCandidateMode) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(".supabase.co")) return [] as string[];
    if (!parsed.pathname.includes("/storage/v1/object/public/")) return [] as string[];

    const path = parsed.pathname.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    );
    const widths = mode === "banner" ?[1280, 1920] : [420, 640];
    const quality = mode === "banner" ?76 : 72;

    return widths.map((width) => {
      const next = new URL(`${parsed.origin}${path}`);
      next.searchParams.set("width", String(width));
      next.searchParams.set("quality", String(quality));
      return next.toString();
    });
  } catch {
    return [] as string[];
  }
}

function variantsFor(url: string, mode: ImageCandidateMode) {
  const original = normalizeUrl(url);
  if (!original) return [] as string[];

  const variants = [original];
  const supabaseFirst = supabaseVariants(original, mode);

  if (/cdn\.myanimelist\.net/i.test(original)) {
    if (mode === "banner") {
      variants.push(original.replace(/\/r\/\d+x\d+\//i, "/"));
      if (!/l\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(original)) {
        variants.push(original.replace(/\.(jpg|jpeg|png|webp)(\?.*)?$/i, "l.$1$2"));
      }
    }
  }

  if (/image\.tmdb\.org/i.test(original)) {
    variants.push(
      mode === "banner"
        ?original.replace(/\/w\d+\//i, "/w1280/")
        : original.replace(/\/w\d+\//i, "/w500/"),
    );
  }

  if (/anilist\.co\/img/i.test(original)) {
    variants.push(
      original.replace(/\/(small|medium|large)(?=\b|\/)/i, mode === "banner" ?"/large" : "/medium"),
    );
  }

  if (/anilist\.co\/file\/anilistcdn/i.test(original)) {
    variants.push(original.replace(/\/medium\//i, mode === "banner" ?"/large/" : "/medium/"));
    variants.push(original.replace(/\/small\//i, mode === "banner" ?"/large/" : "/medium/"));
  }

  if (/uploads\.mangadex\.org/i.test(original)) {
    if (mode === "banner") {
      variants.push(original.replace(/\.(?:256|512)\.(jpg|jpeg|png|webp)(\?.*)?$/i, ".1024.$1$2"));
      variants.push(original.replace(/\.(?:256|512|1024)\.(jpg|jpeg|png|webp)(\?.*)?$/i, ".2048.$1$2"));
    } else {
      variants.push(original.replace(/\.(?:256)\.(jpg|jpeg|png|webp)(\?.*)?$/i, ".512.$1$2"));
    }
  }

  variants.push(...withParamVariants(original, mode));

  const clean = unique([...supabaseFirst, ...variants]);
  const prioritized = clean.flatMap((item) => {
    if (!item.startsWith("https://")) return [item];
    return [`/api/image?url=${encodeURIComponent(item)}`, item];
  });

  return unique(prioritized);
}

function isBuildImageOptions(value: unknown): value is BuildImageOptions {
  return Boolean(value) && typeof value === "object" && "mode" in (value as Record<string, unknown>);
}

export function buildImageCandidates(
  ...inputs: Array<string | null | undefined | BuildImageOptions>
) {
  const copy = [...inputs];
  let mode: ImageCandidateMode = "auto";

  const tail = copy[copy.length - 1];
  if (isBuildImageOptions(tail)) {
    mode = tail.mode || "auto";
    copy.pop();
  }

  const all = copy.flatMap((input) => variantsFor(normalizeUrl(String(input || "").trim()), mode));
  return unique([...all, "/logo.png"]);
}
