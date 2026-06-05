require('dotenv').config()
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL is not set in .env')
  process.exit(1)
}

const backupsDir = path.join(__dirname, '../../backups')
fs.mkdirSync(backupsDir, { recursive: true })

const now = new Date()
const stamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
  '_',
  String(now.getHours()).padStart(2, '0'),
  String(now.getMinutes()).padStart(2, '0'),
].join('')

const outfile = path.join(backupsDir, `temple_backup_${stamp}.sql`)

function runBackup() {
  try {
    execSync('pg_dump --version', { stdio: 'ignore' })
    execSync(`pg_dump "${dbUrl}" -f "${outfile}"`, { stdio: 'inherit' })
    return true
  } catch {
    return false
  }
}

function runDockerBackup() {
  const container = process.env.POSTGRES_CONTAINER || 'temple_trust_db'
  const user = process.env.DB_USER || 'temple_admin'
  const dbName = process.env.DB_NAME || 'temple_trust_db'

  execSync(
    `docker exec ${container} pg_dump -U ${user} ${dbName} > "${outfile}"`,
    { stdio: 'inherit', shell: true }
  )
}

try {
  if (!runBackup()) {
    console.log('pg_dump not found locally — using Docker container...')
    runDockerBackup()
  }
  console.log(`Backup created: ${outfile}`)
} catch (err) {
  console.error('Backup failed:', err.message)
  console.error('Install PostgreSQL client tools or ensure Docker container is running.')
  process.exit(1)
}
