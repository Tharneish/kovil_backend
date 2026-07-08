const crypto = require('crypto');

// Get password from command line argument
const password = process.argv[2];

if (!password) {
  console.log('Error: Please provide a password to hash.');
  console.log('Usage: node hash_password.js <your_password>');
  process.exit(1);
}

// Generate a random salt (16 bytes)
const salt = crypto.randomBytes(16).toString('hex');

// Hash the password using scrypt
const hash = crypto.scryptSync(password, salt, 64).toString('hex');

// Output the formatted string for the .env file
console.log('\n==================================================');
console.log('Generated Admin Password Hash for .env:');
console.log('==================================================');
console.log(`ADMIN_PASSWORD_HASH=${salt}:${hash}`);
console.log('==================================================\n');
