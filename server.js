const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Configure Email Transporter dynamically (defaulting to secure port 465 for Render compatibility)
const mailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE !== 'false', // Defaults to true (port 465 secure SSL)
  auth: {
    user: process.env.EMAIL_USER,       // SMTP username / Gmail Address
    pass: process.env.EMAIL_PASSWORD   // SMTP password / Gmail App Password
  },
  tls: {
    rejectUnauthorized: false // Prevents certificate validation failures on cloud instances
  }
});

// Verify Email Transporter configuration on startup
mailTransporter.verify(function (error, success) {
  if (error) {
    console.error("SMTP Mail Transporter verification failed on startup:", error.message);
    console.error("If you are using Gmail and it fails, consider using Brevo (Sendinblue) or SendGrid which do not block cloud server IPs.");
  } else {
    console.log("SMTP Mail Transporter is ready to send emails!");
  }
});

// Universal email sending helper supporting Resend API, Brevo API, and NodeMailer SMTP fallback
async function sendEmail(toEmail, subject, html) {
  // Option 1: Resend HTTP API (Modern, highly reliable web service, no SMTP blocks)
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Sri Ilayaperumal Temple <onboarding@resend.dev>',
          to: toEmail,
          subject: subject,
          html: html
        })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        console.log(`Email sent successfully via Resend API to: ${toEmail}`);
        return true;
      } else {
        console.error('Resend API email send failure:', data);
      }
    } catch (err) {
      console.error('Failed to send email via Resend API:', err.message);
    }
  }

  // Option 2: Brevo HTTP API
  if (process.env.BREVO_API_KEY) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Sri Ilayaperumal Temple', email: process.env.EMAIL_USER || 'info@molasikannangulatrust.org' },
          to: [{ email: toEmail }],
          subject: subject,
          htmlContent: html
        })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        console.log(`Email sent successfully via Brevo API to: ${toEmail}`);
        return true;
      } else {
        console.error('Brevo API email send failure:', data);
      }
    } catch (err) {
      console.error('Failed to send email via Brevo API:', err.message);
    }
  }

  // Option 3: Fallback to NodeMailer SMTP (Port 465 SSL)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('Skipping SMTP send fallback: EMAIL_USER or EMAIL_PASSWORD not defined.');
    return false;
  }

  const mailOptions = {
    from: `"Sri Ilayaperumal Temple" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: html
  };

  try {
    await mailTransporter.sendMail(mailOptions);
    console.log(`Email sent successfully via SMTP to: ${toEmail}`);
    return true;
  } catch (err) {
    console.error('SMTP fallback email send error:', err.message);
    return false;
  }
}

// Helper function to send approval confirmation email
async function sendApprovalEmail(toEmail, submissionId, data) {
  if (!toEmail) return;

  const subject = 'ஸ்ரீ இளையபெருமாள் திருக்கோயில் - விண்ணப்பம் ஒப்புதல் அளிக்கப்பட்டது / Application Approved';
  const html = `
      <div style="font-family: 'Lato', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); background-color: #ffffff;">
        <div style="background-color: #15803d; padding: 20px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 1.5rem;">ஸ்ரீ இளையபெருமாள் திருக்கோயில்</h2>
          <p style="margin: 5px 0 0 0; font-size: 0.9rem; letter-spacing: 0.5px; opacity: 0.9;">விண்ணப்பம் அங்கீகரிக்கப்பட்டது / Application Approved</p>
        </div>
        
        <div style="padding: 30px; color: #374151; line-height: 1.6;">
          <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px;">அன்பார்ந்த ${data.headName || 'பக்தர்'} / Dear Devotee,</p>
          
          <p style="margin-bottom: 15px; text-align: justify;">
            நமது ஸ்ரீ இளையபெருமாள் திருக்கோயில் குடும்ப விவரப் பதிவேட்டில் தங்களது விண்ணப்பம் நிர்வாகியால் சரிபார்க்கப்பட்டு <strong>அங்கீகரிக்கப்பட்டுள்ளது (Approved)</strong> என்பதை மகிழ்ச்சியுடன் தெரிவித்துக் கொள்கிறோம்.
          </p>
          <p style="margin-bottom: 20px; text-align: justify;">
            We are pleased to inform you that your family registration application has been verified and **Approved** by the administrator.
          </p>
          
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px; margin-bottom: 25px; text-align: center;">
            <p style="margin: 0 0 5px 0; font-size: 0.95rem; color: #15803d; font-weight: 600;">உங்களின் குறிப்பு எண் / Your Reference ID:</p>
            <h3 style="margin: 0; font-size: 1.8rem; color: #15803d; letter-spacing: 1px;">${submissionId}</h3>
          </div>
          
          <p style="margin-bottom: 10px; font-weight: 500;">இவண் / Regards,</p>
          <p style="margin: 0; font-weight: 600; color: #991b1b;">மொளசி கண்ணங்குல கொங்குநாட்டு வேளாளர் அறக்கட்டளை</p>
          <p style="margin: 0; font-size: 0.9rem; color: #6b7280;">ஸ்ரீ இளையபெருமாள் திருக்கோயில்</p>
        </div>
        
        <div style="background-color: #f9fafb; border-top: 1px solid #f3f4f6; padding: 15px; text-align: center; font-size: 0.8rem; color: #9ca3af;">
          இந்த மின்னஞ்சல் தானியங்கி முறையில் அனுப்பப்பட்டது, தயவுசெய்து இதற்கு பதிலளிக்க வேண்டாம்.<br>
          This is an automated confirmation email. Please do not reply to this message.
        </div>
      </div>
    `
  `;

  await sendEmail(toEmail, subject, html);
}

