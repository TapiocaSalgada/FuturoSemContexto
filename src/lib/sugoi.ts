export interface SugoiEpisodeData {
  error: boolean;
  searched_endpoint: string;
  episode: string;
}

export interface SugoiProvider {
  name: string;
  slug: string;
  has_ads: boolean;
  is_embed: boolean;
  episodes: SugoiEpisodeData[];
}

export interface SugoiApiResponse {
  error: boolean;
  message: string;
  status: number;
  data?: SugoiProvider[];
}

/**
 * Buscador de episódios utilizando a SugoiAPI
 * @param slug O slug do anime (ex: "naruto")
 * @param temporada A temporada do anime (ex: 1)
 * @param numeroEpisodio O número do episódio (ex: 1)
 * @returns Retorna a resposta da SugoiAPI contendo as URL dos episódios em diferentes provedores
 */
export async function getSugoiEpisodes(
  slug: string,
  temporada: number | string,
  numeroEpisodio: number | string
): Promise<SugoiApiResponse> {
  // A URL base da API deve ser definida nas variáveis de ambiente.
  // Por padrão usa localhost pois o projeto ainda não está hospedado em produção.
  const baseUrl = process.env.SUGOI_API_URL || 'http://localhost:8000';
  const endpoint = `${baseUrl}/episode/${slug}/${temporada}/${numeroEpisodio}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache por 1 hora se desejar
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          error: true,
          message: 'Not Found',
          status: 404,
        };
      }
      throw new Error(`Erro na SugoiAPI: ${response.statusText}`);
    }

    const data: SugoiApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar episódio na SugoiAPI:', error);
    return {
      error: true,
      message: error instanceof Error ?error.message : 'Unknown error',
      status: 500,
    };
  }
}
