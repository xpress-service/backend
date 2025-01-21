const jwt = require('jsonwebtoken');

function generateToken(user) {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
  };

  const options = {
    expiresIn: '1h', // Token expires in 1 hour
  };

  return jwt.sign(payload, process.env.JWT_SECRET, options);
}

module.exports = generateToken;