// Helper function to send decline notification email
async function sendDeclineEmail(toEmail, data) {
  if (!toEmail) return;

  const subject = 'ஸ்ரீ இளையபெருமாள் திருக்கோயில் - விண்ணப்பம் நிராகரிக்கப்பட்டது / Application Declined';
  const html = `
      <div style="font-family: 'Lato', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); background-color: #ffffff;">
        <div style="background-color: #b91c1c; padding: 20px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 1.5rem;">ஸ்ரீ இளையபெருமாள் திருக்கோயில்</h2>
          <p style="margin: 5px 0 0 0; font-size: 0.9rem; letter-spacing: 0.5px; opacity: 0.9;">விண்ணப்பம் நிராகரிக்கப்பட்டது / Application Declined</p>
        </div>
        
        <div style="padding: 30px; color: #374151; line-height: 1.6;">
          <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px;">அன்பார்ந்த ${data.headName || 'பக்தர்'} / Dear Devotee,</p>
          
          <p style="margin-bottom: 15px; text-align: justify;">
            நமது ஸ்ரீ இளையபெருமாள் திருக்கோயில் குடும்ப விவரப் பதிவேட்டில் தங்களது விண்ணப்பம் சில காரணங்களால் <strong>நிராகரிக்கப்பட்டுள்ளது (Declined)</strong> என்பதைத் தெரிவித்துக் கொள்கிறோம்.
          </p>
          <p style="margin-bottom: 20px; text-align: justify;">
            We regret to inform you that your family registration application has been **Declined** by the administrator.
          </p>
          
          <p style="margin-bottom: 10px; font-weight: 500;">இவண் / Regards,</p>
          <p style="margin: 0; font-weight: 600; color: #991b1b;">மொளசி கண்ணங்குல கொங்குநாட்டு வேளாளர் அறக்கட்டளை</p>
          <p style="margin: 0; font-size: 0.9rem; color: #6b7280;">ஸ்ரீ இளையபெருமாள் திருக்கோயில்</p>
        </div>
        
        <div style="background-color: #f9fafb; border-top: 1px solid #f3f4f6; padding: 15px; text-align: center; font-size: 0.8rem; color: #9ca3af;">
          இந்த மின்னஞ்சல் தானியங்கி முறையில் அனுப்பப்பட்டது, தயவுசெய்து இதற்கு பதிலளிக்க வேண்டாம்.<br>
          This is an automated confirmation email. Please do not reply to this message.
        </div>
      </div>
    `
  `;

  await sendEmail(toEmail, subject, html);
}

// Helper function to send registration confirmation email
async function sendRegistrationEmail(toEmail, submissionId, data) {
  if (!toEmail) return;

  const subject = 'ஸ்ரீ இளையபெருமாள் திருக்கோயில் - விண்ணப்பம் பெறப்பட்டது / Application Received';
  const html = `
      <div style="font-family: 'Lato', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); background-color: #ffffff;">
        <div style="background-color: #0369a1; padding: 20px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 1.5rem;">ஸ்ரீ இளையபெருமாள் திருக்கோயில்</h2>
          <p style="margin: 5px 0 0 0; font-size: 0.9rem; letter-spacing: 0.5px; opacity: 0.9;">விண்ணப்பம் பெறப்பட்டது / Application Received</p>
        </div>
        
        <div style="padding: 30px; color: #374151; line-height: 1.6;">
          <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px;">அன்பார்ந்த ${data.headName || 'பக்தர்'} / Dear Devotee,</p>
          
          <p style="margin-bottom: 15px; text-align: justify;">
            நமது ஸ்ரீ இளையபெருமாள் திருக்கோயில் குடும்ப விவரப் பதிவேட்டிற்கான தங்களது விண்ணப்பம் வெற்றிகரமாக பெறப்பட்டது (Received).
          </p>
          <p style="margin-bottom: 20px; text-align: justify;">
            We have successfully received your family registration application. It is currently pending verification.
          </p>
          
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 15px; margin-bottom: 25px; text-align: center;">
            <p style="margin: 0 0 5px 0; font-size: 0.95rem; color: #0369a1; font-weight: 600;">உங்களின் குறிப்பு எண் / Your Reference ID:</p>
            <h3 style="margin: 0; font-size: 1.8rem; color: #0369a1; letter-spacing: 1px;">${submissionId}</h3>
          </div>
          
          <p style="margin-bottom: 10px; font-weight: 500;">இவண் / Regards,</p>
          <p style="margin: 0; font-weight: 600; color: #991b1b;">மொளசி கண்ணங்குல கொங்குநாட்டு வேளாளர் அறக்கட்டளை</p>
          <p style="margin: 0; font-size: 0.9rem; color: #6b7280;">ஸ்ரீ இளையபெருமாள் திருக்கோயில்</p>
        </div>
        
        <div style="background-color: #f9fafb; border-top: 1px solid #f3f4f6; padding: 15px; text-align: center; font-size: 0.8rem; color: #9ca3af;">
          இந்த மின்னஞ்சல் தானியங்கி முறையில் அனுப்பப்பட்டது, தயவுசெய்து இதற்கு பதிலளிக்க வேண்டாம்.<br>
          This is an automated confirmation email. Please do not reply to this message.
        </div>
      </div>
    `
  `;

  await sendEmail(toEmail, subject, html);
}

