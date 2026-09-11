const router = require('express').Router()
const { z } = require('zod')
const prisma = require('../../lib/prisma')
const { validate, parseQueryDateParam } = require('../../utils/validators')
const { createAuditLog } = require('../../services/audit.service')
const { getAuditContext } = require('../../utils/auditContext')
const { generateInKindReceiptNumber } = require('../../services/inkindReceiptNumber.service')
const { getStockBalance, getBalancesForTrust } = require('../../services/stock.service')

const stockItemSchema = z.object({
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(30).default('pcs'),
  category: z.string().max(80).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  is_active: z.boolean().optional(),
})

const receiptLineSchema = z.object({
  stock_item_id: z.string().min(1),
  quantity: z.coerce.number().positive(),
  weight: z.coerce.number().positive().optional().nullable(),
  weight_unit: z.string().max(20).optional().or(z.literal('')).nullable(),
  description: z.string().max(300).optional().or(z.literal('')),
  estimated_value: z.coerce.number().nonnegative().optional().nullable(),
})

const receiptSchema = z.object({
  donor_name: z.string().min(2).max(200),
  donor_mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .optional()
    .or(z.literal('')),
  donor_city: z.string().max(100).optional().or(z.literal('')),
  receipt_date: z.string().min(1),
  notes: z.string().max(500).optional().or(z.literal('')),
  estimated_value: z.coerce.number().nonnegative().optional().nullable(),
  lines: z.array(receiptLineSchema).min(1),
})

const utiliseSchema = z.object({
  stock_item_id: z.string().min(1),
  quantity: z.coerce.number().positive(),
  movement_date: z.string().min(1),
  reason: z.string().min(2).max(500),
})

// GET /api/v1/inkind/items
router.get('/items', async (req, res, next) => {
  try {
    const includeInactive = String(req.query.include_inactive || '') === '1'
    const items = await prisma.stockItem.findMany({
      where: {
        trust_id: req.trustId,
        ...(includeInactive ? {} : { is_active: true }),
      },
      orderBy: { name: 'asc' },
    })
    const balances = await getBalancesForTrust(
      req.trustId,
      items.map((i) => i.id),
    )
    res.json({
      success: true,
      items: items.map((item) => ({
        ...item,
        stock: balances[item.id] || { inbound: 0, utilised: 0, balance: 0 },
      })),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/inkind/items
router.post('/items', async (req, res, next) => {
  try {
    const data = validate(stockItemSchema, req.body)
    const item = await prisma.stockItem.create({
      data: {
        trust_id: req.trustId,
        name: data.name.trim(),
        unit: data.unit || 'pcs',
        category: data.category || null,
        notes: data.notes || null,
        is_active: data.is_active ?? true,
      },
    })
    await createAuditLog({
      ...getAuditContext(req),
      module: 'INKIND',
      action: 'CREATE',
      entity_type: 'StockItem',
      entity_id: item.id,
      description: `Stock item created: ${item.name}`,
    })
    res.status(201).json({ success: true, item })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Item name already exists', code: 'DUPLICATE' })
    }
    next(err)
  }
})

// PUT /api/v1/inkind/items/:id
router.put('/items/:id', async (req, res, next) => {
  try {
    const data = validate(stockItemSchema.partial(), req.body)
    const existing = await prisma.stockItem.findFirst({
      where: { id: req.params.id, trust_id: req.trustId },
    })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Stock item not found' })
    }
    const item = await prisma.stockItem.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.category !== undefined ? { category: data.category || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      },
    })
    res.json({ success: true, item })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Item name already exists', code: 'DUPLICATE' })
    }
    next(err)
  }
})

