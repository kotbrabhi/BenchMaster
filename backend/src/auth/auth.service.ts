import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';
import { generatePasswordSalt, hashPassword, verifyPassword } from './password';
import { issueAuthToken } from './token';

export interface AuthInput {
  email: string;
  password: string;
  name?: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeName(name: string | undefined) {
  const value = name?.trim();
  return value ? value.slice(0, 80) : null;
}

function validateCredentials(email: string, password: string) {
  if (!email) {
    throw new HttpError(400, 'L’adresse e-mail est obligatoire.');
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'L’adresse e-mail est invalide.');
  }

  if (password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Le mot de passe doit contenir entre 8 et 128 caractères.');
  }
}

function parseAuthInput(input: unknown, registration: boolean): AuthInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Les identifiants sont invalides.');
  const value = input as Record<string, unknown>;
  const allowedKeys = registration ? ['email', 'password', 'name'] : ['email', 'password'];
  if (Object.keys(value).some((key) => !allowedKeys.includes(key))) throw new HttpError(400, 'Les identifiants contiennent des champs inconnus.');
  if (typeof value.email !== 'string' || typeof value.password !== 'string' || (value.name !== undefined && typeof value.name !== 'string')) {
    throw new HttpError(400, 'Les identifiants sont invalides.');
  }
  if (value.name !== undefined && (value.name.trim().length === 0 || value.name.trim().length > 80)) {
    throw new HttpError(400, 'Le nom doit contenir entre 1 et 80 caractères.');
  }
  return { email: value.email, password: value.password, ...(typeof value.name === 'string' ? { name: value.name } : {}) };
}

function toSession(user: { id: number; email: string; name: string | null }) {
  return {
    token: issueAuthToken(user),
    user
  };
}

export async function register(rawInput: unknown) {
  const input = parseAuthInput(rawInput, true);
  const email = normalizeEmail(input.email);
  const password = input.password.trim();
  const name = sanitizeName(input.name);

  validateCredentials(email, password);

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new HttpError(409, 'Un compte existe déjà avec cette adresse e-mail.');
  }

  const passwordSalt = generatePasswordSalt();
  const passwordHash = hashPassword(password, passwordSalt);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordSalt,
      passwordHash
    },
    select: {
      id: true,
      email: true,
      name: true
    }
  });

  return toSession(user);
}

export async function login(rawInput: unknown) {
  const input = parseAuthInput(rawInput, false);
  const email = normalizeEmail(input.email);
  const password = input.password.trim();

  validateCredentials(email, password);

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    throw new HttpError(401, 'Identifiants invalides.');
  }

  return toSession({
    id: user.id,
    email: user.email,
    name: user.name
  });
}

export async function getUserById(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true
    }
  });

  if (!user) {
    throw new HttpError(401, 'Utilisateur introuvable.');
  }

  return user;
}
