/** User / admin DTO types. */

export interface CreateUserDto {
  username: string;
  password: string;
}

export interface UpdatePasswordDto {
  currentPassword: string;
  newPassword: string;
}
