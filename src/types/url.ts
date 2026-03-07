/** URL-related DTO types used by url/service and url/controller. */

export interface CreateUrlDto {
  originalUrl: string;
  customAlias?: string;
  expiresAt?: string;
}

export interface UpdateUrlDto {
  originalUrl?: string;
  shortcode?: string;
  /** Accepts boolean or the string "true"/"false" from form body parsers. */
  isActive?: string | boolean;
  expiresAt?: string;
}
