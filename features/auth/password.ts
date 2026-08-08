export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_PATTERN = "^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$";
export const PASSWORD_REQUIREMENTS = "Use at least 8 characters, including one letter and one digit.";

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$/;

export function isValidPassword(password: string) {
  return PASSWORD_REGEX.test(password);
}
