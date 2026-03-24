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
  return value ? value : null;
}

function validateCredentials(email: string, password: string) {
  if (!email) {
    throw new HttpError(400, 'L’adresse e-mail est obligatoire.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'L’adresse e-mail est invalide.');
  }

  if (password.length < 8) {
    throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
  }
}

function toSession(user: { id: number; email: string; name: string | null }) {
  return {
    token: issueAuthToken(user),
    user
  };
}

export async function register(input: AuthInput) {
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

export async function login(input: AuthInput) {
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
