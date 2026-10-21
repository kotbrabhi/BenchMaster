import { createCipheriv, createECDH, createHmac, createPrivateKey, createPublicKey, randomBytes, sign } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';

type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };
type StoredSubscription = { id: number; userId: number; endpoint: string; p256dh: string; auth: string };

const base64Url = (value: Buffer | string) => Buffer.from(value).toString('base64url');
const decodeBase64Url = (value: string) => Buffer.from(value, 'base64url');

function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  const publicBytes = decodeBase64Url(publicKey);
  const privateBytes = decodeBase64Url(privateKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) return null;
  try {
    const privateKeyObject = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: base64Url(publicBytes.subarray(1, 33)), y: base64Url(publicBytes.subarray(33, 65)), d: base64Url(privateBytes) }, format: 'jwk' });
    const derived = createPublicKey(privateKeyObject).export({ format: 'jwk' });
    if (derived.x !== base64Url(publicBytes.subarray(1, 33)) || derived.y !== base64Url(publicBytes.subarray(33, 65))) return null;
  } catch { return null; }
  return { publicKey, publicBytes, privateBytes, subject };
}

export function getPushPublicKey() {
  const config = vapidConfig();
  if (!config) throw new HttpError(503, 'Les notifications push ne sont pas configurées.');
  return { publicKey: config.publicKey };
}

function validateSubscription(raw: unknown): PushSubscriptionInput {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Abonnement push invalide.');
  const value = raw as Partial<PushSubscriptionInput>;
  if (typeof value.endpoint !== 'string' || value.endpoint.length > 2048 || typeof value.keys?.p256dh !== 'string' || typeof value.keys.auth !== 'string') {
    throw new HttpError(400, 'Abonnement push invalide.');
  }
  let endpoint: URL;
  try { endpoint = new URL(value.endpoint); } catch { throw new HttpError(400, 'Adresse push invalide.'); }
  const host = endpoint.hostname.toLowerCase();
  const trustedPushHost = host === 'fcm.googleapis.com' || host === 'push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com')
    || host === 'updates.push.services.mozilla.com' || host === 'web.push.apple.com'
    || host.endsWith('.notify.windows.com');
  if (endpoint.protocol !== 'https:' || !trustedPushHost) throw new HttpError(400, 'Fournisseur push non pris en charge.');
  const p256dh = decodeBase64Url(value.keys.p256dh);
  const auth = decodeBase64Url(value.keys.auth);
  if (p256dh.length !== 65 || p256dh[0] !== 4 || auth.length < 16 || auth.length > 32) throw new HttpError(400, 'Clés push invalides.');
  return { endpoint: endpoint.toString(), keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
}

export async function savePushSubscription(userId: number, raw: unknown) {
  const subscription = validateSubscription(raw);
  await prisma.$executeRaw`
    INSERT INTO "PushSubscription" ("userId", "endpoint", "p256dh", "auth")
    VALUES (${userId}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth})
    ON CONFLICT ("endpoint") DO UPDATE SET "userId" = EXCLUDED."userId", "p256dh" = EXCLUDED."p256dh", "auth" = EXCLUDED."auth", "updatedAt" = CURRENT_TIMESTAMP
  `;
  return { saved: true };
}

export async function removePushSubscription(userId: number, rawEndpoint: unknown) {
  if (typeof rawEndpoint !== 'string' || rawEndpoint.length > 2048) throw new HttpError(400, 'Adresse push invalide.');
  await prisma.$executeRaw`DELETE FROM "PushSubscription" WHERE "userId" = ${userId} AND "endpoint" = ${rawEndpoint}`;
  return { removed: true };
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  const blocks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  for (let index = 1; Buffer.concat(blocks).length < length; index += 1) {
    previous = createHmac('sha256', prk).update(Buffer.concat([previous, info, Buffer.from([index])])).digest();
    blocks.push(previous);
  }
  return Buffer.concat(blocks).subarray(0, length);
}

function encryptPayload(subscription: StoredSubscription, payload: string, serverPublic: Buffer, serverPrivate: Buffer) {
  const userPublic = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(serverPrivate);
  const sharedSecret = ecdh.computeSecret(userPublic);
  const authPrk = createHmac('sha256', authSecret).update(sharedSecret).digest();
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), userPublic, serverPublic]);
  const ikm = hkdfExpand(authPrk, keyInfo, 32);
  const salt = randomBytes(16);
  const prk = createHmac('sha256', salt).update(ikm).digest();
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([salt, recordSize, Buffer.from([serverPublic.length]), serverPublic, ciphertext]);
}

function vapidAuthorization(endpoint: URL, config: NonNullable<ReturnType<typeof vapidConfig>>) {
  const privateKey = createPrivateKey({ key: {
    kty: 'EC', crv: 'P-256',
    x: base64Url(config.publicBytes.subarray(1, 33)),
    y: base64Url(config.publicBytes.subarray(33, 65)),
    d: base64Url(config.privateBytes)
  }, format: 'jwk' });
  const header = base64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = base64Url(JSON.stringify({ aud: endpoint.origin, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: config.subject }));
  const unsigned = `${header}.${claims}`;
  const signature = sign('sha256', Buffer.from(unsigned), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${unsigned}.${base64Url(signature)}, k=${config.publicKey}`;
}

async function sendPush(subscription: StoredSubscription, payload: string) {
  const config = vapidConfig();
  if (!config) return;
  const body = encryptPayload(subscription, payload, config.publicBytes, config.privateBytes);
  const endpoint = new URL(subscription.endpoint);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuthorization(endpoint, config),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal'
    },
    body
  });
  if (response.status === 404 || response.status === 410) {
    await prisma.$executeRaw`DELETE FROM "PushSubscription" WHERE "id" = ${subscription.id}`;
  } else if (!response.ok) {
    console.warn(`Web Push provider returned ${response.status} for subscription ${subscription.id}.`);
  }
}

export async function notifyUsersOfProposal(authorUserId: number, proposal: { id: number; category: string; startsAt: Date; area: string; teamName: string }) {
  if (!vapidConfig()) return;
  try {
    const subscriptions = await prisma.$queryRaw<StoredSubscription[]>`
      SELECT s."id", s."userId", s."endpoint", s."p256dh", s."auth"
      FROM "PushSubscription" s
      WHERE s."userId" <> ${authorUserId}
    `;
    if (!subscriptions.length) return;
    const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(proposal.startsAt);
    const payload = JSON.stringify({
      title: 'Nouveau match proposé',
      body: `${proposal.teamName} · ${proposal.category} · ${date} · ${proposal.area}`,
      url: `/friendlies/${proposal.id}`
    });
    const results = await Promise.allSettled(subscriptions.map((subscription) => sendPush(subscription, payload)));
    for (const result of results) if (result.status === 'rejected') console.warn('Web Push delivery failed.', result.reason);
  } catch (error) {
    console.warn('Unable to send Web Push notifications for a new proposal.', error);
  }
}
