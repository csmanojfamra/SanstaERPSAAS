require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const path = require('path')
const fs = require('fs')

const { apiLimiter } = require('./src/middleware/rateLimiter')
const errorHandler = require('./src/middleware/errorHandler')
const logger = require('./src/utils/logger')

// Ensure required directories exist
fs.mkdirSync(path.join(__dirname, 'uploads/receipts'), { recursive: true })
fs.mkdirSync(path.join(__dirname, 'fonts'), { recursive: true })

const app = express()
const PORT = process.env.PORT || 3000

app.use(helmet())
app.use(
  cors({
    origin: [
      process.env.APP_URL,
      process.env.ADMIN_URL,
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  })
)
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'))

app.use(express.json({ limit: '10mb' }))
app.use('/api', apiLimiter)

// Serve uploaded PDFs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// API routes
app.use('/api/v1', require('./src/routes/v1/index'))

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    version: '1.0.0',
    uptime: process.uptime(),
  })
})

// Serve React admin panel (built)
app.use('/admin', express.static(path.join(__dirname, '../admin-dist')))
app.get('/admin/*', (req, res) => {
  const adminIndex = path.join(__dirname, '../admin-dist/index.html')
  if (fs.existsSync(adminIndex)) {
    res.sendFile(adminIndex)
  } else {
    res.status(404).send('Admin panel not built yet. Run: npm run admin:build')
  }
})

// SaaS root — send users to admin login
app.get('/', (req, res) => {
  res.redirect('/admin/login')
})

// Global error handler — must be last
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info('Temple Trust server started', { port: PORT, env: process.env.NODE_ENV })
  console.log(`
  ================================================
  Temple Trust Management System v1.0
  Fastlegal Technologies Pvt Ltd
  ================================================
  Status  : Running
  Port    : ${PORT}
  API     : http://localhost:${PORT}/api/v1
  Health  : http://localhost:${PORT}/api/v1/health
  Admin   : http://localhost:5173  (npm run admin:dev)
  pgAdmin : http://localhost:5050
  Adminer : http://localhost:8080
  Env     : ${process.env.NODE_ENV}
  ------------------------------------------------
  Login   : admin / Admin@1234
  WARNING : Change password before going live
  ================================================
  `)
})

