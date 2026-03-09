/** URL-related DTO types used by url/service and url/controller. */

export interface CreateUrlDto {
  originalUrl: string;
  customAlias?: string;
  expiresAt?: string;
  password?: string;
  title?: string;
  description?: string;
  ogImageUrl?: string;
}

export interface UpdateUrlDto {
  originalUrl?: string;
  shortcode?: string;
  /** Accepts boolean or the string "true"/"false" from form body parsers. */
  isActive?: string | boolean;
  expiresAt?: string;
  password?: string;
  clearPassword?: string | boolean;
  title?: string;
  description?: string;
  ogImageUrl?: string;
}
