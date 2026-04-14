import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ModerationResult =
  | { action: 'APPROVED' }
  | { action: 'BLOCKED'; reason: string }
  | { action: 'PENDING_REVIEW'; reason: string };

type OpenAIModerationResponse = {
  results?: Array<{
    category_scores?: Record<string, number>;
  }>;
};

// Termos devem ser escritos sem acentos — o conteúdo é normalizado antes da verificação
const BLOCKED_TERMS: string[] = [
  // Política e militância
  'lula',
  'bolsonaro',
  'psl',
  'psol',
  'mdb',
  'direita',
  'esquerda',
  'fascista',
  'comunista',
  'socialismo',
  'capitalismo',
  'golpe',
  'impeachment',
  'biden',
  'trump',
  'obama',
  'democrat',
  'republican',
  'partido',
  'eleicao',
  'eleicoes',
  'voto',
  'urna',
  'eleccion',
  'votacion',
  'partido politico',
  'feminismo',
  'feminista',
  'racismo',
  'racista',
  'homofobico',
  'homofobica',
  'transfobia',
  'fascismo',
  'misogino',

  // Discurso de ódio direto
  'nazi',
  'nazista',
  'hitler',
  'supremacista',

  // Spam / promessas agressivas
  'clique aqui',
  'acesse agora',
  'ganhe dinheiro',
  'renda extra',
  'click here',
  'earn money',
  'make money fast',
  'haga clic',
  'gane dinero',
  'plataforma nova',
];

const WORD_BOUNDARY_TERMS = ['pt'];

const HARD_BLOCK_CATEGORIES = [
  'hate',
  'hate/threatening',
  'harassment',
  'harassment/threatening',
  'sexual/minors',
];

const SOFT_FLAG_CATEGORIES = [
  'sexual',
  'violence',
  'self-harm',
  'self-harm/intent',
];

const SOFT_FLAG_THRESHOLD = 0.5;
const HARD_BLOCK_THRESHOLD = 0.85;

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly configService: ConfigService) {}

  async moderate(content: string): Promise<ModerationResult> {
    const cleanedContent = this.normalize(content);

    if (!cleanedContent) {
      return {
        action: 'BLOCKED',
        reason: 'Conteúdo vazio não é permitido.',
      };
    }

    const localResult = this.checkLocalTerms(cleanedContent);
    if (localResult) {
      return localResult;
    }

    try {
      return await this.checkWithOpenAI(cleanedContent);
    } catch (error) {
      this.logger.warn(
        'OpenAI Moderation API indisponível. Aprovando por fallback.',
        error instanceof Error ? error.stack : undefined,
      );

      // TODO: quando adicionar créditos na OpenAI, trocar por PENDING_REVIEW:
      // return {
      //   action: 'PENDING_REVIEW',
      //   reason: 'Conteúdo enviado para revisão temporária.',
      // };

      return { action: 'APPROVED' };
    }
  }

  private normalize(content: string): string {
    return content
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private checkLocalTerms(content: string): ModerationResult | null {
    for (const term of BLOCKED_TERMS) {
      if (content.includes(term)) {
        return {
          action: 'BLOCKED',
          reason: 'Conteúdo não permitido no Moment.',
        };
      }
    }

    for (const term of WORD_BOUNDARY_TERMS) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');

      if (regex.test(content)) {
        return {
          action: 'BLOCKED',
          reason: 'Conteúdo não permitido no Moment.',
        };
      }
    }

    return null;
  }

  private async checkWithOpenAI(content: string): Promise<ModerationResult> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY não configurada. Conteúdo enviado para revisão.',
      );

      return {
        action: 'PENDING_REVIEW',
        reason: 'Conteúdo enviado para revisão temporária.',
      };
    }

    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: content }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Moderation API retornou ${response.status}`);
    }

    const data = (await response.json()) as OpenAIModerationResponse;
    const result = data.results?.[0];

    if (!result) {
      return { action: 'APPROVED' };
    }

    const scores = result.category_scores ?? {};

    for (const category of HARD_BLOCK_CATEGORIES) {
      const score = scores[category] ?? 0;

      if (score >= HARD_BLOCK_THRESHOLD) {
        return {
          action: 'BLOCKED',
          reason: 'Conteúdo não permitido no Moment.',
        };
      }
    }

    for (const category of SOFT_FLAG_CATEGORIES) {
      const score = scores[category] ?? 0;

      if (score >= SOFT_FLAG_THRESHOLD) {
        return {
          action: 'PENDING_REVIEW',
          reason: 'Conteúdo sinalizado para revisão.',
        };
      }
    }

    return { action: 'APPROVED' };
  }
}