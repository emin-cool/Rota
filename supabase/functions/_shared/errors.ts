import type { ErrorCode } from './types.ts';

/** Kullanıcıya gösterilebilecek Türkçe mesajlı uygulama hatası. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export const errors = {
  unauthorized: () => new AppError('unauthorized', 'Oturum açman gerekiyor.', 401),
  invalidInput: (detail?: string) =>
    new AppError(
      'invalid_input',
      detail ? `Geçersiz istek: ${detail}` : 'İstek bilgileri eksik ya da hatalı.',
      400,
    ),
  rateLimited: (limit: number) =>
    new AppError(
      'rate_limited',
      `Bugünlük rota oluşturma hakkın (${limit}) doldu. Yarın tekrar dene.`,
      429,
    ),
  startNotRoutable: () =>
    new AppError(
      'start_not_routable',
      'Başlangıç noktası yürünebilir ya da bisiklete uygun bir yola yakın değil. Noktayı bir yola yaklaştır.',
      422,
    ),
  upstreamBusy: () =>
    new AppError(
      'upstream_busy',
      'Rota servisi şu an yoğun. Birkaç dakika sonra tekrar dene.',
      503,
    ),
  upstreamUnavailable: () =>
    new AppError(
      'upstream_unavailable',
      'Rota servisine şu an ulaşılamıyor. Lütfen daha sonra tekrar dene.',
      502,
    ),
  weatherUnavailable: () =>
    new AppError(
      'upstream_unavailable',
      'Hava durumu şu an alınamıyor. Birazdan tekrar dene.',
      502,
    ),
  noRoutes: () =>
    new AppError(
      'no_routes',
      'Bu tercihlere uygun rota bulunamadı. Süreyi ya da başlangıç noktasını değiştirip tekrar dene.',
      404,
    ),
  internal: () => new AppError('internal', 'Beklenmeyen bir hata oluştu. Lütfen tekrar dene.', 500),
};
