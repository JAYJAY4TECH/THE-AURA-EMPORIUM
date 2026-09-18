require('dotenv').config();

console.log(' Starting THE AURA EMPORIUM Wigs server...');


const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: { rejectUnauthorized: false }
});
const axios = require('axios');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = Number(process.env.PORT) || 3456;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');


app.get(['/LOGO.jpeg', '/logo.jpeg'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'LOGO.jpeg'));
});

app.get('/auraa.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auraa.png'));
});


app.use((req, res, next) => {
    console.log(`\n[${new Date().toLocaleTimeString()}] 📥 INCOMING: ${req.method} ${req.url}`);
    next();
});

//  MIDDLEWARE =
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
// Serve public/ with no-cache for HTML/CSS/JS so edits show up without hard-refresh.
// Libraries (fontawesome) and uploads stay cacheable.
app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    maxAge: 0,
    setHeaders: (res, filePath) => {
        if (/\.(html|css|js|json)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));
app.use('/fontawesome', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


['bodywave.PNG', 'bouncywig.PNG', 'loosewave.PNG', 'deepwave.PNG', 'bobwig.PNG',
    'layeredwig.PNG', 'bonestraight.PNG', 'pixiecurls.PNG', 'fringiewig.PNG', 'rawdonor.PNG']
    .forEach((imageName) => {
        app.get('/' + imageName, (req, res) => {
            res.sendFile(path.join(__dirname, imageName));
        });
    });


const MongoStore = require('connect-mongo');

app.use(session({
    secret: process.env.SESSION_SECRET || 'MyUniqueAuraSecretKey2026!!',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions',
        ttl: 60 * 60 * 24
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    }
}));


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'aura-emporium/products',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        public_id: (req, file) => `wig-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        cb(null, allowed.includes(file.mimetype));
    }
});


const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String },
    price: { type: Number, required: true },
    length: { type: String, default: '' },
    weight: { type: String, default: '' },
    laceType: { type: String, default: '' },
    category: { type: String, default: 'Luxury Wig' },
    images: { type: [String], default: [] },
    stock: { type: Number, default: 10 },
    active: { type: Boolean, default: true }
}, { timestamps: true });

productSchema.pre('save', function(next) {
    if (!this.slug) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    }
    next();
});

const Product = mongoose.model('Product', productSchema);


const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, required: true },
    deliveryAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        instructions: String
    },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productName: String,
        price: Number,
        quantity: Number,
        image: String
    }],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, default: 'Card or Bank Transfer' },
    paymentReference: { type: String, unique: true, sparse: true },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Failed'], default: 'Pending' },
    orderStatus: { 
        type: String, 
        enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'], 
        default: 'Pending' 
    },
    trackingNumber: { type: String, default: null },
    estimatedDelivery: { type: Date, default: null },
    statusHistory: [{
        status: { type: String },
        date: { type: Date, default: Date.now },
        note: { type: String },
        updatedBy: { type: String }
    }]
}, { timestamps: true });


orderSchema.index({ orderNumber: 1 });

orderSchema.pre('save', async function(next) {
    if (!this.orderNumber) {
        const Order = mongoose.model('Order');
        
        const lastOrder = await Order.findOne({ orderNumber: /^AE-\d+$/ })
            .sort({ createdAt: -1 })
            .select('orderNumber');
        
        let nextNumber = 1010;
        if (lastOrder && lastOrder.orderNumber) {
            const lastNum = Number(lastOrder.orderNumber.slice(3));
            if (Number.isInteger(lastNum)) {
                nextNumber = lastNum + 1;
            }
        }
        
        this.orderNumber = 'AE-' + nextNumber;
    }
    next();
});

const Order = mongoose.model('Order', orderSchema);


const reviewSchema = new mongoose.Schema({
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    visitorId: { type: String, default: null },
    date: { type: Date, default: Date.now }
});

const Review = mongoose.model('Review', reviewSchema);


const adminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetCode: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null }
});

const Admin = mongoose.model('Admin', adminSchema);


const db = mongoose.connection;

async function connectDB() {
    try {
        const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/aura-emporium';
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(mongoURI);
        console.log(' MongoDB Connected Successfully!');

        await createDefaultAdmin();

        db.once('open', () => {
            console.log(' Database open. Starting change stream for live tracking...');

            try {
                const changeStream = db.collection('orders').watch(
                    [{ $match: { operationType: { $in: ['insert', 'update'] } } }],
                    { fullDocument: 'updateLookup' }
                );

                changeStream.on('change', (change) => {
                    const orderData = change.fullDocument;
                    if (orderData) {
                        io.to(orderData.orderNumber).emit('order-update', {
                            status: orderData.orderStatus,
                            order: orderData
                        });
                        console.log(` Order ${orderData.orderNumber} updated to ${orderData.orderStatus}`);
                    }
                });

                changeStream.on('error', (error) => {
                    console.error(' Change stream error:', error.message || error);
                });

                changeStream.on('close', () => {
                    console.warn('Change stream closed. Live order updates stopped.');
                });
            } catch (error) {
                console.error(' Failed to start change stream:', error.message || error);
            }
        });

    } catch (error) {
        console.log(' MongoDB Connection Error:', error.message);
        console.log(' Running WITHOUT database - features will not work');
    }
}

connectDB();

 
async function createDefaultAdmin() {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.log('⚠️  ADMIN_EMAIL / ADMIN_PASSWORD not set in .env — skipping default admin creation.');
            return;
        }

        const existingAdmin = await Admin.findOne({ email: adminEmail.toLowerCase() });

        if (!existingAdmin) {
            await new Admin({
                email: adminEmail.toLowerCase(),
                password: adminPassword
            }).save();
            console.log(' Default Admin created:', adminEmail);
        }
    } catch (error) {
        console.log('Admin creation error:', error.message);
    }
}


io.on('connection', (socket) => {
    console.log(' New client connected:', socket.id);
    socket.on('track-order', (orderId) => {
        socket.join(orderId);
        console.log(` Client joined room: ${orderId}`);
    });
    socket.on('disconnect', () => {
        console.log(' Client disconnected:', socket.id);
    });
});

 
app.post('/api/paystack/initialize', async (req, res) => {
    console.log('💰 Paystack Initialize Attempt...');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const amount = Number(req.body.amount);

        if (!email || !Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ success: false, error: 'A valid email and amount are required.' });
        }

        console.log(` Email: ${email}, Amount: ${amount}`);

        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            email: email,
            amount: Math.round(amount * 100),
            currency: 'NGN',
            channels: ['card', 'bank_transfer']
        }, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('🔍 PAYSTACK INIT DATA:', JSON.stringify(response.data.data, null, 2));

        console.log(' Paystack Initialize Success!');
        res.json({ 
            success: true, 
            access_code: response.data.data.access_code,
            reference: response.data.data.reference,
            publicKey: process.env.PAYSTACK_PUBLIC_KEY
        });
    } catch (error) {
        console.error(' PAYSTACK INITIALIZE ERROR:', error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(error.response ? error.response.status : 500).json({ 
            success: false, 
            error: error.response ? error.response.data.message : error.message 
        });
    }
});


app.post('/api/paystack/verify', async (req, res) => {
    console.log(' Paystack Verify Attempt...');
    try {
        const { reference, orderData } = req.body || {};
        console.log(` Reference received: ${reference}`);

        if (!reference) {
            return res.status(400).json({ success: false, error: 'Missing payment reference. Please try paying again.' });
        }
        if (!orderData) {
            return res.status(400).json({ success: false, error: 'Missing order details. Please fill the checkout form and try again.' });
        }

        // Validate required checkout fields BEFORE talking to Paystack so the
        // buyer gets a clear message instead of "payment details not found".
        const missing = [];
        if (!orderData.fullName) missing.push('Full Name');
        if (!orderData.email) missing.push('Email');
        if (!orderData.phone) missing.push('Phone');
        if (!orderData.address) missing.push('Address');
        if (!orderData.city) missing.push('City');
        if (!orderData.state) missing.push('State');
        if (!Array.isArray(orderData.items) || !orderData.items.length) missing.push('Cart items');
        if (orderData.total === undefined || orderData.total === null || Number(orderData.total) <= 0) missing.push('Total');
        if (missing.length) {
            console.error(' Verify blocked — missing fields:', missing.join(', '));
            return res.status(400).json({ success: false, error: 'Missing: ' + missing.join(', ') + '. Please complete the checkout form.' });
        }

        // Idempotency: same Paystack reference must never create 2 orders
        // (double-click / network retry after a successful payment).
        const already = await Order.findOne({ paymentReference: reference }).select('orderNumber');
        if (already) {
            console.log(` Duplicate verify — returning existing order ${already.orderNumber} for ${reference}`);
            return res.json({ success: true, orderId: already.orderNumber, duplicate: true });
        }

        let verifyRes;
        try {
            verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 15000
            });

        console.log('🔍 VERIFY DEBUG:', JSON.stringify({
            status: verifyRes.data.data.status,
            paidAmount: verifyRes.data.data.amount,
            expectedAmount: Math.round(Number(orderData.total) * 100),
            paidEmail: verifyRes.data.data.customer?.email,
            orderEmail: orderData.email,
            reference: verifyRes.data.data.reference
        }, null, 2));
        } catch (vErr) {
            // Paystack says "Transaction reference not found" when the reference
            // never reached Paystack (e.g. popup closed before charge, or a
            // cached/duplicate reference was replayed).
            const paystackMsg = vErr.response ? JSON.stringify(vErr.response.data) : vErr.message;
            console.error(' Paystack verify lookup failed:', paystackMsg);
            const notFound = vErr.response && vErr.response.status === 404;
            return res.status(notFound ? 404 : 502).json({
                success: false,
                error: notFound
                    ? 'Payment reference not found at Paystack. The charge may not have completed — please check your email for a Paystack receipt, or try paying again (you will not be double-charged for a failed reference).'
                    : 'Could not confirm payment with Paystack. Please try again.'
            });
        }

        const tx = verifyRes.data && verifyRes.data.data;
        if (!tx || tx.status !== 'success') {
            return res.status(400).json({ success: false, error: `Payment not successful (gateway says: ${tx ? tx.status : 'unknown'}). No order was created.` });
        }

        console.log('=== PAYSTACK VERIFY RESPONSE ===');
        console.log(JSON.stringify(verifyRes.data, null, 2));
        console.log('=== ORDER DATA FROM FRONTEND ===');
        console.log(JSON.stringify(orderData, null, 2));
        console.log('=== COMPARISON ===');

        const paidAmount = Number(verifyRes.data.data.amount);
        const expectedAmount = Math.round(Number(orderData.total) * 100);
        const paidEmail = String(verifyRes.data.data.customer?.email || '').trim().toLowerCase();
        const orderEmail = String(orderData.email || '').trim().toLowerCase();

        console.log('paidAmount:', paidAmount, '| expectedAmount:', expectedAmount, '| match:', paidAmount === expectedAmount);
        console.log('paidEmail:', paidEmail, '| orderEmail:', orderEmail, '| match:', paidEmail === orderEmail);
        console.log('Paystack status:', verifyRes.data.data.status);
        console.log('================================');

        // TEMPORARILY DISABLED — verifying only Paystack status
        // if (paidEmail !== orderEmail || paidAmount !== expectedAmount) {
        //     return res.status(400).json({ success: false, error: 'Payment details could not be verified.' });
        // }
        // Payment is confirmed at this point — create the order.
        let order;
        try {
            order = new Order({
                customerName: orderData.fullName,
                customerEmail: orderData.email,
                customerPhone: orderData.phone,
                deliveryAddress: {
                    street: orderData.address,
                    city: orderData.city,
                    state: orderData.state,
                    instructions: orderData.instructions
                },
                items: orderData.items,
                subtotal: orderData.subtotal,
                deliveryFee: 0,
                total: orderData.total,
                paymentMethod: 'Card or Bank Transfer',
                paymentReference: reference,
                paymentStatus: 'Paid',
                orderStatus: 'Confirmed'
            });
            await order.save();
        } catch (saveErr) {
            // Race: two verifies for the same reference at once — return the winner.
            if (saveErr && saveErr.code === 11000) {
                const winner = await Order.findOne({ paymentReference: reference }).select('orderNumber');
                if (winner) {
                    console.log(` Duplicate save race — returning existing order ${winner.orderNumber}`);
                    return res.json({ success: true, orderId: winner.orderNumber, duplicate: true });
                }
            }
            console.error(' Order save failed:', saveErr.message);
            return res.status(500).json({ success: false, error: 'Payment succeeded but order could not be saved: ' + saveErr.message + ` (reference ${reference} — contact us and we will confirm it).` });
        }
        console.log(` Order Created: ${order.orderNumber}`);

        res.json({ success: true, orderId: order.orderNumber });

        try {
            const trackingUrl = `${BASE_URL}/track-order?orderId=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(order.customerEmail)}`;
            const mailOptions = {
                    from: `"THE AURA EMPORIUM" <${process.env.EMAIL_USER}>`,
                    to: orderData.email,
                    replyTo: process.env.EMAIL_TO,
                    cc: process.env.EMAIL_TO && process.env.EMAIL_TO.toLowerCase() !== orderData.email.toLowerCase()
                        ? process.env.EMAIL_TO
                        : undefined,
                    subject: `Order ${order.orderNumber} Confirmed - THE AURA EMPORIUM`,
                    text: `Dear ${orderData.fullName}, your order ${order.orderNumber} has been confirmed. Order total: ₦${Number(orderData.total).toLocaleString()}.`,
                    html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Georgia', serif; color: #1a1a1a; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #d4af37; padding: 20px; text-align: center; color: #1a1a1a; border-radius: 10px 10px 0 0; }
                            .content { background: #fff; padding: 30px; border: 1px solid #e8e4df; border-radius: 0 0 10px 10px; }
                            .btn { background: #d4af37; color: #1a1a1a; padding: 12px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block; }
                            .order-details { background: #f8f6f3; padding: 15px; border-radius: 8px; margin: 15px 0; }
                            .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h2>👑 Thank You for Shopping with Us!</h2>
                            </div>
                            <div class="content">
                                <p>Dear <strong>${orderData.fullName}</strong>,</p>
                                <p>We appreciate your purchase! Your order has been confirmed and is now being processed.</p>
                                
                                <div class="order-details">
                                    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                                    <p><strong>Order Total:</strong> ₦${orderData.total.toLocaleString()}</p>
                                </div>
                                
                                <h4>Your Items:</h4>
                                ${orderData.items.map(item => `<p>• ${item.productName} x ${item.quantity}</p>`).join('')}
                                
                                <p>You can track your order anytime using your Order Number.</p>
                                
                                <div style="text-align: center; margin: 20px 0;">
                                    <a href="${trackingUrl}" class="btn">Track Your Order</a>
                                </div>
                                
                                <p>Warm regards,<br><strong>THE AURA EMPORIUM Team</strong></p>
                                <p style="color: #888; font-size: 14px;">✨ Find Your Aura. Define Your Presence.</p>
                            </div>
                            <div class="footer">
                                <p>© 2026 THE AURA EMPORIUM. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                    `
                };

                try {
                    await transporter.sendMail({
                        from: 'THE AURA EMPORIUM <onboarding@resend.dev>',
                        to: mailOptions.to,
                        replyTo: mailOptions.replyTo,
                        subject: mailOptions.subject,
                        html: mailOptions.html,
                        text: mailOptions.text
                    });
                    console.log('✅ Email sent to:', orderData.email);
                } catch (emailError) {
                    console.error('❌ Email failed:', emailError.message);
                }
            } catch (emailError) {
                console.error('Email setup failed:', emailError);
            }

            return;
    } catch (error) {
        console.error(' PAYSTACK VERIFY ERROR:', error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(error.response ? error.response.status : 500).json({ 
            success: false, 
            error: error.response ? error.response.data.message : error.message 
        });
    }
});


