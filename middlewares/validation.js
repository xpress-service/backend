// Password validation middleware
const validatePassword = (req, res, next) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ 
      error: 'Password is required',
      field: 'password'
    });
  }
  
  // Check minimum length
  if (password.length < 8) {
    return res.status(400).json({ 
      error: 'Password must be at least 8 characters long',
      field: 'password'
    });
  }
  
  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ 
      error: 'Password must contain at least one uppercase letter',
      field: 'password'
    });
  }
  
  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    return res.status(400).json({ 
      error: 'Password must contain at least one lowercase letter',
      field: 'password'
    });
  }
  
  // Check for number
  if (!/\d/.test(password)) {
    return res.status(400).json({ 
      error: 'Password must contain at least one number',
      field: 'password'
    });
  }
  
  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return res.status(400).json({ 
      error: 'Password must contain at least one special character (!@#$%^&*)',
      field: 'password'
    });
  }
  
  next();
};

// Email validation middleware
const validateEmail = (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      error: 'Email is required',
      field: 'email'
    });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      error: 'Please enter a valid email address',
      field: 'email'
    });
  }
  
  next();
};

// Name validation middleware
const validateNames = (req, res, next) => {
  const { firstname, lastname } = req.body;
  
  if (!firstname || !lastname) {
    return res.status(400).json({ 
      error: 'First name and last name are required',
      field: !firstname ? 'firstname' : 'lastname'
    });
  }
  
  // Check name format (letters only)
  const nameRegex = /^[A-Za-z]+$/;
  
  if (!nameRegex.test(firstname)) {
    return res.status(400).json({ 
      error: 'First name should only contain letters',
      field: 'firstname'
    });
  }
  
  if (!nameRegex.test(lastname)) {
    return res.status(400).json({ 
      error: 'Last name should only contain letters',
      field: 'lastname'
    });
  }
  
  // Check name length
  if (firstname.length < 2 || firstname.length > 50) {
    return res.status(400).json({ 
      error: 'First name must be between 2 and 50 characters',
      field: 'firstname'
    });
  }
  
  if (lastname.length < 2 || lastname.length > 50) {
    return res.status(400).json({ 
      error: 'Last name must be between 2 and 50 characters',
      field: 'lastname'
    });
  }
  
  next();
};

module.exports = {
  validatePassword,
  validateEmail,
  validateNames
};