import Joi from 'joi';

export const emailSchema = Joi.string().email().required();
export const passwordSchema = Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required();
export const phoneSchema = Joi.string().pattern(/^[+]?[1-9]\d{1,14}$/).optional();
export const uuidSchema = Joi.string().uuid().required();

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc')
});

export const validateEmail = (email: string): boolean => {
  const { error } = emailSchema.validate(email);
  return !error;
};

export const validatePassword = (password: string): boolean => {
  const { error } = passwordSchema.validate(password);
  return !error;
};

export const validateUUID = (id: string): boolean => {
  const { error } = uuidSchema.validate(id);
  return !error;
};

export const validatePagination = (params: any): { error?: any; value: any } => {
  return paginationSchema.validate(params);
};

export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const isValidSKU = (sku: string): boolean => {
  return /^[A-Z0-9-]{3,20}$/.test(sku);
};

export const isValidBarcode = (barcode: string): boolean => {
  return /^\d{8,14}$/.test(barcode);
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const { error } = phoneSchema.validate(phone);
  return !error;
};