const mongoose = require('mongoose');
let Submission;
try {
  Submission = require('./models/Submission');
} catch (err) {
  Submission = require('./Submission'); // Fallback for flattened GitHub upload
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (uri && uri.includes('127.0.0.1')) {
    try {
      console.log('Attempting to use in-memory MongoDB because local DB was specified...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const memUri = mongoServer.getUri();
      await mongoose.connect(memUri);
      console.log('Connected to In-Memory MongoDB successfully!');
    } catch (err) {
      console.error('In-Memory DB connection error:', err.message);
    }
  } else {
    mongoose.connect(uri)
      .then(() => console.log('Connected to MongoDB'))
      .catch(err => console.error('MongoDB connection error:', err));
  }
}
connectDB();

const app = express();
app.set('trust proxy', 1); // Fix for express-rate-limit behind a proxy (localtunnel)
const PORT = process.env.PORT || 3001;

// Setup directories
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}
ensureDataFile();

// Load dynamic fields config
function loadFieldsConfig() {
  try {
    let fieldsPath = path.join(__dirname, 'config', 'fields.json');
    if (!fs.existsSync(fieldsPath)) {
      fieldsPath = path.join(__dirname, 'fields.json'); // Fallback for flattened GitHub upload
    }
    const raw = fs.readFileSync(fieldsPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading fields configuration:', err.message);
    return [];
  }
}

// Prepare Admin Password Hash
let adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
if (!adminPasswordHash) {
  console.warn('WARNING(security): ADMIN_PASSWORD_HASH is not defined in .env. Generating ephemeral credential.');
  const tempPassword = crypto.randomBytes(12).toString('hex');
  const salt = crypto.randomBytes(16).toString('hex');
  adminPasswordHash = `${salt}:${crypto.scryptSync(tempPassword, salt, 64).toString('hex')}`;
  console.warn(`\n==================================================`);
  console.warn(`EPHEMERAL ADMIN PASSWORD CREATED: ${tempPassword}`);
  console.warn(`Please use this password to log in during testing.`);
  console.warn(`==================================================\n`);
} else if (!adminPasswordHash.includes(':')) {
  // Fallback if plain text password is supplied in .env
  const salt = crypto.randomBytes(16).toString('hex');
  const computedHash = crypto.scryptSync(adminPasswordHash, salt, 64).toString('hex');
  const formattedHash = `${salt}:${computedHash}`;
  console.warn(`\n==================================================`);
  console.warn(`WARNING(security): Plaintext ADMIN_PASSWORD_HASH detected in .env.`);
  console.warn(`We have compiled it to a secure scrypt hash for you.`);
  console.warn(`Please update your .env file with the following line to secure it:`);
  console.warn(`ADMIN_PASSWORD_HASH=${formattedHash}`);
  console.warn(`==================================================\n`);
  adminPasswordHash = formattedHash;
}

// Verification function using scrypt (Async to prevent Event Loop blocking)
function verifyPassword(password, storedHash) {
  return new Promise((resolve) => {
    try {
      const [salt, hash] = storedHash.split(':');
      if (!salt || !hash) return resolve(false);
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) {
          console.error('Password verification error:', err.message);
          return resolve(false);
        }
        try {
          const match = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey);
          resolve(match);
        } catch (e) {
          console.error('Timing safe equal error:', e.message);
          resolve(false);
        }
      });
    } catch (err) {
      console.error('Password verification error:', err.message);
      resolve(false);
    }
  });
}

