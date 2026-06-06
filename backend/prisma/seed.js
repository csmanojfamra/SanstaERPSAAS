require('dotenv').config()

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const trust = await prisma.trust.upsert({
    where: { id: 'clsanwaliya001' },
    update: {
      slug: 'sanwaliya-seth-deoli',
      custom_domain: 'manage.sanwaliyasethdeoli.in',
    },
    create: {
      id: 'clsanwaliya001',
      slug: 'sanwaliya-seth-deoli',
      custom_domain: 'manage.sanwaliyasethdeoli.in',
      name: 'Shri Sanwaliya Seth Mandir Nirman Samiti',
      name_hindi: 'श्री सांवलिया सेठ मंदिर निर्माण समिति',
      address: 'Near Power House, Kuchalwara Road, Hanuman Nagar, Jahajpur, Bhilwara',
      phone: '9261180000',
      receipt_prefix: 'SSSM',
      donor_threshold: 1100,
      current_fy: '2025-26',
      primary_color: '#FF6B00',
      secondary_color: '#7B1C1C',
    },
  })
  console.log('Trust created:', trust.name)

  const adminHash = await bcrypt.hash('Admin@1234', 12)
  await prisma.user.upsert({
    where: { trust_id_username: { trust_id: trust.id, username: 'admin' } },
    update: { is_platform_admin: true },
    create: {
      trust_id: trust.id,
      name: 'Administrator',
      username: 'admin',
      password_hash: adminHash,
      role: 'ADMIN',
      is_platform_admin: true,
    },
  })
  console.log('Admin user created')

  const opHash = await bcrypt.hash('Operator@1234', 12)
  await prisma.user.upsert({
    where: { trust_id_username: { trust_id: trust.id, username: 'krishna' } },
    update: {},
    create: {
      trust_id: trust.id,
      name: 'Krishna Pratap Singh Naruka',
      username: 'krishna',
      password_hash: opHash,
      role: 'OPERATOR',
    },
  })
  console.log('Operator user created')

  const trustAdminHash = await bcrypt.hash('123456', 12)
  await prisma.user.upsert({
    where: { trust_id_username: { trust_id: trust.id, username: 'sanwaliyatrust@gmail.com' } },
    update: {
      password_hash: trustAdminHash,
      role: 'ADMIN',
      is_platform_admin: false,
      is_active: true,
      name: 'Sanwaliya Trust Admin',
    },
    create: {
      trust_id: trust.id,
      name: 'Sanwaliya Trust Admin',
      username: 'sanwaliyatrust@gmail.com',
      password_hash: trustAdminHash,
      role: 'ADMIN',
      is_platform_admin: false,
    },
  })
  console.log('Sanwaliya trust admin created')

  await prisma.trustee.upsert({
    where: { id: 'trustee_001' },
    update: {},
    create: {
      id: 'trustee_001',
      trust_id: trust.id,
      name: 'Krishna Pratap Singh Naruka',
      name_hindi: 'कृष्ण प्रताप सिंह नारुका',
      mobile: '9261180000',
      role: 'Convener',
      display_order: 1,
    },
  })
  console.log('Initial trustee seeded')

  console.log('\nDatabase seeded successfully!')
  console.log('----------------------------------------')
  console.log('Trust ID   :', trust.id)
  console.log('----------------------------------------')
  console.log('Admin    -> username: admin                    | password: Admin@1234')
  console.log('Operator -> username: krishna                  | password: Operator@1234')
  console.log('Trust    -> username: sanwaliyatrust@gmail.com  | password: 123456')
  console.log('----------------------------------------')
  console.log('WARNING: Change all passwords before going live')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

