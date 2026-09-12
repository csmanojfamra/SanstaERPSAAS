#!/usr/bin/env node
/**
 * Create trust admin users or reset passwords (bypasses admin UI).
 *
 * Requires DATABASE_URL (and DIRECT_URL if set) in env — same as the ERP app.
 *
 * Examples:
 *   node backend/scripts/manage-user.js list
 *   node backend/scripts/manage-user.js list --trust-id clsanwaliya001
 *
 *   node backend/scripts/manage-user.js create \
 *     --trust-id clsanwaliya001 \
 *     --username mandir_staff \
 *     --password 'SecurePass@123' \
 *     --name 'Mandir Staff' \
 *     --role OPERATOR
 *
 *   node backend/scripts/manage-user.js reset-password \
 *     --trust-id clsanwaliya001 \
 *     --username sanwaliyatrust@gmail.com \
 *     --password 'NewPass@123'
 */
require('dotenv').config()

const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        args[key] = true
      } else {
        args[key] = next
        i += 1
      }
    } else {
      args._.push(token)
    }
  }
  return args
}

function usage() {
  console.log(`
Usage:
  node backend/scripts/manage-user.js list [--trust-id ID]

  node backend/scripts/manage-user.js create \\
    --trust-id ID --username USER --password PASS --name "Full Name" [--role ADMIN|OPERATOR]

  node backend/scripts/manage-user.js reset-password \\
    --trust-id ID --username USER --password NEW_PASS

Defaults:
  --trust-id  clsanwaliya001 (Sanwaliya Seth Mandir)
  --role      OPERATOR

Production (Coolify): run inside the app container, e.g.
  docker exec -it <app-container-name> node backend/scripts/manage-user.js list
`)
}

async function listUsers(trustId) {
  const trust = await prisma.trust.findUnique({ where: { id: trustId } })
  if (!trust) {
    console.error('Trust not found:', trustId)
    process.exit(1)
  }

  const users = await prisma.user.findMany({
    where: { trust_id: trustId },
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      is_active: true,
      is_platform_admin: true,
      last_login: true,
      created_at: true,
    },
  })

  console.log(`Trust: ${trust.name_hindi || trust.name} (${trust.id})`)
  console.log('Users:', users.length)
  console.log('---')
  for (const u of users) {
    console.log(
      [
        u.username,
        u.role,
        u.is_active ? 'active' : 'inactive',
        u.is_platform_admin ? 'platform-admin' : 'trust-user',
        u.name,
      ].join(' | '),
    )
  }
}

async function createUser({ trustId, username, password, name, role }) {
  if (!username || !password || !name) {
    console.error('create requires --username, --password, and --name')
    process.exit(1)
  }

  if (!['ADMIN', 'OPERATOR'].includes(role)) {
    console.error('--role must be ADMIN or OPERATOR')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters')
    process.exit(1)
  }

  const trust = await prisma.trust.findUnique({ where: { id: trustId } })
  if (!trust) {
    console.error('Trust not found:', trustId)
    process.exit(1)
  }

  const existing = await prisma.user.findFirst({
    where: { trust_id: trustId, username },
  })
  if (existing) {
    console.error('Username already exists for this trust:', username)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      trust_id: trustId,
      name,
      username,
      password_hash: passwordHash,
      role,
      is_platform_admin: false,
    },
  })

  console.log('User created:')
  console.log('  id      ', user.id)
  console.log('  username', user.username)
  console.log('  role    ', user.role)
  console.log('  trust   ', trustId)
}

async function resetPassword({ trustId, username, password }) {
  if (!username || !password) {
    console.error('reset-password requires --username and --password')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters')
    process.exit(1)
  }

  const user = await prisma.user.findFirst({
    where: { trust_id: trustId, username },
  })

  if (!user) {
    console.error('User not found:', username)
    process.exit(1)
  }

  if (user.is_platform_admin) {
    console.error('Refusing to reset platform administrator password from this script')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash: passwordHash },
  })

  console.log('Password updated for:', username)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const command = args._[0]

  if (!command || command === 'help' || command === '-h' || command === '--help') {
    usage()
    return
  }

  const trustId = args['trust-id'] || process.env.TRUST_ID || 'clsanwaliya001'

  if (command === 'list') {
    await listUsers(trustId)
    return
  }

  if (command === 'create') {
    await createUser({
      trustId,
      username: args.username,
      password: args.password,
      name: args.name,
      role: (args.role || 'OPERATOR').toUpperCase(),
    })
    return
  }

  if (command === 'reset-password') {
    await resetPassword({
      trustId,
      username: args.username,
      password: args.password,
    })
    return
  }

  console.error('Unknown command:', command)
  usage()
  process.exit(1)
}

main()
  .catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