// Express Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session Middleware
const sessionSecret = process.env.SESSION_SECRET || 'Sri_Ilayaperumal_Temple_Stable_Secret_Key_2026_Secure';
if (!process.env.SESSION_SECRET) {
  console.warn('WARNING(security): SESSION_SECRET is not configured in .env. Using stable default fallback.');
}

// Trust proxy when running on Render/cloud so secure HTTPS cookies work properly across origin
app.set('trust proxy', 1);

app.use(
  session({
    name: 'kovil_session',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: true, // Required for SameSite=None across Netlify/Render domains
      sameSite: 'none',
      maxAge: 15 * 60 * 1000, // 15 Minutes inactivity timeout
    },
  })
);

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const submissionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 submissions per minute
  message: { error: 'Too many submissions. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 login attempts per 5 minutes
  message: { error: 'Too many login attempts. Please try again after 5 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Enable Global CORS for Netlify Frontend
const cors = require('cors');
app.use(cors({
  origin: true,
  credentials: true
}));

// Security & Cache Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  next();
});

app.use('/api/', globalLimiter);

// CSRF Protection Middleware with HMAC fallback for cross-domain browsers blocking SameSite=None cookies
function signCsrfToken(rawToken) {
  const hmac = crypto.createHmac('sha256', sessionSecret).update(rawToken).digest('hex');
  return `${rawToken}.${hmac}`;
}

function verifySignedCsrfToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [rawToken, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', sessionSecret).update(rawToken).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (err) {
    return false;
  }
}

function getOrGenerateCsrfToken(req) {
  if (!req.session.csrfToken || !verifySignedCsrfToken(req.session.csrfToken)) {
    const raw = crypto.randomBytes(24).toString('hex');
    req.session.csrfToken = signCsrfToken(raw);
  }
  return req.session.csrfToken;
}

function validateCsrfToken(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  if (req.path === '/api/trigger-email') {
    return next();
  }
  const clientToken = req.headers['x-csrf-token'];
  const sessionToken = req.session ? req.session.csrfToken : null;

  // Hybrid validation: check exact session match OR verify cryptographically signed token
  if (sessionToken && clientToken === sessionToken) {
    return next();
  }
  if (verifySignedCsrfToken(clientToken)) {
    return next();
  }
  return res.status(403).json({ error: 'CSRF token validation failed. Access denied.' });
}

app.use(validateCsrfToken);

// Authentication Guards
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Admin access required.' });
}

// Queue for serializing JSON file writes (retained for ID sequence logic)
let writeQueue = Promise.resolve();
function writeSubmission(data) {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const villageMatch = data.village ? data.village.match(/^(\d+)/) : null;
        let villagePrefix = "99";
        if (villageMatch) {
          villagePrefix = villageMatch[1];
        }
        
        const count = await Submission.countDocuments({ village: data.village });
        const serialNum = count + 1;
        const paddedSerial = serialNum.toString().padStart(4, '0');
        const id = `${villagePrefix}-${paddedSerial}`;
        const newSubmission = new Submission({
          id,
          timestamp: new Date().toISOString(),
          ...data,
        });
        await newSubmission.save();
        resolve(id);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Prevent CSV Injection (Formula injection)
function sanitizeForCsv(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Prepend single quote if field starts with dangerous characters: =, +, -, @, tab, carriage return
  if (/^[=\+\-\@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// Serve Static Frontend
app.use(express.static(path.join(__dirname, 'public')));

// APIs

// Get Fields Configurations
app.get('/api/fields', (req, res) => {
  const token = getOrGenerateCsrfToken(req);
  const fields = loadFieldsConfig();
  
  let incharges = {};
  try {
    let inchargesPath = path.join(__dirname, 'config', 'incharges.json');
    if (!fs.existsSync(inchargesPath)) {
      inchargesPath = path.join(__dirname, 'incharges.json'); // Fallback for flattened GitHub upload
    }
    if (fs.existsSync(inchargesPath)) {
      incharges = JSON.parse(fs.readFileSync(inchargesPath, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading incharges mapping:', err.message);
  }
  
  res.json({ fields, incharges, csrfToken: token });
});

// Trigger Email Endpoint (called by Netlify frontend after saving to Firebase)
app.post('/api/trigger-email', cors(), async (req, res) => {
  const { email, id, name, village } = req.body;
  if (!email || !id) {
    return res.status(400).json({ error: 'Missing email or id' });
  }
  
  // We mock a submission object because sendRegistrationEmail expects one
  const submissionData = {
    id: id,
    name: name || 'Applicant',
    village: village || 'Unknown'
  };
  
  await sendRegistrationEmail(email, id, submissionData);
  res.json({ success: true, message: 'Email queued successfully.' });
});

// Submit User Details (Original Route)
app.post('/api/submit', submissionLimiter, async (req, res) => {
  try {
    const fields = loadFieldsConfig();
    const errors = [];
    const sanitizedData = {};

    for (const field of fields) {
      const val = req.body[field.id];

      // Check if required
      if (field.required && (val === undefined || val === null || String(val).trim() === '')) {
        errors.push(`${field.label} is required.`);
        continue;
      }

      if (val !== undefined && val !== null) {
        const valStr = String(val).trim();
        if (valStr !== '') {
          // Verify format pattern
          if (field.pattern) {
            const regex = new RegExp(field.pattern);
            if (!regex.test(valStr)) {
              errors.push(field.errorMessage || `${field.label} format is invalid.`);
              continue;
            }
          }
          sanitizedData[field.id] = valStr;
        } else {
          sanitizedData[field.id] = '';
        }
      } else {
        sanitizedData[field.id] = '';
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Check for duplicate mobile number
    if (sanitizedData.phone) {
      const existingRecord = await Submission.findOne({ phone: sanitizedData.phone });
      if (existingRecord) {
        return res.status(400).json({ errors: ['This mobile number is already registered. (இந்த கைபேசி எண் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது)'] });
      }
    }

    writeSubmission(sanitizedData)
      .then((savedId) => {
        // Send registration confirmation email asynchronously (if email was provided)
        if (sanitizedData.email) {
          sendRegistrationEmail(sanitizedData.email, savedId, sanitizedData);
        }
        res.json({ message: 'Submission successful! Thank you.', submissionId: savedId });
      })
      .catch((err) => {
        console.error('Database write error:', err.message);
        res.status(500).json({ error: 'An internal error occurred while saving your data.' });
      });
  } catch (err) {
    console.error('Submission request processing error:', err.message);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
});

// Admin Authentication check
app.get('/api/admin/status', (req, res) => {
  const token = getOrGenerateCsrfToken(req);
  if (req.session && req.session.isAdmin === true) {
    return res.json({ isAdmin: true, csrfToken: token });
  }
  res.json({ isAdmin: false, csrfToken: token });
});

// Admin Login
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const isValid = await verifyPassword(password, adminPasswordHash);
  if (isValid) {
    req.session.isAdmin = true;
    const token = getOrGenerateCsrfToken(req); // Regenerate/refresh token on login for session fixation protection
    res.json({ message: 'Login successful.', csrfToken: token });
  } else {
    res.status(401).json({ error: 'Invalid password.' });
  }
});

// Admin Change Password
app.post('/api/admin/change-password', loginLimiter, requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  const isValid = await verifyPassword(currentPassword, adminPasswordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid current password.' });
  }

  try {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(newPassword, salt, 64, (err, derivedKey) => {
      if (err) {
        console.error('Password hashing error:', err.message);
        return res.status(500).json({ error: 'Failed to update password.' });
      }
      const newHash = derivedKey.toString('hex');
      const formattedHash = `${salt}:${newHash}`;

      adminPasswordHash = formattedHash;

      const envPath = path.join(__dirname, '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf-8');
        if (envContent.includes('ADMIN_PASSWORD_HASH=')) {
          envContent = envContent.replace(/ADMIN_PASSWORD_HASH=.*/g, `ADMIN_PASSWORD_HASH=${formattedHash}`);
        } else {
          envContent += `\nADMIN_PASSWORD_HASH=${formattedHash}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf-8');
      }

      res.json({ message: 'Password changed successfully.' });
    });
  } catch (err) {
    console.error('Password change error:', err.message);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// Get Submissions (Protected Admin route with filtering)
app.get('/api/admin/data', requireAdmin, async (req, res) => {
  try {
    let query = {};
    const fields = loadFieldsConfig();

    // Apply filtering query params
    Object.keys(req.query).forEach((key) => {
      const queryVal = String(req.query[key]).trim();
      if (key === 'status' && queryVal) {
        query.status = queryVal;
      } else if (queryVal && (key === 'id' || key === 'timestamp' || fields.some((f) => f.id === key))) {
        // Case-insensitive regex match, escaping special characters
        const escapedQuery = queryVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query[key] = { $regex: escapedQuery, $options: 'i' };
      }
    });

    const submissions = await Submission.find(query).lean();
    // Remove Mongoose specific fields
    const filtered = submissions.map(sub => {
      const { _id, __v, ...rest } = sub;
      return rest;
    });

    res.json({ submissions: filtered });
  } catch (err) {
    console.error('Read submissions error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve data.' });
  }
});

// Approve Submission (Protected Admin route)
app.post('/api/admin/approve', requireAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid ID is required.' });
  }

  try {
    const sub = await Submission.findOneAndUpdate(
      { id: id, status: 'pending' },
      { status: 'approved' },
      { new: true }
    );
    if (!sub) {
      return res.status(404).json({ error: 'Pending record not found.' });
    }
    
    // Send approval email asynchronously (if email was provided)
    if (sub.email) {
      sendApprovalEmail(sub.email, sub.id, sub);
    }
    
    res.json({ message: 'Record approved successfully.' });
  } catch (err) {
    console.error('Approve record error:', err.message);
    res.status(500).json({ error: 'Failed to approve record.' });
  }
});

// Decline Submission (Protected Admin route)
app.post('/api/admin/decline', requireAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid ID is required.' });
  }

  try {
    const sub = await Submission.findOneAndUpdate(
      { id: id, status: 'pending' },
      { status: 'declined' },
      { new: true }
    );
    if (!sub) {
      return res.status(404).json({ error: 'Pending record not found.' });
    }
    
    // Send decline email asynchronously (if email was provided)
    if (sub.email) {
      sendDeclineEmail(sub.email, sub);
    }
    
    res.json({ message: 'Record declined successfully.' });
  } catch (err) {
    console.error('Decline record error:', err.message);
    res.status(500).json({ error: 'Failed to decline record.' });
  }
});

// Delete Submission (Protected Admin route)
app.post('/api/admin/delete', requireAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid ID is required.' });
  }

  try {
    const result = await Submission.deleteOne({ id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }
    res.json({ message: 'Record deleted successfully.' });
  } catch (err) {
    console.error('Delete record error:', err.message);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

// Export Submissions as CSV (Protected Admin route)
app.get('/api/admin/download', requireAdmin, async (req, res) => {
  try {
    let query = {};
    const fields = loadFieldsConfig();

    // Apply filtering query params to CSV export
    Object.keys(req.query).forEach((key) => {
      const queryVal = String(req.query[key]).trim();
      if (key === 'status' && queryVal) {
        query.status = queryVal;
      } else if (queryVal && (key === 'id' || key === 'timestamp' || fields.some((f) => f.id === key))) {
        const escapedQuery = queryVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query[key] = { $regex: escapedQuery, $options: 'i' };
      }
    });

    // Default to approved if no status query param is provided
    if (!query.status) {
      query.status = 'approved';
    }

    const submissions = await Submission.find(query).lean();

    // Prepare CSV headers
    const headers = ['Submission ID', 'Timestamp', ...fields.map((f) => f.label)];
    const csvRows = [];
    csvRows.push(headers.map(sanitizeForCsv).join(','));

    // Prepare CSV rows
    for (const sub of submissions) {
      const row = [
        sub.id,
        sub.timestamp,
        ...fields.map((f) => {
          const val = sub[f.id] || '';
          if (f.id === 'familyMembers' && val && typeof val === 'string' && val.startsWith('[')) {
            try {
              const members = JSON.parse(val);
              return members.map((m, idx) => 
                `${idx + 1}. ${m.name} (${m.relationship}, DOB: ${m.dob || '-'}, Age: ${m.age}, Marital: ${m.maritalStatus || 'ஆம்'}, Edu: ${m.education}, Job: ${m.job} at ${m.jobLocation})`
              ).join('; ');
            } catch (e) {}
          }
          return val;
        })
      ];
      csvRows.push(row.map(sanitizeForCsv).join(','));
    }

    const csvContent = '\uFEFF' + csvRows.join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=submissions_export.csv');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csvContent);
  } catch (err) {
    console.error('CSV export error:', err.message);
    res.status(500).send('Failed to generate export file.');
  }
});

// Admin Logout
app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout session destruction error:', err.message);
      return res.status(500).json({ error: 'Failed to log out cleanly.' });
    }
    res.clearCookie('kovil_session');
    res.json({ message: 'Logout successful.' });
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