// GET /api/v1/inkind/receipts
router.get('/receipts', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25))
    const skip = (page - 1) * limit
    const search = (req.query.search || '').trim()
    const from = parseQueryDateParam(req.query.date_from, 'date_from')
    const to = parseQueryDateParam(req.query.date_to, 'date_to')

    const where = {
      trust_id: req.trustId,
      is_deleted: false,
      ...(search
        ? {
            OR: [
              { receipt_number: { contains: search, mode: 'insensitive' } },
              { donor_name: { contains: search, mode: 'insensitive' } },
              { donor_mobile: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(from || to
        ? {
            receipt_date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    }

    const [total, receipts] = await Promise.all([
      prisma.inKindReceipt.count({ where }),
      prisma.inKindReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ receipt_date: 'desc' }, { created_at: 'desc' }],
        include: {
          lines: { include: { stock_item: { select: { id: true, name: true, unit: true } } } },
        },
      }),
    ])

    res.json({
      success: true,
      receipts,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/inkind/receipts/:id
router.get('/receipts/:id', async (req, res, next) => {
  try {
    const receipt = await prisma.inKindReceipt.findFirst({
      where: { id: req.params.id, trust_id: req.trustId, is_deleted: false },
      include: {
        lines: { include: { stock_item: true } },
      },
    })
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'In-kind receipt not found' })
    }
    res.json({ success: true, receipt })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/inkind/receipts
router.post('/receipts', async (req, res, next) => {
  try {
    const data = validate(receiptSchema, req.body)
    const receiptDate = parseQueryDateParam(data.receipt_date, 'receipt_date')
    if (!receiptDate) {
      return res.status(400).json({ success: false, message: 'Valid receipt_date is required' })
    }

    const itemIds = [...new Set(data.lines.map((l) => l.stock_item_id))]
    const items = await prisma.stockItem.findMany({
      where: { trust_id: req.trustId, id: { in: itemIds }, is_active: true },
    })
    if (items.length !== itemIds.length) {
      return res.status(400).json({ success: false, message: 'One or more stock items are invalid' })
    }

    const lineValueSum = data.lines.reduce((sum, line) => sum + Number(line.estimated_value || 0), 0)
    const estimatedValue =
      data.estimated_value != null && data.estimated_value !== ''
        ? Number(data.estimated_value)
        : lineValueSum > 0
          ? lineValueSum
          : null

    const receipt = await prisma.$transaction(async (tx) => {
      const receipt_number = await generateInKindReceiptNumber(req.trustId, tx)
      const created = await tx.inKindReceipt.create({
        data: {
          trust_id: req.trustId,
          receipt_number,
          donor_name: data.donor_name.trim(),
          donor_mobile: data.donor_mobile || null,
          donor_city: data.donor_city || null,
          receipt_date: receiptDate,
          notes: data.notes || null,
          estimated_value: estimatedValue,
          created_by: req.user?.id || null,
          lines: {
            create: data.lines.map((line) => {
              const hasWeight = line.weight != null && line.weight !== '' && Number(line.weight) > 0
              return {
                stock_item_id: line.stock_item_id,
                quantity: line.quantity,
                weight: hasWeight ? line.weight : null,
                weight_unit: hasWeight ? (line.weight_unit || 'g') : null,
                description: line.description || null,
                estimated_value: line.estimated_value ?? null,
              }
            }),
          },
        },
        include: {
          lines: { include: { stock_item: true } },
        },
      })

      for (const line of created.lines) {
        await tx.stockMovement.create({
          data: {
            trust_id: req.trustId,
            stock_item_id: line.stock_item_id,
            movement_type: 'IN',
            quantity: line.quantity,
            movement_date: receiptDate,
            reason: `In-kind receipt ${created.receipt_number}`,
            inkind_receipt_id: created.id,
            created_by: req.user?.id || null,
          },
        })
      }
      return created
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'INKIND',
      action: 'CREATE',
      entity_type: 'InKindReceipt',
      entity_id: receipt.id,
      description: `In-kind receipt ${receipt.receipt_number} from ${receipt.donor_name}`,
    })

    res.status(201).json({ success: true, receipt })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/inkind/utilise
router.post('/utilise', async (req, res, next) => {
  try {
    const data = validate(utiliseSchema, req.body)
    const movementDate = parseQueryDateParam(data.movement_date, 'movement_date')
    if (!movementDate) {
      return res.status(400).json({ success: false, message: 'Valid movement_date is required' })
    }

    const item = await prisma.stockItem.findFirst({
      where: { id: data.stock_item_id, trust_id: req.trustId, is_active: true },
    })
    if (!item) {
      return res.status(404).json({ success: false, message: 'Stock item not found' })
    }

    const stock = await getStockBalance(req.trustId, item.id)
    if (Number(data.quantity) > stock.balance + 1e-9) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${stock.balance} ${item.unit}`,
        code: 'INSUFFICIENT_STOCK',
        available: stock.balance,
      })
    }

    const movement = await prisma.stockMovement.create({
      data: {
        trust_id: req.trustId,
        stock_item_id: item.id,
        movement_type: 'UTILISE',
        quantity: data.quantity,
        movement_date: movementDate,
        reason: data.reason.trim(),
        created_by: req.user?.id || null,
      },
      include: { stock_item: true },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'INKIND',
      action: 'UTILISE',
      entity_type: 'StockMovement',
      entity_id: movement.id,
      description: `Utilised ${data.quantity} ${item.unit} of ${item.name}`,
    })

    const updatedStock = await getStockBalance(req.trustId, item.id)
    res.status(201).json({ success: true, movement, stock: updatedStock })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/inkind/stock-report
router.get('/stock-report', async (req, res, next) => {
  try {
    const items = await prisma.stockItem.findMany({
      where: { trust_id: req.trustId, is_active: true },
      orderBy: { name: 'asc' },
    })
    const balances = await getBalancesForTrust(
      req.trustId,
      items.map((i) => i.id),
    )
    res.json({
      success: true,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        category: item.category,
        ...(balances[item.id] || { inbound: 0, utilised: 0, balance: 0 }),
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/inkind/movements
router.get('/movements', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const skip = (page - 1) * limit
    const where = {
      trust_id: req.trustId,
      ...(req.query.stock_item_id ? { stock_item_id: req.query.stock_item_id } : {}),
      ...(req.query.movement_type ? { movement_type: req.query.movement_type } : {}),
    }
    const [total, movements] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }],
        include: { stock_item: { select: { name: true, unit: true } } },
      }),
    ])
    res.json({
      success: true,
      movements,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