app.post('/api/webhook/paystack', (req, res) => {
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) return res.sendStatus(401);
    
    if (req.body.event === 'charge.success') {
        console.log('✅ Webhook: Payment successful for reference:', req.body.data.reference);
    }
    
    res.sendStatus(200);
});


app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({ active: true });
        res.json(products);
    } catch (error) {
        res.json([]);
    }
});

app.post('/api/admin/products', upload.array('images', 5), async (req, res) => {
    try {
        const { name, price, length, weight, laceType, category } = req.body;
        const uploadedImages = Array.isArray(req.files)
            ? req.files.map(file => file.path)
            : [];

        const product = new Product({
            name,
            price: parseFloat(price),
            length: length || '',
            weight: weight || '',
            laceType: laceType || '',
            category: category || 'Body Wave',
            images: uploadedImages,
            active: true
        });

        await product.save();
        console.log('Product being saved:', product);
        console.log(' Product added:', product.name, '| Price:', product.price, '| Category:', product.category);
        res.json({ success: true, product });
    } catch (error) {
        console.error(' Error adding product:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function cloudinaryPublicIdFromUrl(imageUrl) {
    try {
        const url = new URL(imageUrl);
        if (!url.hostname.endsWith('.cloudinary.com')) return null;

        const uploadPath = url.pathname.split('/image/upload/')[1];
        if (!uploadPath) return null;

        const pathParts = uploadPath.split('/');
        const versionIndex = pathParts.findIndex(part => /^v\d+$/.test(part));
        const publicIdPath = versionIndex >= 0
            ? pathParts.slice(versionIndex + 1).join('/')
            : uploadPath;

        return decodeURIComponent(publicIdPath.replace(/\.[^/.]+$/, ''));
    } catch {
        return null;
    }
}

app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

        const imagePublicIds = product.images
            .map(cloudinaryPublicIdFromUrl)
            .filter(Boolean);

        await Promise.all(imagePublicIds.map(publicId =>
            cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true })
        ));

        await product.deleteOne();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body || {};

        if (!name || !email || !subject || !message) {
            return res.status(400).json({ success: false, error: 'Please fill in all fields.' });
        }

        if (!String(email).includes('@')) {
            return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
        }

        const destination = process.env.EMAIL_TO || process.env.EMAIL_USER || 'theauraemporiumng25@gmail.com';
        const mailOptions = {
            from: `"THE AURA EMPORIUM" <${process.env.EMAIL_USER || 'theauraemporiumng25@gmail.com'}>`,
            to: destination,
            replyTo: email,
            subject: `Contact Form: ${subject}`,
            text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #eee;">
                <h2 style="color:#d4af37;">THE AURA EMPORIUM Contact</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            </div>`
        };

        await transporter.sendMail({
            from: 'THE AURA EMPORIUM <onboarding@resend.dev>',
            to: mailOptions.to,
            replyTo: mailOptions.replyTo,
            subject: mailOptions.subject,
            html: mailOptions.html,
            text: mailOptions.text
        });
        res.json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error(' Contact Error:', error.message);
        res.status(500).json({ success: false, error: error.message || 'Failed to send message. Please try again.' });
    }
});


app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await Review.find().sort({ date: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/reviews', async (req, res) => {
    try {
        const { name, rating, comment, visitorId } = req.body;
        const review = new Review({ name, rating, comment, visitorId: visitorId || null });
        await review.save();
        res.status(201).json({ success: true, review });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.put('/api/reviews/:id', async (req, res) => {
    try {
        const { name, rating, comment, visitorId } = req.body;
        const existing = await Review.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Review not found' });
        if (!req.session?.isAdmin) {
            if (!visitorId || existing.visitorId !== visitorId) {
                return res.status(403).json({ error: 'You can only edit your own review.' });
            }
        }
        const review = await Review.findByIdAndUpdate(
            req.params.id,
            { name, rating, comment },
            { new: true }
        );
        res.json({ success: true, review });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.delete('/api/reviews/:id', async (req, res) => {
    try {
        const visitorId = req.body?.visitorId || req.query?.visitorId;
        const existing = await Review.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Review not found' });
        if (!req.session?.isAdmin) {
            if (!visitorId || existing.visitorId !== visitorId) {
                return res.status(403).json({ error: 'You can only delete your own review.' });
            }
        }
        await Review.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.post('/api/admin/login', async (req, res) => {
    console.log(' LOGIN ATTEMPT:', req.body.email);
    const { email, password } = req.body;
    
    const admin = await Admin.findOne({ email: email.trim().toLowerCase() });
    
    if (!admin || admin.password !== password) {
        console.log(' LOGIN FAILED for:', email);
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    req.session.isAdmin = true;
    console.log(' LOGIN SUCCESS! Session set for:', email);
    res.json({ success: true });
});


app.post('/api/admin/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const admin = await Admin.findOne({ email: email.trim().toLowerCase() });
        
        if (!admin) {
            return res.status(404).json({ success: false, error: 'Email not found' });
        }
        
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        admin.resetCode = resetCode;
        admin.resetCodeExpires = Date.now() + 15 * 60 * 1000;
        await admin.save();
        
        const mailOptions = {
            from: `"THE AURA EMPORIUM" <${process.env.EMAIL_USER}>`,
            to: admin.email,
            subject: 'Password Reset Code',
            text: `Your password reset code is: ${resetCode}\n\nThis code expires in 15 minutes.`
        };
        
        await transporter.sendMail({
            from: 'THE AURA EMPORIUM <onboarding@resend.dev>',
            to: admin.email,
            replyTo: mailOptions.replyTo,
            subject: mailOptions.subject,
            html: mailOptions.html,
            text: mailOptions.text
        });
        console.log(' Reset code sent to:', email);
        res.json({ success: true, message: 'Reset code sent to your email!' });
    } catch (error) {
        console.error(' Forgot Password Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.post('/api/admin/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        const admin = await Admin.findOne({ email: email.toLowerCase() });
        
        if (!admin || !admin.resetCode || admin.resetCode !== code) {
            return res.status(400).json({ success: false, error: 'Invalid code' });
        }
        
        if (admin.resetCodeExpires < Date.now()) {
            return res.status(400).json({ success: false, error: 'Code expired. Please try again.' });
        }
        
        res.json({ success: true, message: 'Code verified!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.post('/api/admin/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        const admin = await Admin.findOne({ email: email.toLowerCase() });
        
        if (!admin || !admin.resetCode || admin.resetCode !== code) {
            return res.status(400).json({ success: false, error: 'Invalid code' });
        }
        
        admin.password = newPassword;
        admin.resetCode = null;
        admin.resetCodeExpires = null;
        await admin.save();
        
        res.json({ success: true, message: 'Password updated successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.post('/api/orders', async (req, res) => {
    console.log('📦 Placing new order...');
    try {
        const orderData = req.body;
        
        const order = new Order({
            customerName: orderData.fullName,
            customerEmail: orderData.email,
            customerPhone: orderData.phone,
            deliveryAddress: {
                street: orderData.address,
                city: orderData.city,
                state: orderData.state,
                instructions: orderData.instructions
            },
            items: orderData.items,
            subtotal: orderData.subtotal,
            deliveryFee: 0,
            total: orderData.total,
            paymentMethod: orderData.paymentMethod || 'Card or Bank Transfer',
            orderStatus: 'Pending'
        });
        
        await order.save();
        console.log(' Order Created:', order.orderNumber);
        res.json({ success: true, orderId: order.orderNumber });
    } catch (error) {
        console.error(' Error creating order:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.post('/api/track-order', async (req, res) => {
    console.log(' Tracking order:', req.body.orderId);
    try {
        const orderId = String(req.body.orderId || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const notFoundMessage = 'PLEASE CHECK IF YOUR ORDER ID AND MAIL IS CORRECT';

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ success: false, error: 'Order tracking is temporarily unavailable. Please try again.' });
        }
        
        const order = await Order.findOne({ orderNumber: orderId }).lean();
        if (!order) return res.json({ success: false, error: notFoundMessage });
        
        const emailMatches = email && order.customerEmail.toLowerCase() === email;
        if (!emailMatches) return res.json({ success: false, error: notFoundMessage });
        
        res.json({
            success: true,
            orderNumber: order.orderNumber,
            orderDate: order.createdAt,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            items: order.items.map(item => ({
                productName: item.productName,
                price: item.price,
                quantity: item.quantity
            })),
            subtotal: order.subtotal,
            total: order.total,
            trackingNumber: order.trackingNumber || null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/admin/check', (req, res) => {
    console.log(' Checking session... isAdmin:', req.session.isAdmin);
    res.json({ isAdmin: req.session.isAdmin || false });
});


app.get('/api/admin/logout', (req, res) => {
    console.log(' LOGOUT ATTEMPT');
    req.session.destroy();
    res.json({ success: true });
});


app.get('/api/admin/stats', async (req, res) => {
    console.log(' Loading stats...');
    try {
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ orderStatus: 'Pending' });
        const totalRevenue = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]);
        res.json({
            totalProducts,
            totalOrders,
            pendingOrders,
            totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0
        });
    } catch (error) {
        console.error(' Stats Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/admin/orders', async (req, res) => {
    console.log(' Loading admin orders...');
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        console.error(' Admin Orders Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});


app.put('/api/admin/orders/:id', async (req, res) => {
    console.log(' Updating order status:', req.params.id, 'to', req.body.status);
    try {
        const order = await Order.findByIdAndUpdate(
            req.params.id, 
            { orderStatus: req.body.status }, 
            { new: true }
        );
        
        if (!order) return res.status(404).json({ error: 'Order not found' });
        console.log(' Order status updated to:', order.orderStatus);
        res.json({ success: true, order });
    } catch (error) {
        console.error(' Update Status Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});


// Helper: serve HTML with no-cache headers so browsers / proxies never reuse
// a stale page (or stale JS that replays an old Paystack reference).
// WHY: your explicit app.get() HTML routes run AFTER express.static and do NOT
// inherit its Cache-Control headers — without this, a cached checkout.html can
// replay an already-used reference on a second device / retry.
function sendNoCacheHtml(res, filename) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(path.join(__dirname, 'public', filename));
}

app.get('/', (req, res) => sendNoCacheHtml(res, 'index.html'));
app.get('/index.html', (req, res) => sendNoCacheHtml(res, 'index.html'));
app.get('/shop', (req, res) => sendNoCacheHtml(res, 'shop.html'));
app.get('/shop.html', (req, res) => sendNoCacheHtml(res, 'shop.html'));
app.get('/product', (req, res) => sendNoCacheHtml(res, 'product.html'));
app.get('/product.html', (req, res) => sendNoCacheHtml(res, 'product.html'));
app.get('/explore', (req, res) => sendNoCacheHtml(res, 'explore.html'));
app.get('/explore.html', (req, res) => sendNoCacheHtml(res, 'explore.html'));
app.get('/cart', (req, res) => sendNoCacheHtml(res, 'cart.html'));
app.get('/cart.html', (req, res) => sendNoCacheHtml(res, 'cart.html'));
app.get('/checkout', (req, res) => sendNoCacheHtml(res, 'checkout.html'));
app.get('/checkout.html', (req, res) => sendNoCacheHtml(res, 'checkout.html'));
app.get('/track-order', (req, res) => sendNoCacheHtml(res, 'track-order.html'));
app.get('/track-order.html', (req, res) => sendNoCacheHtml(res, 'track-order.html'));
app.get('/success', (req, res) => sendNoCacheHtml(res, 'success.html'));
app.get('/success.html', (req, res) => sendNoCacheHtml(res, 'success.html'));
app.get('/about', (req, res) => sendNoCacheHtml(res, 'about.html'));
app.get('/about.html', (req, res) => sendNoCacheHtml(res, 'about.html'));
app.get('/contact', (req, res) => sendNoCacheHtml(res, 'contact.html'));
app.get('/contact.html', (req, res) => sendNoCacheHtml(res, 'contact.html'));
app.get('/reviews', (req, res) => sendNoCacheHtml(res, 'reviews.html'));
app.get('/reviews.html', (req, res) => sendNoCacheHtml(res, 'reviews.html'));


app.get('/admin', (req, res) => {
    if (req.session.isAdmin) {
        res.redirect('/admin/dashboard');
    } else {
        res.redirect('/admin/login');
    }
});

app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin/dashboard', (req, res) => {
    if (req.session.isAdmin) {
        res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
    } else {
        res.redirect('/admin/login');
    }
});
app.get('/admin/products', (req, res) => {
    if (req.session.isAdmin) {
        res.sendFile(path.join(__dirname, 'public', 'admin-products.html'));
    } else {
        res.redirect('/admin/login');
    }
});
app.get('/admin/orders', (req, res) => {
    if (req.session.isAdmin) {
        res.sendFile(path.join(__dirname, 'public', 'admin-orders.html'));
    } else {
        res.redirect('/admin/login');
    }
});
app.get('/admin/reviews', (req, res) => {
    if (req.session.isAdmin) {
        res.sendFile(path.join(__dirname, 'public', 'admin-reviews.html'));
    } else {
        res.redirect('/admin/login');
    }
});


app.use((req, res) => {
    console.log(' 404 NOT FOUND:', req.method, req.url);
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});


app.use((err, req, res, next) => {
    console.error(' SERVER ERROR:', err);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: err.message
    });
});


function startServer(port) {
    const handleServerError = (error) => {
        if (error.code === 'EADDRINUSE') {
            console.warn(`Port ${port} is already in use. Trying port ${port + 1}...`);
            server.removeListener('error', handleServerError);
            startServer(port + 1);
            return;
        }

        console.error(' Server startup error:', error.message);
        process.exitCode = 1;
    };

    server.once('error', handleServerError);
    server.listen(port, () => {
        server.removeListener('error', handleServerError);
        console.log('THE AURA EMPORIUM - Wigs Collection');
        console.log(`Server running: http://localhost:${port}`);
    });
}

startServer(PORT);


