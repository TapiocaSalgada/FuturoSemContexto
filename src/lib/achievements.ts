// lib/achievements.ts
// Static registry of every achievement in the platform.
// The achievementId here is the value stored in UserAchievement.achievementId.

export interface AchievementDef {
  id: string;
  label: string;
  description: string;
  emoji: string;
  category: "activity" | "social" | "collection" | "streak" | "milestone";
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- First Steps ---
  {
    id: "first_episode",
    label: "Primeiro Episódio",
    description: "Assistiu o primeiro episódio.",
    emoji: "▶️",
    category: "activity",
  },
  {
    id: "first_login",
    label: "Começando Agora",
    description: "Entrou no site pela primeira vez.",
    emoji: "🌟",
    category: "activity",
  },
  {
    id: "anime_explorer",
    label: "Explorador de Animes",
    description: "Abriu 5 animes diferentes.",
    emoji: "🔭",
    category: "activity",
  },
  {
    id: "first_favorite",
    label: "Favorito Salvo",
    description: "Adicionou 1 anime aos favoritos.",
    emoji: "❤️",
    category: "collection",
  },
  {
    id: "first_list",
    label: "Lista Criada",
    description: "Criou uma lista personalizada.",
    emoji: "📋",
    category: "collection",
  },
  {
    id: "first_comment",
    label: "Comentário Enviado",
    description: "Fez o primeiro comentário.",
    emoji: "💬",
    category: "social",
  },
  // --- Streak badges ---
  {
    id: "active_account",
    label: "Conta Ativa",
    description: "Entrou em 3 dias diferentes.",
    emoji: "✅",
    category: "streak",
  },
  {
    id: "came_back",
    label: "Voltou Hoje",
    description: "Acessou em dois dias seguidos.",
    emoji: "🔁",
    category: "streak",
  },
  {
    id: "streak_3",
    label: "3 Dias Seguidos",
    description: "Entrou no site por 3 dias consecutivos.",
    emoji: "🔥",
    category: "streak",
  },
  {
    id: "streak_7",
    label: "7 Dias Seguidos",
    description: "Entrou no site por 7 dias consecutivos.",
    emoji: "🗓️",
    category: "streak",
  },
  {
    id: "streak_30",
    label: "30 Dias de Acesso",
    description: "Esteve no site em 30 dias diferentes.",
    emoji: "🏅",
    category: "streak",
  },
  // --- Watch milestones ---
  {
    id: "episodes_10",
    label: "Animes Assistidos: 10",
    description: "Completou 10 episódios no total.",
    emoji: "📺",
    category: "milestone",
  },
  {
    id: "episodes_50",
    label: "Animes Assistidos: 50",
    description: "Completou 50 episódios no total.",
    emoji: "🎬",
    category: "milestone",
  },
  {
    id: "episodes_100",
    label: "Maratonista Titã",
    description: "Completou 100 episódios no total.",
    emoji: "🏆",
    category: "milestone",
  },
  {
    id: "series_finished",
    label: "Série Concluída",
    description: "Terminou todos os episódios de um anime.",
    emoji: "🎉",
    category: "milestone",
  },
  {
    id: "season_finished",
    label: "Temporada Finalizada",
    description: "Assistiu todos os episódios de uma temporada.",
    emoji: "⭐",
    category: "milestone",
  },
  // --- Collection badges ---
  {
    id: "favorites_10",
    label: "Colecionador de Favoritos",
    description: "Tem 10 animes favoritos.",
    emoji: "💎",
    category: "collection",
  },
  {
    id: "new_anime_watcher",
    label: "Descobridor de Novidades",
    description: "Assistiu 5 animes recém-adicionados.",
    emoji: "🚀",
    category: "activity",
  },
  {
    id: "profile_complete",
    label: "Perfil Completo",
    description: "Preencheu nome, foto e bio.",
    emoji: "🪪",
    category: "social",
  },
  {
    id: "loyal_user",
    label: "Usuário Fiel",
    description: "Tem conta há mais de 30 dias.",
    emoji: "🎖️",
    category: "streak",
  },
  {
    id: "master_lists",
    label: "Mestre das Listas",
    description: "Criou 5 listas personalizadas.",
    emoji: "📚",
    category: "collection",
  },
  {
    id: "first_rating",
    label: "Primeira Avaliação",
    description: "Deu nota para 1 anime.",
    emoji: "⭐",
    category: "activity",
  },
  {
    id: "active_rater",
    label: "Avaliador Ativo",
    description: "Avaliou 10 animes.",
    emoji: "🌟",
    category: "activity",
  },
  {
    id: "genre_explorer",
    label: "Explorador de Gêneros",
    description: "Assistiu animes de 5 gêneros diferentes.",
    emoji: "🗺️",
    category: "activity",
  },
  {
    id: "genre_focused",
    label: "Gosto Bem Definido",
    description: "Favoritou 10 animes do mesmo gênero.",
    emoji: "🎯",
    category: "collection",
  },
  {
    id: "library_organized",
    label: "Biblioteca Organizada",
    description: "Separou animes em categorias ou listas.",
    emoji: "🗂️",
    category: "collection",
  },
];

export function getAchievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
